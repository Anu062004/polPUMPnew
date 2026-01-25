/**
 * PostgreSQL database operations for gaming features
 * Migrates gaming data from SQLite to Postgres for persistence
 */

import { initializeSchema, getSql } from './postgresManager'

export interface GamingRound {
  id: number
  createdAt: number
  endsAt: number
  candidates: string[]
  status: 'open' | 'closed' | 'resolved'
  winnerCoinId?: string
  totalPool: number
}

export interface GamingBet {
  id: number
  roundId: number
  userAddress: string
  coinId: string
  amount: number
  createdAt: number
}

export interface GamingCoinflip {
  id: number
  userAddress: string
  wager: number
  outcome: 'win' | 'lose'
  seedHash: string
  seedReveal: string
  blockNumber?: number
  blockHash?: string
  createdAt: number
}

export interface GamingMines {
  id: number
  userAddress: string
  betAmount: number
  tokenAddress: string
  minesCount: number
  gridState: string
  revealedTiles: string
  status: 'active' | 'won' | 'lost' | 'cashed_out'
  currentMultiplier: number
  cashoutAmount?: number
  createdAt: number
  completedAt?: number
}

export interface GamingMemeRoyale {
  id: number
  leftCoinId: string
  rightCoinId: string
  leftScore: number
  rightScore: number
  winnerCoinId?: string
  judge: string
  createdAt: number
}

/**
 * Initialize gaming schema in Postgres
 */
export async function initializeGamingSchema() {
  try {
    const sql = await getSql()
    if (!sql) {
      throw new Error('Postgres not available')
    }

    // Gaming PumpPlay rounds
    await sql`
      CREATE TABLE IF NOT EXISTS gaming_pumpplay_rounds (
        id SERIAL PRIMARY KEY,
        created_at BIGINT NOT NULL,
        ends_at BIGINT NOT NULL,
        candidates TEXT NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('open', 'closed', 'resolved')) DEFAULT 'open',
        winner_coin_id VARCHAR(255),
        total_pool REAL DEFAULT 0
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_pumpplay_rounds_status ON gaming_pumpplay_rounds(status)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_pumpplay_rounds_ends_at ON gaming_pumpplay_rounds(ends_at)
    `

    // Gaming PumpPlay bets
    await sql`
      CREATE TABLE IF NOT EXISTS gaming_pumpplay_bets (
        id SERIAL PRIMARY KEY,
        round_id INTEGER NOT NULL REFERENCES gaming_pumpplay_rounds(id) ON DELETE CASCADE,
        user_address VARCHAR(255) NOT NULL,
        coin_id VARCHAR(255) NOT NULL,
        amount REAL NOT NULL,
        created_at BIGINT NOT NULL
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_pumpplay_bets_round ON gaming_pumpplay_bets(round_id)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_pumpplay_bets_user ON gaming_pumpplay_bets(user_address)
    `

    // Gaming Coinflip
    await sql`
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
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_coinflip_user ON gaming_coinflip(user_address, created_at DESC)
    `

    // Gaming Mines
    await sql`
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
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_mines_user ON gaming_mines(user_address, created_at DESC)
    `
    await sql`
      CREATE INDEX IF NOT EXISTS idx_mines_status ON gaming_mines(status)
    `

    // Gaming Meme Royale
    await sql`
      CREATE TABLE IF NOT EXISTS gaming_meme_royale (
        id SERIAL PRIMARY KEY,
        left_coin_id VARCHAR(255) NOT NULL,
        right_coin_id VARCHAR(255) NOT NULL,
        left_score REAL,
        right_score REAL,
        winner_coin_id VARCHAR(255),
        judge VARCHAR(100) DEFAULT 'random-judge',
        created_at BIGINT NOT NULL
      )
    `

    await sql`
      CREATE INDEX IF NOT EXISTS idx_meme_royale_created ON gaming_meme_royale(created_at DESC)
    `

    console.log('✅ Gaming Postgres schema initialized')
  } catch (error: any) {
    console.error('❌ Failed to initialize gaming schema:', error)
    throw error
  }
}

/**
 * Get Postgres SQL client, throw if unavailable
 */
export async function requirePostgres() {
  await initializeSchema()
  await initializeGamingSchema()
  const sql = await getSql()
  if (!sql) {
    throw new Error('Postgres is required but not available. Please configure POSTGRES_PRISMA_URL.')
  }
  return sql
}




