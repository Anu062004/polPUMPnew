/**
 * PostgreSQL Database Manager for Vercel Postgres
 * Handles all database operations using PostgreSQL instead of SQLite
 */

import { Pool, QueryResult } from 'pg'

// Use standard pg Pool for all connections
let pool: Pool | null = null

type PostgresEnvSource =
  | 'POSTGRES_PRISMA_URL'
  | 'POSTGRES_URL'
  | 'POSTGRES_URL_NON_POOLING'
  | 'DATABASE_URL'

type PostgresEnvCandidate = {
  source: PostgresEnvSource
  value: string
}

function getPostgresEnvCandidates(): PostgresEnvCandidate[] {
  const candidates: Array<PostgresEnvCandidate | null> = [
    process.env.POSTGRES_PRISMA_URL
      ? { source: 'POSTGRES_PRISMA_URL', value: process.env.POSTGRES_PRISMA_URL }
      : null,
    process.env.POSTGRES_URL
      ? { source: 'POSTGRES_URL', value: process.env.POSTGRES_URL }
      : null,
    process.env.POSTGRES_URL_NON_POOLING
      ? { source: 'POSTGRES_URL_NON_POOLING', value: process.env.POSTGRES_URL_NON_POOLING }
      : null,
    process.env.DATABASE_URL
      ? { source: 'DATABASE_URL', value: process.env.DATABASE_URL }
      : null,
  ]

  return candidates.filter((candidate): candidate is PostgresEnvCandidate => !!candidate)
}

function validatePostgresConnectionString(raw: string): { valid: boolean; reason?: string } {
  const value = String(raw || '').trim()
  if (!value) {
    return { valid: false, reason: 'empty value' }
  }

  const lowered = value.toLowerCase()
  if (
    lowered === 'base' ||
    lowered === '__set_in_secret_manager__' ||
    lowered === 'changeme' ||
    lowered.includes('set_in_secret_manager') ||
    lowered.includes('replace_me') ||
    lowered.includes('<your_')
  ) {
    return { valid: false, reason: 'placeholder value' }
  }

  if (!(lowered.startsWith('postgres://') || lowered.startsWith('postgresql://'))) {
    return { valid: false, reason: 'must start with postgres:// or postgresql://' }
  }

  try {
    const parsed = new URL(value)
    const host = String(parsed.hostname || '').toLowerCase()
    if (!host) {
      return { valid: false, reason: 'missing host' }
    }
    if (host === 'base' || host === '__set_in_secret_manager__') {
      return { valid: false, reason: 'invalid host placeholder' }
    }
  } catch {
    return { valid: false, reason: 'invalid URL' }
  }

  return { valid: true }
}

function resolvePostgresConnectionString():
  | { source: PostgresEnvSource; connectionString: string }
  | null {
  const candidates = getPostgresEnvCandidates()
  if (candidates.length === 0) {
    return null
  }

  for (const candidate of candidates) {
    const validation = validatePostgresConnectionString(candidate.value)
    if (validation.valid) {
      return {
        source: candidate.source,
        connectionString: candidate.value.trim(),
      }
    }

    console.warn(
      `Skipping invalid ${candidate.source}: ${validation.reason || 'invalid connection string'}`
    )
  }

  return null
}

/**
 * Get database connection
 * Uses standard pg Pool with Neon/Vercel Postgres connection string
 */
export async function getDb() {
  const prismaUrl = process.env.POSTGRES_PRISMA_URL
  const postgresUrl = process.env.POSTGRES_URL
  const postgresNonPoolingUrl = process.env.POSTGRES_URL_NON_POOLING
  const databaseUrl = process.env.DATABASE_URL

  console.log('getDb() called with env vars:', {
    POSTGRES_PRISMA_URL: prismaUrl ? `SET (length: ${prismaUrl.length})` : 'NOT SET',
    POSTGRES_URL: postgresUrl ? `SET (length: ${postgresUrl.length})` : 'NOT SET',
    POSTGRES_URL_NON_POOLING: postgresNonPoolingUrl ? `SET (length: ${postgresNonPoolingUrl.length})` : 'NOT SET',
    DATABASE_URL: databaseUrl ? `SET (length: ${databaseUrl.length})` : 'NOT SET',
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL
  })

  const resolved = resolvePostgresConnectionString()
  const connectionString = resolved?.connectionString

  if (!connectionString) {
    console.error('FATAL: No valid PostgreSQL connection string found')
    console.error(
      'Postgres-related env vars:',
      Object.keys(process.env).filter((k) => k.includes('POSTGRES') || k.includes('DATABASE'))
    )
    throw new Error(
      'No valid PostgreSQL connection available. Set POSTGRES_PRISMA_URL/POSTGRES_URL/DATABASE_URL to a real postgres URL.'
    )
  }

  console.log(`Using connection string from ${resolved.source}, starting with:`, connectionString.substring(0, 40) + '...')

  if (!pool) {
    console.log('Creating new pg Pool...')
    try {
      pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: {
          rejectUnauthorized: false
        }
      })

      pool.on('error', (err) => {
        console.error('Pool error:', err)
      })

      // Test the connection immediately
      console.log('Testing connection...')
      const client = await pool.connect()
      const testResult = await client.query('SELECT NOW() as now')
      client.release()
      console.log('Database connected successfully at:', testResult.rows[0].now)
    } catch (poolError: any) {
      console.error('Failed to connect:', poolError.message)
      pool = null // Reset pool on error
      throw poolError
    }
  }

  return { type: 'pg', pool }
}

/**
 * Execute SQL query with template literal support
 * This provides a similar interface to @vercel/postgres sql template tag
 */
export async function sql(strings: TemplateStringsArray, ...values: any[]): Promise<QueryResult> {
  const db = await getDb()

  // Build parameterized query from template literal
  let query = ''
  const params: any[] = []

  for (let i = 0; i < strings.length; i++) {
    query += strings[i]
    if (i < values.length) {
      params.push(values[i])
      query += `$${params.length}`
    }
  }

  return db.pool!.query(query, params)
}

/**
 * Initialize database schema
 * Creates all necessary tables if they don't exist
 */
export async function initializeSchema() {
  try {
    const hasPostgres = !!resolvePostgresConnectionString()

    if (!hasPostgres) {
      console.warn('⚠️ No PostgreSQL connection string found. Using fallback.')
      return
    }

    const db = await getDb()

    // Using standard pg Pool for all connections
    if (db.type === 'pg' && db.pool) {
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

      await db.pool.query(`
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
          channel_arn TEXT,
          stream_key_arn TEXT,
          ingest_endpoint TEXT,
          playback_url TEXT,
          provider VARCHAR(32),
          channel_type VARCHAR(32),
          status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('offline','live')),
          updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      await db.pool.query(`
        ALTER TABLE livestreams ADD COLUMN IF NOT EXISTS channel_arn TEXT;
        ALTER TABLE livestreams ADD COLUMN IF NOT EXISTS stream_key_arn TEXT;
        ALTER TABLE livestreams ADD COLUMN IF NOT EXISTS ingest_endpoint TEXT;
        ALTER TABLE livestreams ADD COLUMN IF NOT EXISTS playback_url TEXT;
        ALTER TABLE livestreams ADD COLUMN IF NOT EXISTS provider VARCHAR(32);
        ALTER TABLE livestreams ADD COLUMN IF NOT EXISTS channel_type VARCHAR(32);
      `)

      // User sessions table for JWT token management
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
          wallet VARCHAR(255) PRIMARY KEY,
          role VARCHAR(20) NOT NULL CHECK (role IN ('TRADER','CREATOR')),
          refresh_token TEXT,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_user_sessions_wallet ON user_sessions(wallet);
        CREATE INDEX IF NOT EXISTS idx_user_sessions_role ON user_sessions(role);
      `)

      // Users table for role tracking and profiles
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          wallet VARCHAR(255) PRIMARY KEY,
          role VARCHAR(20) NOT NULL DEFAULT 'TRADER' CHECK (role IN ('TRADER','CREATOR')),
          last_role_check BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      `)


      // Creators registry table
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS creators (
          wallet VARCHAR(255) PRIMARY KEY,
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_creators_wallet ON creators(wallet);
      `)

      // Creator -> token association table
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS creator_tokens (
          token_address VARCHAR(255) PRIMARY KEY,
          creator_wallet VARCHAR(255) NOT NULL,
          coin_id VARCHAR(255),
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_creator_tokens_creator ON creator_tokens(creator_wallet);
        CREATE INDEX IF NOT EXISTS idx_creator_tokens_coin_id ON creator_tokens(coin_id);
      `)

      // Backfill creators from existing role and coin data.
      await db.pool.query(`
        INSERT INTO creators (wallet, created_at, updated_at)
        SELECT LOWER(wallet), created_at, updated_at
        FROM users
        WHERE role = 'CREATOR'
        ON CONFLICT (wallet)
        DO UPDATE SET updated_at = GREATEST(creators.updated_at, EXCLUDED.updated_at)
      `)

      await db.pool.query(`
        INSERT INTO creators (wallet, created_at, updated_at)
        SELECT src.wallet, src.created_at, src.updated_at
        FROM (
          SELECT DISTINCT ON (LOWER(creator))
            LOWER(creator) AS wallet,
            COALESCE(created_at, EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT AS created_at,
            EXTRACT(EPOCH FROM NOW()) * 1000 AS updated_at
          FROM coins
          WHERE creator IS NOT NULL AND creator <> ''
          ORDER BY LOWER(creator), COALESCE(created_at, 0) DESC
        ) src
        ON CONFLICT (wallet)
        DO UPDATE SET updated_at = GREATEST(creators.updated_at, EXCLUDED.updated_at)
      `)

      // Normalize and dedupe legacy creators rows case-insensitively.
      await db.pool.query(`
        WITH ranked AS (
          SELECT
            ctid,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(wallet)
              ORDER BY updated_at DESC, created_at DESC, wallet ASC
            ) AS rn
          FROM creators
        )
        DELETE FROM creators
        WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
      `)

      await db.pool.query(`
        UPDATE creators
        SET wallet = LOWER(wallet)
        WHERE wallet <> LOWER(wallet)
      `)

      // Backfill creator-token associations from existing coin rows.
      await db.pool.query(`
        INSERT INTO creator_tokens (token_address, creator_wallet, coin_id, created_at, updated_at)
        SELECT src.token_address, src.creator_wallet, src.coin_id, src.created_at, src.updated_at
        FROM (
          SELECT DISTINCT ON (LOWER(token_address))
            LOWER(token_address) AS token_address,
            LOWER(creator) AS creator_wallet,
            id AS coin_id,
            COALESCE(created_at, EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT AS created_at,
            EXTRACT(EPOCH FROM NOW()) * 1000 AS updated_at
          FROM coins
          WHERE token_address IS NOT NULL
            AND token_address <> ''
            AND creator IS NOT NULL
            AND creator <> ''
          ORDER BY LOWER(token_address), COALESCE(created_at, 0) DESC
        ) src
        ON CONFLICT (token_address)
        DO UPDATE SET
          creator_wallet = EXCLUDED.creator_wallet,
          coin_id = COALESCE(EXCLUDED.coin_id, creator_tokens.coin_id),
          updated_at = EXCLUDED.updated_at
      `)

      // Normalize and dedupe creator-token rows by case-insensitive token address.
      await db.pool.query(`
        WITH ranked AS (
          SELECT
            ctid,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(token_address)
              ORDER BY updated_at DESC, created_at DESC, token_address ASC
            ) AS rn
          FROM creator_tokens
        )
        DELETE FROM creator_tokens
        WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
      `)

      await db.pool.query(`
        UPDATE creator_tokens
        SET
          token_address = LOWER(token_address),
          creator_wallet = LOWER(creator_wallet)
        WHERE
          token_address <> LOWER(token_address) OR
          creator_wallet <> LOWER(creator_wallet)
      `)

      // Copy trading signals table
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS trading_signals (
          id SERIAL PRIMARY KEY,
          creator_wallet VARCHAR(255) NOT NULL,
          token_address VARCHAR(255) NOT NULL,
          signal_type VARCHAR(10) NOT NULL CHECK (signal_type IN ('BUY','SELL')),
          price_target VARCHAR(100),
          message TEXT,
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_signals_creator ON trading_signals(creator_wallet);
        CREATE INDEX IF NOT EXISTS idx_signals_token ON trading_signals(token_address);
        CREATE INDEX IF NOT EXISTS idx_signals_created ON trading_signals(created_at DESC);
      `)

      // Creator followers table
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS creator_followers (
          creator_wallet VARCHAR(255) NOT NULL,
          follower_wallet VARCHAR(255) NOT NULL,
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
          PRIMARY KEY (creator_wallet, follower_wallet)
        )
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_followers_creator ON creator_followers(creator_wallet);
        CREATE INDEX IF NOT EXISTS idx_followers_follower ON creator_followers(follower_wallet);
      `)

      // Remove duplicate creator-follower pairs regardless of case.
      await db.pool.query(`
        WITH ranked AS (
          SELECT
            ctid,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(creator_wallet), LOWER(follower_wallet)
              ORDER BY created_at DESC, creator_wallet ASC
            ) AS rn
          FROM creator_followers
        )
        DELETE FROM creator_followers
        WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
      `)

      await db.pool.query(`
        UPDATE creator_followers
        SET
          creator_wallet = LOWER(creator_wallet),
          follower_wallet = LOWER(follower_wallet)
        WHERE
          creator_wallet <> LOWER(creator_wallet) OR
          follower_wallet <> LOWER(follower_wallet)
      `)


      // Enforce one followed creator per follower wallet.
      await db.pool.query(`
        WITH ranked AS (
          SELECT
            ctid,
            ROW_NUMBER() OVER (
              PARTITION BY LOWER(follower_wallet)
              ORDER BY created_at DESC, creator_wallet ASC
            ) AS rn
          FROM creator_followers
        )
        DELETE FROM creator_followers
        WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
      `)

      await db.pool.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_followers_single_creator_per_wallet
        ON creator_followers(follower_wallet);
      `)


      // Community chat messages table
      await db.pool.query(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id BIGSERIAL PRIMARY KEY,
          sender_wallet VARCHAR(255) NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('TRADER','CREATOR')),
          room_id VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT','STICKER','SUPER_CHAT')),
          sticker_id VARCHAR(120),
          sticker_pack VARCHAR(120),
          superchat_amount VARCHAR(80),
          superchat_token VARCHAR(255),
          superchat_tx_hash VARCHAR(255),
          token_symbol VARCHAR(100),
          created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
        )
      `)

      await db.pool.query(`
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT';
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sticker_id VARCHAR(120);
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sticker_pack VARCHAR(120);
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS superchat_amount VARCHAR(80);
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS superchat_token VARCHAR(255);
        ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS superchat_tx_hash VARCHAR(255);
      `)

      await db.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
        ON chat_messages(room_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
        ON chat_messages(sender_wallet);
        CREATE INDEX IF NOT EXISTS idx_chat_messages_superchat_tx
        ON chat_messages(superchat_tx_hash);
      `)

      console.log('✅ PostgreSQL schema initialized successfully')
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
 */
export async function query(text: string, params?: any[]) {
  const db = await getDb()
  return await db.pool.query(text, params)
}

/**
 * Get the sql template tag function
 * Returns our custom sql function that works with pg Pool
 */
export async function getSql() {
  try {
    await getDb() // Ensure pool is initialized
    return sql // Return our custom sql template function
  } catch (error: any) {
    console.warn('⚠️ Cannot get Postgres SQL client:', error.message)
    return null
  }
}

/**
 * Check if PostgreSQL is configured
 */
export function isUsingVercelPostgres() {
  return !!resolvePostgresConnectionString()
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


