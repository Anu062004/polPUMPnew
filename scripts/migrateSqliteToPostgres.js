#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs')
const path = require('path')
const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const { Client } = require('pg')
const dotenv = require('dotenv')

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true })
dotenv.config({
  path: path.join(__dirname, '..', '.env.local'),
  override: true,
  quiet: true,
})

const SQLITE_PATH = path.join(__dirname, '..', 'data', 'coins.db')

function getPostgresConnectionString() {
  return (
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL
  )
}

function normalizeAddr(v) {
  if (!v || typeof v !== 'string') return v || null
  return v.toLowerCase()
}

async function ensurePostgresSchema(pg) {
  await pg.query(`
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
    );

    CREATE TABLE IF NOT EXISTS gaming_coinflip (
      id SERIAL PRIMARY KEY,
      user_address VARCHAR(255) NOT NULL,
      wager REAL NOT NULL,
      outcome VARCHAR(10) NOT NULL CHECK (outcome IN ('win', 'lose')),
      seed_hash VARCHAR(255) NOT NULL,
      seed_reveal VARCHAR(255) NOT NULL,
      block_number BIGINT,
      block_hash VARCHAR(255),
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gaming_mines (
      id SERIAL PRIMARY KEY,
      user_address VARCHAR(255) NOT NULL,
      bet_amount REAL NOT NULL,
      token_address VARCHAR(255) NOT NULL,
      mines_count INTEGER NOT NULL,
      grid_state TEXT NOT NULL,
      revealed_tiles TEXT NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'won', 'lost', 'cashed_out')) DEFAULT 'active',
      current_multiplier REAL DEFAULT 1.0,
      cashout_amount REAL,
      created_at BIGINT NOT NULL,
      completed_at BIGINT
    );

    CREATE TABLE IF NOT EXISTS gaming_pumpplay_rounds (
      id SERIAL PRIMARY KEY,
      created_at BIGINT NOT NULL,
      ends_at BIGINT NOT NULL,
      candidates TEXT NOT NULL,
      status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'closed', 'resolved')) DEFAULT 'open',
      winner_coin_id VARCHAR(255),
      total_pool REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS gaming_pumpplay_bets (
      id SERIAL PRIMARY KEY,
      round_id INTEGER NOT NULL REFERENCES gaming_pumpplay_rounds(id) ON DELETE CASCADE,
      user_address VARCHAR(255) NOT NULL,
      coin_id VARCHAR(255) NOT NULL,
      amount REAL NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gaming_meme_royale (
      id SERIAL PRIMARY KEY,
      left_coin_id VARCHAR(255) NOT NULL,
      right_coin_id VARCHAR(255) NOT NULL,
      left_score REAL,
      right_score REAL,
      winner_coin_id VARCHAR(255),
      judge VARCHAR(255) DEFAULT 'random-judge',
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS livestreams (
      token_address VARCHAR(255) PRIMARY KEY,
      creator_address VARCHAR(255) NOT NULL,
      stream_key VARCHAR(255) NOT NULL,
      ingest_base_url TEXT,
      playback_base_url TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'live')),
      updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
  `)
}

async function tableExistsSqlite(db, table) {
  const row = await db.get(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [table]
  )
  return !!row
}

async function migrateCoins(sqliteDb, pg) {
  if (!(await tableExistsSqlite(sqliteDb, 'coins'))) {
    return { source: 0, migrated: 0 }
  }

  const rows = await sqliteDb.all('SELECT * FROM coins')
  let migrated = 0

  for (const r of rows) {
    await pg.query(
      `
      INSERT INTO coins (
        id, name, symbol, supply, decimals, description, creator,
        created_at, updated_at, image_hash, image_url, metadata_hash, metadata_url,
        image_compression_ratio, image_original_size, image_compressed_size,
        token_address, curve_address, tx_hash, block_number, gas_used, gas_price,
        telegram_url, x_url, discord_url, website_url, market_cap, price,
        volume_24h, change_24h, holders, total_transactions, liquidity,
        last_price_update, last_volume_update
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,
        $8,$9,$10,$11,$12,$13,
        $14,$15,$16,
        $17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,
        $29,$30,$31,$32,$33,
        $34,$35
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        symbol = EXCLUDED.symbol,
        supply = EXCLUDED.supply,
        decimals = EXCLUDED.decimals,
        description = EXCLUDED.description,
        creator = EXCLUDED.creator,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        image_hash = EXCLUDED.image_hash,
        image_url = EXCLUDED.image_url,
        metadata_hash = EXCLUDED.metadata_hash,
        metadata_url = EXCLUDED.metadata_url,
        image_compression_ratio = EXCLUDED.image_compression_ratio,
        image_original_size = EXCLUDED.image_original_size,
        image_compressed_size = EXCLUDED.image_compressed_size,
        token_address = EXCLUDED.token_address,
        curve_address = EXCLUDED.curve_address,
        tx_hash = EXCLUDED.tx_hash,
        block_number = EXCLUDED.block_number,
        gas_used = EXCLUDED.gas_used,
        gas_price = EXCLUDED.gas_price,
        telegram_url = EXCLUDED.telegram_url,
        x_url = EXCLUDED.x_url,
        discord_url = EXCLUDED.discord_url,
        website_url = EXCLUDED.website_url,
        market_cap = EXCLUDED.market_cap,
        price = EXCLUDED.price,
        volume_24h = EXCLUDED.volume_24h,
        change_24h = EXCLUDED.change_24h,
        holders = EXCLUDED.holders,
        total_transactions = EXCLUDED.total_transactions,
        liquidity = EXCLUDED.liquidity,
        last_price_update = EXCLUDED.last_price_update,
        last_volume_update = EXCLUDED.last_volume_update
      `,
      [
        r.id,
        r.name,
        r.symbol,
        r.supply,
        r.decimals ?? 18,
        r.description ?? null,
        normalizeAddr(r.creator) ?? '',
        r.createdAt ?? Date.now(),
        r.updatedAt ?? Date.now(),
        r.imageHash ?? null,
        r.imageUrl ?? null,
        r.metadataHash ?? null,
        r.metadataUrl ?? null,
        r.imageCompressionRatio ?? null,
        r.imageOriginalSize ?? null,
        r.imageCompressedSize ?? null,
        normalizeAddr(r.tokenAddress),
        normalizeAddr(r.curveAddress),
        r.txHash ?? null,
        r.blockNumber ?? null,
        r.gasUsed ?? null,
        r.gasPrice ?? null,
        r.telegramUrl ?? null,
        r.xUrl ?? null,
        r.discordUrl ?? null,
        r.websiteUrl ?? null,
        r.marketCap ?? 0,
        r.price ?? 0,
        r.volume24h ?? 0,
        r.change24h ?? 0,
        r.holders ?? 0,
        r.totalTransactions ?? 0,
        r.liquidity ?? 0,
        r.lastPriceUpdate ?? r.updatedAt ?? Date.now(),
        r.lastVolumeUpdate ?? r.updatedAt ?? Date.now(),
      ]
    )
    migrated += 1
  }

  return { source: rows.length, migrated }
}

async function migrateGamingCoinflip(sqliteDb, pg) {
  if (!(await tableExistsSqlite(sqliteDb, 'gaming_coinflip'))) {
    return { source: 0, migrated: 0 }
  }
  const rows = await sqliteDb.all('SELECT * FROM gaming_coinflip')
  let migrated = 0
  for (const r of rows) {
    await pg.query(
      `
      INSERT INTO gaming_coinflip (
        id, user_address, wager, outcome, seed_hash, seed_reveal, block_number, block_hash, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (id) DO UPDATE SET
        user_address = EXCLUDED.user_address,
        wager = EXCLUDED.wager,
        outcome = EXCLUDED.outcome,
        seed_hash = EXCLUDED.seed_hash,
        seed_reveal = EXCLUDED.seed_reveal,
        block_number = EXCLUDED.block_number,
        block_hash = EXCLUDED.block_hash,
        created_at = EXCLUDED.created_at
      `,
      [
        r.id,
        normalizeAddr(r.userAddress) ?? '',
        r.wager ?? 0,
        r.outcome ?? 'lose',
        r.seedHash ?? '',
        r.seedReveal ?? '',
        r.blockNumber ?? null,
        r.blockHash ?? null,
        r.createdAt ?? Date.now(),
      ]
    )
    migrated += 1
  }
  return { source: rows.length, migrated }
}

async function migrateGamingMines(sqliteDb, pg) {
  if (!(await tableExistsSqlite(sqliteDb, 'gaming_mines'))) {
    return { source: 0, migrated: 0 }
  }
  const rows = await sqliteDb.all('SELECT * FROM gaming_mines')
  let migrated = 0
  for (const r of rows) {
    await pg.query(
      `
      INSERT INTO gaming_mines (
        id, user_address, bet_amount, token_address, mines_count, grid_state, revealed_tiles,
        status, current_multiplier, cashout_amount, created_at, completed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        user_address = EXCLUDED.user_address,
        bet_amount = EXCLUDED.bet_amount,
        token_address = EXCLUDED.token_address,
        mines_count = EXCLUDED.mines_count,
        grid_state = EXCLUDED.grid_state,
        revealed_tiles = EXCLUDED.revealed_tiles,
        status = EXCLUDED.status,
        current_multiplier = EXCLUDED.current_multiplier,
        cashout_amount = EXCLUDED.cashout_amount,
        created_at = EXCLUDED.created_at,
        completed_at = EXCLUDED.completed_at
      `,
      [
        r.id,
        normalizeAddr(r.userAddress) ?? '',
        r.betAmount ?? 0,
        normalizeAddr(r.tokenAddress) ?? '',
        r.minesCount ?? 1,
        r.gridState ?? '[]',
        r.revealedTiles ?? '[]',
        r.status ?? 'active',
        r.currentMultiplier ?? 1.0,
        r.cashoutAmount ?? null,
        r.createdAt ?? Date.now(),
        r.completedAt ?? null,
      ]
    )
    migrated += 1
  }
  return { source: rows.length, migrated }
}

async function migratePumpplayRounds(sqliteDb, pg) {
  if (!(await tableExistsSqlite(sqliteDb, 'gaming_pumpplay_rounds'))) {
    return { source: 0, migrated: 0 }
  }
  const rows = await sqliteDb.all('SELECT * FROM gaming_pumpplay_rounds')
  let migrated = 0
  for (const r of rows) {
    await pg.query(
      `
      INSERT INTO gaming_pumpplay_rounds (
        id, created_at, ends_at, candidates, status, winner_coin_id, total_pool
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (id) DO UPDATE SET
        created_at = EXCLUDED.created_at,
        ends_at = EXCLUDED.ends_at,
        candidates = EXCLUDED.candidates,
        status = EXCLUDED.status,
        winner_coin_id = EXCLUDED.winner_coin_id,
        total_pool = EXCLUDED.total_pool
      `,
      [
        r.id,
        r.createdAt ?? Date.now(),
        r.endsAt ?? Date.now(),
        r.candidates ?? '[]',
        r.status ?? 'open',
        r.winnerCoinId ?? null,
        r.totalPool ?? 0,
      ]
    )
    migrated += 1
  }
  return { source: rows.length, migrated }
}

async function migratePumpplayBets(sqliteDb, pg) {
  if (!(await tableExistsSqlite(sqliteDb, 'gaming_pumpplay_bets'))) {
    return { source: 0, migrated: 0 }
  }
  const rows = await sqliteDb.all('SELECT * FROM gaming_pumpplay_bets')
  let migrated = 0
  for (const r of rows) {
    await pg.query(
      `
      INSERT INTO gaming_pumpplay_bets (
        id, round_id, user_address, coin_id, amount, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (id) DO UPDATE SET
        round_id = EXCLUDED.round_id,
        user_address = EXCLUDED.user_address,
        coin_id = EXCLUDED.coin_id,
        amount = EXCLUDED.amount,
        created_at = EXCLUDED.created_at
      `,
      [
        r.id,
        r.roundId,
        normalizeAddr(r.userAddress) ?? '',
        r.coinId ?? '',
        r.amount ?? 0,
        r.createdAt ?? Date.now(),
      ]
    )
    migrated += 1
  }
  return { source: rows.length, migrated }
}

async function migrateMemeRoyale(sqliteDb, pg) {
  if (!(await tableExistsSqlite(sqliteDb, 'gaming_meme_royale'))) {
    return { source: 0, migrated: 0 }
  }
  const rows = await sqliteDb.all('SELECT * FROM gaming_meme_royale')
  let migrated = 0
  for (const r of rows) {
    await pg.query(
      `
      INSERT INTO gaming_meme_royale (
        id, left_coin_id, right_coin_id, left_score, right_score, winner_coin_id, judge, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      ON CONFLICT (id) DO UPDATE SET
        left_coin_id = EXCLUDED.left_coin_id,
        right_coin_id = EXCLUDED.right_coin_id,
        left_score = EXCLUDED.left_score,
        right_score = EXCLUDED.right_score,
        winner_coin_id = EXCLUDED.winner_coin_id,
        judge = EXCLUDED.judge,
        created_at = EXCLUDED.created_at
      `,
      [
        r.id,
        r.leftCoinId ?? '',
        r.rightCoinId ?? '',
        r.leftScore ?? null,
        r.rightScore ?? null,
        r.winnerCoinId ?? null,
        r.judge ?? 'random-judge',
        r.createdAt ?? Date.now(),
      ]
    )
    migrated += 1
  }
  return { source: rows.length, migrated }
}

async function migrateLivestreams(sqliteDb, pg) {
  if (!(await tableExistsSqlite(sqliteDb, 'livestreams'))) {
    return { source: 0, migrated: 0 }
  }
  const rows = await sqliteDb.all('SELECT * FROM livestreams')
  let migrated = 0
  for (const r of rows) {
    await pg.query(
      `
      INSERT INTO livestreams (
        token_address, creator_address, stream_key, ingest_base_url, playback_base_url, status, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (token_address) DO UPDATE SET
        creator_address = EXCLUDED.creator_address,
        stream_key = EXCLUDED.stream_key,
        ingest_base_url = EXCLUDED.ingest_base_url,
        playback_base_url = EXCLUDED.playback_base_url,
        status = EXCLUDED.status,
        updated_at = EXCLUDED.updated_at
      `,
      [
        normalizeAddr(r.tokenAddress) ?? '',
        normalizeAddr(r.creatorAddress) ?? '',
        r.streamKey ?? '',
        r.ingestBaseUrl ?? null,
        r.playbackBaseUrl ?? null,
        r.status === 'live' ? 'live' : 'offline',
        r.updatedAt ?? Date.now(),
      ]
    )
    migrated += 1
  }
  return { source: rows.length, migrated }
}

async function fixSequences(pg) {
  const sequenceFixes = [
    ['gaming_coinflip', 'id'],
    ['gaming_mines', 'id'],
    ['gaming_pumpplay_rounds', 'id'],
    ['gaming_pumpplay_bets', 'id'],
    ['gaming_meme_royale', 'id'],
  ]

  for (const [table, col] of sequenceFixes) {
    await pg.query(
      `
      SELECT setval(
        pg_get_serial_sequence($1, $2),
        GREATEST((SELECT COALESCE(MAX(${col}), 0) FROM ${table}), 1),
        true
      )
      `,
      [table, col]
    )
  }
}

async function countTableSqlite(db, table) {
  if (!(await tableExistsSqlite(db, table))) return 0
  const row = await db.get(`SELECT COUNT(*) AS c FROM ${table}`)
  return row?.c || 0
}

async function countTablePg(pg, table) {
  const res = await pg.query(`SELECT COUNT(*)::int AS c FROM ${table}`)
  return res.rows[0]?.c || 0
}

async function main() {
  if (!fs.existsSync(SQLITE_PATH)) {
    console.log(`SQLite DB not found at ${SQLITE_PATH}. Nothing to migrate.`)
    process.exit(0)
  }

  const connectionString = getPostgresConnectionString()
  if (!connectionString) {
    console.error(
      'No Postgres connection string found. Set POSTGRES_PRISMA_URL or POSTGRES_URL or DATABASE_URL.'
    )
    process.exit(1)
  }

  const sqliteDb = await open({
    filename: SQLITE_PATH,
    driver: sqlite3.Database,
  })

  const pg = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  })

  await pg.connect()
  await ensurePostgresSchema(pg)

  const before = {
    coins: await countTablePg(pg, 'coins'),
    gaming_coinflip: await countTablePg(pg, 'gaming_coinflip'),
    gaming_mines: await countTablePg(pg, 'gaming_mines'),
    gaming_pumpplay_rounds: await countTablePg(pg, 'gaming_pumpplay_rounds'),
    gaming_pumpplay_bets: await countTablePg(pg, 'gaming_pumpplay_bets'),
    gaming_meme_royale: await countTablePg(pg, 'gaming_meme_royale'),
    livestreams: await countTablePg(pg, 'livestreams'),
  }

  const sqliteSource = {
    coins: await countTableSqlite(sqliteDb, 'coins'),
    gaming_coinflip: await countTableSqlite(sqliteDb, 'gaming_coinflip'),
    gaming_mines: await countTableSqlite(sqliteDb, 'gaming_mines'),
    gaming_pumpplay_rounds: await countTableSqlite(sqliteDb, 'gaming_pumpplay_rounds'),
    gaming_pumpplay_bets: await countTableSqlite(sqliteDb, 'gaming_pumpplay_bets'),
    gaming_meme_royale: await countTableSqlite(sqliteDb, 'gaming_meme_royale'),
    livestreams: await countTableSqlite(sqliteDb, 'livestreams'),
  }

  console.log('SQLite source row counts:', sqliteSource)
  console.log('Postgres row counts before migration:', before)

  const results = {
    coins: await migrateCoins(sqliteDb, pg),
    gaming_coinflip: await migrateGamingCoinflip(sqliteDb, pg),
    gaming_mines: await migrateGamingMines(sqliteDb, pg),
    gaming_pumpplay_rounds: await migratePumpplayRounds(sqliteDb, pg),
    gaming_pumpplay_bets: await migratePumpplayBets(sqliteDb, pg),
    gaming_meme_royale: await migrateMemeRoyale(sqliteDb, pg),
    livestreams: await migrateLivestreams(sqliteDb, pg),
  }

  await fixSequences(pg)

  const after = {
    coins: await countTablePg(pg, 'coins'),
    gaming_coinflip: await countTablePg(pg, 'gaming_coinflip'),
    gaming_mines: await countTablePg(pg, 'gaming_mines'),
    gaming_pumpplay_rounds: await countTablePg(pg, 'gaming_pumpplay_rounds'),
    gaming_pumpplay_bets: await countTablePg(pg, 'gaming_pumpplay_bets'),
    gaming_meme_royale: await countTablePg(pg, 'gaming_meme_royale'),
    livestreams: await countTablePg(pg, 'livestreams'),
  }

  console.log('Migration results:', results)
  console.log('Postgres row counts after migration:', after)

  await sqliteDb.close()
  await pg.end()
}

main().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
