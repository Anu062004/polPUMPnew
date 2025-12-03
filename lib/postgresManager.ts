/**
 * PostgreSQL Database Manager for Vercel Postgres
 * Handles all database operations using PostgreSQL instead of SQLite
 */

import { createClient } from '@vercel/postgres'
import { Pool } from 'pg'

// Use standard pg Pool if Vercel Postgres is not available (for local dev)
let pool: Pool | null = null
let vercelClient: ReturnType<typeof createClient> | null = null

// Check if we're using Vercel Postgres
const isVercelPostgres = !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING)

/**
 * Get database connection
 * Uses @vercel/postgres in production, falls back to pg Pool for local dev
 */
export async function getDb() {
  // Check if we're in Vercel environment
  if (isVercelPostgres) {
    // Use @vercel/postgres with createClient() for proper connection handling
    if (!vercelClient) {
      try {
        // Check if POSTGRES_PRISMA_URL is available (required for pooled connections)
        const pooledUrl = process.env.POSTGRES_PRISMA_URL
        
        if (!pooledUrl) {
          // No pooled connection available - don't try to use direct connection
          console.warn('⚠️ POSTGRES_PRISMA_URL not found. Postgres operations will be skipped.')
          throw new Error(
            'POSTGRES_PRISMA_URL (pooled connection) is required for Vercel Postgres. ' +
            'Direct connection strings (POSTGRES_URL) cannot be used with sql template tag. ' +
            'Please configure POSTGRES_PRISMA_URL in your Vercel project settings.'
          )
        }
        
        // createClient() automatically reads from POSTGRES_PRISMA_URL environment variable
        // Don't pass connectionString explicitly - let it read from env
        vercelClient = createClient()
        console.log('✅ Using Vercel Postgres client (POSTGRES_PRISMA_URL from env)')
      } catch (error: any) {
        // Don't log as error if it's just missing pooled connection - this is expected fallback
        if (error.message?.includes('POSTGRES_PRISMA_URL')) {
          console.warn('⚠️', error.message)
        } else {
          console.error('❌ Failed to create Vercel Postgres client:', error.message)
          console.error('Error details:', error)
        }
        throw error
      }
    }
    return { type: 'vercel', client: vercelClient, sql: vercelClient.sql }
  }

  // Fallback to standard pg Pool for local development
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 
                             process.env.POSTGRES_URL ||
                             'postgresql://localhost:5432/polpump'
    
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }

  return { type: 'pg', pool }
}

/**
 * Initialize database schema
 * Creates all necessary tables if they don't exist
 */
export async function initializeSchema() {
  try {
    // Check if PostgreSQL is configured
    // Prioritize pooled connection string for Vercel
    const hasPostgres = !!(process.env.POSTGRES_PRISMA_URL || 
                          process.env.POSTGRES_URL || 
                          process.env.POSTGRES_URL_NON_POOLING ||
                          process.env.DATABASE_URL)
    
    if (!hasPostgres) {
      console.warn('⚠️ No PostgreSQL connection string found. Using fallback.')
      return
    }
    
    // Check if we have pooled connection (required for Vercel)
    if (isVercelPostgres && !process.env.POSTGRES_PRISMA_URL && process.env.POSTGRES_URL) {
      // Only direct connection available - this won't work with sql template tag
      console.warn('⚠️ Only direct connection string (POSTGRES_URL) found. Pooled connection (POSTGRES_PRISMA_URL) is recommended for Vercel.')
      // Don't throw error, just warn - let it try and fail gracefully
    }
    
    const db = await getDb()
    
    // Check if we're using Vercel Postgres or standard pg
    if (db.type === 'pg') {
      // Standard pg Pool
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS coins (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          symbol VARCHAR(100) NOT NULL,
          supply VARCHAR(100) NOT NULL,
          decimals INTEGER DEFAULT 18,
          description TEXT,
          creator VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          
          -- 0G Storage Integration
          image_hash VARCHAR(255),
          image_url TEXT,
          metadata_hash VARCHAR(255),
          metadata_url TEXT,
          image_compression_ratio REAL,
          image_original_size INTEGER,
          image_compressed_size INTEGER,
          
          -- Blockchain Integration
          token_address VARCHAR(255) UNIQUE,
          curve_address VARCHAR(255),
          tx_hash VARCHAR(255),
          block_number BIGINT,
          gas_used BIGINT,
          gas_price VARCHAR(100),
          
          -- Social Links
          telegram_url TEXT,
          x_url TEXT,
          discord_url TEXT,
          website_url TEXT,
          
          -- Market Data
          market_cap REAL DEFAULT 0,
          price REAL DEFAULT 0,
          volume_24h REAL DEFAULT 0,
          change_24h REAL DEFAULT 0,
          holders INTEGER DEFAULT 0,
          total_transactions INTEGER DEFAULT 0,
          liquidity REAL DEFAULT 0,
          
          -- Performance tracking
          last_price_update BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          last_volume_update BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      // Create indexes
      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_coins_created_at ON coins(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_coins_symbol ON coins(symbol);
        CREATE INDEX IF NOT EXISTS idx_coins_creator ON coins(creator);
        CREATE INDEX IF NOT EXISTS idx_coins_token_address ON coins(token_address);
        CREATE INDEX IF NOT EXISTS idx_coins_curve_address ON coins(curve_address);
      `)

      // Gaming tables
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS gaming_coinflip (
          id SERIAL PRIMARY KEY,
          user_address VARCHAR(255) NOT NULL,
          wager REAL NOT NULL,
          choice VARCHAR(10) NOT NULL,
          outcome VARCHAR(10) NOT NULL,
          result VARCHAR(10) NOT NULL,
          seed_hash VARCHAR(255),
          seed_reveal VARCHAR(255),
          block_number BIGINT,
          block_hash VARCHAR(255),
          token_address VARCHAR(255),
          tx_hash VARCHAR(255),
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_coinflip_user ON gaming_coinflip(user_address);
        CREATE INDEX IF NOT EXISTS idx_coinflip_created ON gaming_coinflip(created_at DESC);
      `)

      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS gaming_mines (
          id SERIAL PRIMARY KEY,
          user_address VARCHAR(255) NOT NULL,
          bet_amount REAL NOT NULL,
          token_address VARCHAR(255) NOT NULL,
          mines_count INTEGER NOT NULL,
          grid_state TEXT NOT NULL,
          revealed_tiles TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','won','lost','cashed_out')),
          current_multiplier REAL DEFAULT 1.0,
          cashout_amount REAL,
          cashout_tx VARCHAR(255),
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          completed_at BIGINT
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_mines_user ON gaming_mines(user_address);
        CREATE INDEX IF NOT EXISTS idx_mines_status ON gaming_mines(status);
      `)

      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS gaming_pumpplay_rounds (
          id SERIAL PRIMARY KEY,
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          ends_at BIGINT NOT NULL,
          candidates TEXT NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','resolved')),
          winner_coin_id VARCHAR(255),
          total_pool REAL DEFAULT 0
        )
      `)

      await db.query(`
        CREATE TABLE IF NOT EXISTS gaming_pumpplay_bets (
          id SERIAL PRIMARY KEY,
          round_id INTEGER NOT NULL,
          user_address VARCHAR(255) NOT NULL,
          coin_id VARCHAR(255) NOT NULL,
          amount REAL NOT NULL,
          token_address VARCHAR(255),
          tx_hash VARCHAR(255),
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          FOREIGN KEY (round_id) REFERENCES gaming_pumpplay_rounds(id) ON DELETE CASCADE
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_pumpplay_rounds_status ON gaming_pumpplay_rounds(status);
        CREATE INDEX IF NOT EXISTS idx_pumpplay_bets_round ON gaming_pumpplay_bets(round_id);
        CREATE INDEX IF NOT EXISTS idx_pumpplay_bets_user ON gaming_pumpplay_bets(user_address);
      `)

      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS gaming_meme_royale (
          id SERIAL PRIMARY KEY,
          left_coin_id VARCHAR(255) NOT NULL,
          right_coin_id VARCHAR(255) NOT NULL,
          left_score REAL,
          right_score REAL,
          winner_coin_id VARCHAR(255),
          judge VARCHAR(255) DEFAULT 'random-judge',
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_meme_royale_created ON gaming_meme_royale(created_at DESC);
      `)

      // Livestreams table
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS livestreams (
          token_address VARCHAR(255) PRIMARY KEY,
          creator_address VARCHAR(255) NOT NULL,
          stream_key VARCHAR(255) NOT NULL,
          ingest_base_url TEXT,
          playback_base_url TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','live')),
          updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      console.log('✅ PostgreSQL schema initialized successfully')
    } else {
      // Using @vercel/postgres client
      const db = await getDb()
      if (db.type !== 'vercel') {
        throw new Error('Expected Vercel Postgres client')
      }
      const { sql } = db
      
      await sql`
        CREATE TABLE IF NOT EXISTS coins (
          id VARCHAR(255) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          symbol VARCHAR(100) NOT NULL,
          supply VARCHAR(100) NOT NULL,
          decimals INTEGER DEFAULT 18,
          description TEXT,
          creator VARCHAR(255) NOT NULL,
          created_at BIGINT NOT NULL,
          updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          image_hash VARCHAR(255),
          image_url TEXT,
          metadata_hash VARCHAR(255),
          metadata_url TEXT,
          image_compression_ratio REAL,
          image_original_size INTEGER,
          image_compressed_size INTEGER,
          token_address VARCHAR(255) UNIQUE,
          curve_address VARCHAR(255),
          tx_hash VARCHAR(255),
          block_number BIGINT,
          gas_used BIGINT,
          gas_price VARCHAR(100),
          telegram_url TEXT,
          x_url TEXT,
          discord_url TEXT,
          website_url TEXT,
          market_cap REAL DEFAULT 0,
          price REAL DEFAULT 0,
          volume_24h REAL DEFAULT 0,
          change_24h REAL DEFAULT 0,
          holders INTEGER DEFAULT 0,
          total_transactions INTEGER DEFAULT 0,
          liquidity REAL DEFAULT 0,
          last_price_update BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          last_volume_update BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `

      await sql`
        CREATE INDEX IF NOT EXISTS idx_coins_created_at ON coins(created_at DESC)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_coins_symbol ON coins(symbol)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_coins_creator ON coins(creator)
      `
      await sql`
        CREATE INDEX IF NOT EXISTS idx_coins_token_address ON coins(token_address)
      `

      console.log('✅ Vercel Postgres schema initialized successfully')
    }
  } catch (error: any) {
    // Log full error details for debugging
    console.error('❌ Schema initialization failed:', error)
    console.error('Error type:', error?.constructor?.name)
    console.error('Error message:', error?.message)
    console.error('Error code:', error?.code)
    if (error?.stack) {
      console.error('Error stack:', error.stack)
    }
    
    // If it's a connection string error, provide helpful message
    if (error.code === 'invalid_connection_string' || 
        error.message?.includes('connection string') ||
        error.message?.includes('POSTGRES_PRISMA_URL')) {
      console.error('💡 Tip: Make sure POSTGRES_PRISMA_URL (pooled connection) is configured in Vercel')
      console.error('💡 Check that the environment variable is set in Vercel project settings')
      // Don't throw - let the calling code handle fallback
      return
    }
    
    // If it's a TypeError, log more details
    if (error instanceof TypeError || error?.constructor?.name === 'TypeError') {
      console.error('💡 TypeError detected - this might be a client initialization issue')
      console.error('💡 Make sure @vercel/postgres package is installed: npm install @vercel/postgres')
    }
    
    // Only throw if it's not a connection/client issue (might be a real schema problem)
    if (!error.message?.includes('connection') && 
        !error.message?.includes('POSTGRES') &&
        !(error instanceof TypeError)) {
      throw error
    }
  }
}

/**
 * Execute a query (for standard pg Pool only)
 * For @vercel/postgres, use the sql template tag directly
 */
export async function query(text: string, params?: any[]) {
  const db = await getDb()
  
  if (db.type === 'pg') {
    return await db.pool.query(text, params)
  } else {
    throw new Error('Use sql template tag from @vercel/postgres for queries. Import: import { sql } from "@vercel/postgres"')
  }
}

/**
 * Get the sql template tag for Vercel Postgres
 * Returns null if Postgres is not available or connection fails
 */
export async function getSql() {
  try {
    const db = await getDb()
    if (db.type === 'vercel') {
      return db.sql
    }
    return null
  } catch (error: any) {
    // If connection fails, return null so caller can use SQLite fallback
    if (error.code === 'invalid_connection_string' || 
        error.message?.includes('connection string') ||
        error.message?.includes('POSTGRES_PRISMA_URL')) {
      console.warn('⚠️ Cannot get Postgres SQL client, will use SQLite fallback:', error.message)
      return null
    }
    throw error
  }
}

/**
 * Check if using Vercel Postgres
 */
export function isUsingVercelPostgres() {
  return isVercelPostgres
}

/**
 * Close database connection (for standard pg Pool)
 */
export async function close() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

