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
        // Prefer pooled connection (POSTGRES_PRISMA_URL), fallback to direct connection
        // createClient() automatically reads from env vars if no connectionString is provided
        // It handles both pooled and non-pooled connections correctly
        vercelClient = createClient()
      } catch (error: any) {
        console.error('Failed to create Vercel Postgres client:', error)
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
    if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
      console.warn('⚠️ No PostgreSQL connection string found. Using fallback.')
      return
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
  } catch (error) {
    console.error('❌ Schema initialization failed:', error)
    throw error
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
 */
export async function getSql() {
  const db = await getDb()
  if (db.type === 'vercel') {
    return db.sql
  }
  throw new Error('Not using Vercel Postgres')
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

