/**
 * Centralized database connection management for POL Pump Gaming Backend
 * 
 * Provides singleton database connections with automatic table initialization.
 * All route handlers should use these functions instead of creating their own connections.
 */

import { promises as fs } from 'fs'
import { open, Database } from 'sqlite'
import sqlite3 from 'sqlite3'
import { config } from './config'

// Database connection cache (singleton pattern)
let gamingDb: Database | null = null
let coinsDb: Database | null = null

/**
 * Ensure data directory exists
 */
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(config.database.dataDir)
  } catch {
    await fs.mkdir(config.database.dataDir, { recursive: true })
    console.log(`📁 Created data directory: ${config.database.dataDir}`)
  }
}

/**
 * Initialize gaming database schema
 * Creates all tables if they don't exist (safe to call multiple times)
 */
async function initializeGamingSchema(db: Database): Promise<void> {
  await db.exec(`
    -- PumpPlay rounds
    CREATE TABLE IF NOT EXISTS gaming_pumpplay_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      endsAt INTEGER NOT NULL,
      candidates TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('open','closed','resolved')) DEFAULT 'open',
      winnerCoinId TEXT,
      totalPool REAL DEFAULT 0
    );

    -- PumpPlay bets
    CREATE TABLE IF NOT EXISTS gaming_pumpplay_bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roundId INTEGER NOT NULL,
      userAddress TEXT NOT NULL,
      coinId TEXT NOT NULL,
      amount REAL NOT NULL,
      tokenAddress TEXT,
      txHash TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (roundId) REFERENCES gaming_pumpplay_rounds(id) ON DELETE CASCADE
    );

    -- Meme Royale battles
    CREATE TABLE IF NOT EXISTS gaming_meme_royale (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leftCoinId TEXT NOT NULL,
      rightCoinId TEXT NOT NULL,
      leftScore REAL,
      rightScore REAL,
      winnerCoinId TEXT,
      judge TEXT DEFAULT 'random-judge',
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- Coinflip games
    CREATE TABLE IF NOT EXISTS gaming_coinflip (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userAddress TEXT NOT NULL,
      wager REAL NOT NULL,
      choice TEXT NOT NULL,
      outcome TEXT NOT NULL,
      result TEXT NOT NULL,
      seedHash TEXT,
      seedReveal TEXT,
      blockNumber INTEGER,
      blockHash TEXT,
      tokenAddress TEXT,
      txHash TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    );

    -- Mines games
    CREATE TABLE IF NOT EXISTS gaming_mines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userAddress TEXT NOT NULL,
      betAmount REAL NOT NULL,
      tokenAddress TEXT NOT NULL,
      minesCount INTEGER NOT NULL,
      gridState TEXT NOT NULL,
      revealedTiles TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active','won','lost','cashed_out')) DEFAULT 'active',
      currentMultiplier REAL DEFAULT 1.0,
      cashoutAmount REAL,
      cashoutTx TEXT,
      createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      completedAt INTEGER
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_pumpplay_rounds_status ON gaming_pumpplay_rounds(status);
    CREATE INDEX IF NOT EXISTS idx_pumpplay_bets_round ON gaming_pumpplay_bets(roundId);
    CREATE INDEX IF NOT EXISTS idx_pumpplay_bets_user ON gaming_pumpplay_bets(userAddress);
    CREATE INDEX IF NOT EXISTS idx_meme_royale_created ON gaming_meme_royale(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_coinflip_user ON gaming_coinflip(userAddress);
    CREATE INDEX IF NOT EXISTS idx_coinflip_created ON gaming_coinflip(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_mines_user ON gaming_mines(userAddress);
    CREATE INDEX IF NOT EXISTS idx_mines_status ON gaming_mines(status);
  `)
}

/**
 * Initialize coins database schema
 * Creates coins table if it doesn't exist (safe to call multiple times)
 */
async function initializeCoinsSchema(db: Database): Promise<void> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS coins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      supply TEXT NOT NULL,
      imageHash TEXT,
      tokenAddress TEXT,
      curveAddress TEXT,
      txHash TEXT NOT NULL,
      creator TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      description TEXT
    )
  `)
}

/**
 * Get or create gaming database connection
 * Initializes schema on first connection
 */
export async function getGamingDatabase(): Promise<Database> {
  if (gamingDb) {
    return gamingDb
  }

  await ensureDataDir()

  gamingDb = await open({
    filename: config.database.gamingDbPath,
    driver: sqlite3.Database
  })

  await initializeGamingSchema(gamingDb)
  console.log('✅ Gaming database initialized')

  return gamingDb
}

/**
 * Get or create coins database connection
 * Initializes schema on first connection
 */
export async function getCoinsDatabase(): Promise<Database> {
  if (coinsDb) {
    return coinsDb
  }

  await ensureDataDir()

  coinsDb = await open({
    filename: config.database.coinsDbPath,
    driver: sqlite3.Database
  })

  await initializeCoinsSchema(coinsDb)
  console.log('✅ Coins database initialized')

  return coinsDb
}

/**
 * Close all database connections
 * Useful for graceful shutdown
 */
export async function closeDatabases(): Promise<void> {
  if (gamingDb) {
    await gamingDb.close()
    gamingDb = null
    console.log('📪 Gaming database closed')
  }

  if (coinsDb) {
    await coinsDb.close()
    coinsDb = null
    console.log('📪 Coins database closed')
  }
}

/**
 * Run database migrations (placeholder for future migrations)
 * This can be expanded to handle schema changes
 */
export async function runMigrations(): Promise<void> {
  // Future migrations can be added here
  // For now, schema is handled by IF NOT EXISTS in initialization
  console.log('✅ Database migrations completed (no migrations needed)')
}


