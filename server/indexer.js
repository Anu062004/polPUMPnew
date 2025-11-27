/**
 * Indexer Service for POL Pump
 * Listens to blockchain events and indexes them into PostgreSQL database
 */

const { ethers } = require('ethers');
const { Pool } = require('pg');
require('dotenv').config();

// Contract ABIs (simplified for events)
const FACTORY_ABI = [
  "event TokenCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens, uint8 curveType, bytes curveParams)",
  "event LiquiditySeeded(address indexed token, address indexed curve, uint256 ogAmount, uint256 tokenAmount)",
  "event FeeConfigUpdated(uint16 platformFeeBps, uint16 creatorFeeBps, uint16 burnFeeBps, uint16 lpFeeBps)"
];

const BONDING_CURVE_ABI = [
  "event Seeded(uint256 ogReserve, uint256 tokenReserve)",
  "event BuyExecuted(address indexed buyer, uint256 ogIn, uint256 tokensOut, uint256 price, uint256 priceImpact)",
  "event SellExecuted(address indexed seller, uint256 tokensIn, uint256 ogOut, uint256 price, uint256 priceImpact)",
  "event FeeTaken(address indexed token, address indexed feeRecipient, uint256 feeAmount, string feeType)"
];

class Indexer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || process.env.NEXT_PUBLIC_EVM_RPC);
    this.factoryAddress = process.env.FACTORY_ADDRESS || process.env.NEXT_PUBLIC_FACTORY_ADDRESS;
    
    // Database connection
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'polpump',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    });

    this.lastProcessedBlock = 0;
    this.isRunning = false;
  }

  async initialize() {
    console.log('🚀 Initializing Indexer...');
    
    // Create tables if they don't exist
    await this.createTables();
    
    // Get last processed block
    const result = await this.pool.query('SELECT MAX(block_number) as last_block FROM indexer_state');
    this.lastProcessedBlock = result.rows[0]?.last_block || 0;
    
    if (this.lastProcessedBlock === 0) {
      // Start from a recent block (e.g., 1000 blocks ago)
      const currentBlock = await this.provider.getBlockNumber();
      this.lastProcessedBlock = Math.max(0, currentBlock - 1000);
    }
    
    console.log(`📦 Starting from block ${this.lastProcessedBlock}`);
  }

  async createTables() {
    const queries = [
      // Indexer state
      `CREATE TABLE IF NOT EXISTS indexer_state (
        id SERIAL PRIMARY KEY,
        last_block BIGINT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      
      // Tokens table
      `CREATE TABLE IF NOT EXISTS tokens (
        id SERIAL PRIMARY KEY,
        token_address VARCHAR(42) UNIQUE NOT NULL,
        curve_address VARCHAR(42),
        creator VARCHAR(42) NOT NULL,
        name VARCHAR(255) NOT NULL,
        symbol VARCHAR(50) NOT NULL,
        seed_og NUMERIC(78, 0),
        seed_tokens NUMERIC(78, 0),
        curve_type SMALLINT,
        curve_params BYTEA,
        metadata_uri TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        created_block BIGINT
      )`,
      
      // Trades table
      `CREATE TABLE IF NOT EXISTS trades (
        id SERIAL PRIMARY KEY,
        token_id INTEGER REFERENCES tokens(id),
        tx_hash VARCHAR(66) NOT NULL,
        block_number BIGINT NOT NULL,
        trader VARCHAR(42) NOT NULL,
        trade_type VARCHAR(10) NOT NULL, -- 'buy' or 'sell'
        amount_in NUMERIC(78, 0) NOT NULL,
        amount_out NUMERIC(78, 0) NOT NULL,
        price NUMERIC(78, 0),
        price_impact NUMERIC(78, 0),
        fee_amount NUMERIC(78, 0),
        timestamp TIMESTAMP DEFAULT NOW()
      )`,
      
      // Liquidity events
      `CREATE TABLE IF NOT EXISTS liquidity_events (
        id SERIAL PRIMARY KEY,
        token_id INTEGER REFERENCES tokens(id),
        event_type VARCHAR(20) NOT NULL,
        og_amount NUMERIC(78, 0),
        token_amount NUMERIC(78, 0),
        block_number BIGINT,
        timestamp TIMESTAMP DEFAULT NOW()
      )`,
      
      // Users table
      `CREATE TABLE IF NOT EXISTS users (
        wallet VARCHAR(42) PRIMARY KEY,
        xp INTEGER DEFAULT 0,
        level INTEGER DEFAULT 1,
        total_spent NUMERIC(78, 0) DEFAULT 0,
        total_earned NUMERIC(78, 0) DEFAULT 0,
        tokens_created INTEGER DEFAULT 0,
        trades_count INTEGER DEFAULT 0,
        joined_at TIMESTAMP DEFAULT NOW(),
        last_active TIMESTAMP DEFAULT NOW()
      )`,
      
      // Fee events
      `CREATE TABLE IF NOT EXISTS fee_events (
        id SERIAL PRIMARY KEY,
        token_id INTEGER REFERENCES tokens(id),
        fee_recipient VARCHAR(42),
        fee_amount NUMERIC(78, 0),
        fee_type VARCHAR(20), -- 'platform', 'creator', 'burn', 'lp'
        tx_hash VARCHAR(66),
        block_number BIGINT,
        timestamp TIMESTAMP DEFAULT NOW()
      )`,
      
      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(token_id)`,
      `CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(trader)`,
      `CREATE INDEX IF NOT EXISTS idx_trades_block ON trades(block_number)`,
      `CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator)`,
      `CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at)`,
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }
    
    console.log('✅ Database tables created');
  }

  async processBlock(blockNumber) {
    try {
      const factory = new ethers.Contract(this.factoryAddress, FACTORY_ABI, this.provider);
      
      // Get all TokenCreated events
      const tokenCreatedFilter = factory.filters.TokenCreated();
      const tokenCreatedLogs = await this.provider.getLogs({
        ...tokenCreatedFilter,
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      for (const log of tokenCreatedLogs) {
        await this.handleTokenCreated(log);
      }

      // Process bonding curve events for all known tokens
      const tokens = await this.pool.query('SELECT token_address, curve_address FROM tokens');
      for (const token of tokens.rows) {
        if (token.curve_address) {
          await this.processBondingCurveEvents(token.curve_address, blockNumber);
        }
      }

      // Update last processed block
      await this.pool.query(
        'INSERT INTO indexer_state (last_block) VALUES ($1) ON CONFLICT DO NOTHING',
        [blockNumber]
      );
      await this.pool.query(
        'UPDATE indexer_state SET last_block = $1, updated_at = NOW() WHERE last_block < $1',
        [blockNumber]
      );

      this.lastProcessedBlock = blockNumber;
    } catch (error) {
      console.error(`❌ Error processing block ${blockNumber}:`, error.message);
    }
  }

  async handleTokenCreated(log) {
    const iface = new ethers.Interface(FACTORY_ABI);
    const parsed = iface.parseLog(log);
    const args = parsed.args;

    try {
      // Insert or update token
      await this.pool.query(
        `INSERT INTO tokens (
          token_address, curve_address, creator, name, symbol, 
          seed_og, seed_tokens, curve_type, curve_params, created_block
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (token_address) DO UPDATE SET
          curve_address = EXCLUDED.curve_address,
          name = EXCLUDED.name,
          symbol = EXCLUDED.symbol`,
        [
          args.token,
          args.curve,
          args.creator,
          args.name,
          args.symbol,
          args.seedOg.toString(),
          args.seedTokens.toString(),
          args.curveType,
          args.curveParams,
          log.blockNumber,
        ]
      );

      // Update user stats
      await this.pool.query(
        `INSERT INTO users (wallet, tokens_created, last_active)
         VALUES ($1, 1, NOW())
         ON CONFLICT (wallet) DO UPDATE SET
           tokens_created = users.tokens_created + 1,
           last_active = NOW()`,
        [args.creator]
      );

      console.log(`✅ Indexed token: ${args.name} (${args.symbol}) at ${args.token}`);
    } catch (error) {
      console.error('❌ Error handling TokenCreated:', error.message);
    }
  }

  async processBondingCurveEvents(curveAddress, blockNumber) {
    try {
      const curve = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider);
      
      // Get BuyExecuted events
      const buyFilter = curve.filters.BuyExecuted();
      const buyLogs = await this.provider.getLogs({
        ...buyFilter,
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      for (const log of buyLogs) {
        await this.handleBuyExecuted(log, curveAddress);
      }

      // Get SellExecuted events
      const sellFilter = curve.filters.SellExecuted();
      const sellLogs = await this.provider.getLogs({
        ...sellFilter,
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      for (const log of sellLogs) {
        await this.handleSellExecuted(log, curveAddress);
      }

      // Get FeeTaken events
      const feeFilter = curve.filters.FeeTaken();
      const feeLogs = await this.provider.getLogs({
        ...feeFilter,
        fromBlock: blockNumber,
        toBlock: blockNumber,
      });

      for (const log of feeLogs) {
        await this.handleFeeTaken(log, curveAddress);
      }
    } catch (error) {
      console.error(`❌ Error processing curve events for ${curveAddress}:`, error.message);
    }
  }

  async handleBuyExecuted(log, curveAddress) {
    const iface = new ethers.Interface(BONDING_CURVE_ABI);
    const parsed = iface.parseLog(log);
    const args = parsed.args;

    try {
      // Get token address from curve
      const tokenResult = await this.pool.query(
        'SELECT id FROM tokens WHERE curve_address = $1',
        [curveAddress]
      );
      
      if (tokenResult.rows.length === 0) return;
      const tokenId = tokenResult.rows[0].id;

      // Insert trade
      await this.pool.query(
        `INSERT INTO trades (
          token_id, tx_hash, block_number, trader, trade_type,
          amount_in, amount_out, price, price_impact
        ) VALUES ($1, $2, $3, $4, 'buy', $5, $6, $7, $8)`,
        [
          tokenId,
          log.transactionHash,
          log.blockNumber,
          args.buyer,
          args.ogIn.toString(),
          args.tokensOut.toString(),
          args.price.toString(),
          args.priceImpact.toString(),
        ]
      );

      // Update user stats
      await this.pool.query(
        `INSERT INTO users (wallet, trades_count, total_spent, last_active)
         VALUES ($1, 1, $2, NOW())
         ON CONFLICT (wallet) DO UPDATE SET
           trades_count = users.trades_count + 1,
           total_spent = users.total_spent + $2,
           last_active = NOW()`,
        [args.buyer, args.ogIn.toString()]
      );
    } catch (error) {
      console.error('❌ Error handling BuyExecuted:', error.message);
    }
  }

  async handleSellExecuted(log, curveAddress) {
    const iface = new ethers.Interface(BONDING_CURVE_ABI);
    const parsed = iface.parseLog(log);
    const args = parsed.args;

    try {
      const tokenResult = await this.pool.query(
        'SELECT id FROM tokens WHERE curve_address = $1',
        [curveAddress]
      );
      
      if (tokenResult.rows.length === 0) return;
      const tokenId = tokenResult.rows[0].id;

      await this.pool.query(
        `INSERT INTO trades (
          token_id, tx_hash, block_number, trader, trade_type,
          amount_in, amount_out, price, price_impact
        ) VALUES ($1, $2, $3, $4, 'sell', $5, $6, $7, $8)`,
        [
          tokenId,
          log.transactionHash,
          log.blockNumber,
          args.seller,
          args.tokensIn.toString(),
          args.ogOut.toString(),
          args.price.toString(),
          args.priceImpact.toString(),
        ]
      );

      // Update user stats
      await this.pool.query(
        `INSERT INTO users (wallet, trades_count, total_earned, last_active)
         VALUES ($1, 1, $2, NOW())
         ON CONFLICT (wallet) DO UPDATE SET
           trades_count = users.trades_count + 1,
           total_earned = users.total_earned + $2,
           last_active = NOW()`,
        [args.seller, args.ogOut.toString()]
      );
    } catch (error) {
      console.error('❌ Error handling SellExecuted:', error.message);
    }
  }

  async handleFeeTaken(log, curveAddress) {
    const iface = new ethers.Interface(BONDING_CURVE_ABI);
    const parsed = iface.parseLog(log);
    const args = parsed.args;

    try {
      const tokenResult = await this.pool.query(
        'SELECT id FROM tokens WHERE curve_address = $1',
        [curveAddress]
      );
      
      if (tokenResult.rows.length === 0) return;
      const tokenId = tokenResult.rows[0].id;

      await this.pool.query(
        `INSERT INTO fee_events (
          token_id, fee_recipient, fee_amount, fee_type, tx_hash, block_number
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          tokenId,
          args.feeRecipient,
          args.feeAmount.toString(),
          args.feeType,
          log.transactionHash,
          log.blockNumber,
        ]
      );
    } catch (error) {
      console.error('❌ Error handling FeeTaken:', error.message);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Indexer already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting indexer...');

    while (this.isRunning) {
      try {
        const currentBlock = await this.provider.getBlockNumber();
        const targetBlock = Math.min(this.lastProcessedBlock + 100, currentBlock);

        if (targetBlock > this.lastProcessedBlock) {
          console.log(`📦 Processing blocks ${this.lastProcessedBlock + 1} to ${targetBlock}`);
          
          for (let block = this.lastProcessedBlock + 1; block <= targetBlock; block++) {
            await this.processBlock(block);
          }
        } else {
          // Wait for new blocks
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (error) {
        console.error('❌ Indexer error:', error.message);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }
  }

  async stop() {
    this.isRunning = false;
    await this.pool.end();
    console.log('🛑 Indexer stopped');
  }
}

// Run if called directly
if (require.main === module) {
  const indexer = new Indexer();
  indexer.initialize().then(() => {
    indexer.start();
  });

  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await indexer.stop();
    process.exit(0);
  });
}

module.exports = Indexer;


