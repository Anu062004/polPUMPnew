/**
 * Livestream database operations
 * Manages persistent storage of livestream state per token
 */

import { promises as fs } from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { buildLivestreamUrls } from './livestreamHelpers'

// Helper function to get database path (handles serverless environments)
function getDbPath() {
  const isServerless = process.env.VERCEL === '1' || 
                      process.env.AWS_LAMBDA_FUNCTION_NAME || 
                      process.env.NEXT_RUNTIME === 'nodejs'
  
  if (isServerless) {
    return '/tmp/data/coins.db'
  }
  return path.join(process.cwd(), 'data', 'coins.db')
}

const DB_PATH = getDbPath()

export interface LivestreamRecord {
  tokenAddress: string
  creatorAddress: string
  streamKey: string
  ingestBaseUrl: string
  playbackBaseUrl: string
  status: 'offline' | 'live'
  updatedAt: number
}

async function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

async function getDatabase() {
  await ensureDataDir()
  
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  })

  // Create livestreams table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS livestreams (
      tokenAddress TEXT PRIMARY KEY,
      creatorAddress TEXT NOT NULL,
      streamKey TEXT NOT NULL,
      ingestBaseUrl TEXT NOT NULL,
      playbackBaseUrl TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('offline', 'live')),
      updatedAt INTEGER NOT NULL
    )
  `)

  // Create index for faster lookups
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_livestreams_creator ON livestreams(creatorAddress);
    CREATE INDEX IF NOT EXISTS idx_livestreams_status ON livestreams(status);
  `)

  return db
}

/**
 * Get livestream record for a token
 */
export async function getLivestream(tokenAddress: string): Promise<LivestreamRecord | null> {
  const db = await getDatabase()
  try {
    // Use case-insensitive matching
    const record = await db.get(
      'SELECT * FROM livestreams WHERE LOWER(tokenAddress) = LOWER(?)',
      tokenAddress
    )
    return record as LivestreamRecord | null
  } finally {
    await db.close()
  }
}

/**
 * Create or update livestream record
 * 
 * @param tokenAddress - Token contract address
 * @param creatorAddress - Creator wallet address
 * @param status - 'live' or 'offline'
 * @param streamKey - Optional stream key (if not provided, will be generated)
 * @param ingestBaseUrl - Optional RTMP base URL (if not provided, will use default)
 * @param playbackBaseUrl - Optional HLS base URL (if not provided, will use default)
 */
export async function upsertLivestream(
  tokenAddress: string,
  creatorAddress: string,
  status: 'offline' | 'live',
  streamKey?: string,
  ingestBaseUrl?: string,
  playbackBaseUrl?: string
): Promise<LivestreamRecord> {
  const db = await getDatabase()
  
  try {
    // Check if record exists (case-insensitive)
    const existing = await db.get(
      'SELECT * FROM livestreams WHERE LOWER(tokenAddress) = LOWER(?)',
      tokenAddress
    )
    
    // Use provided values or build from defaults
    let finalStreamKey = streamKey
    let finalIngestBaseUrl = ingestBaseUrl
    let finalPlaybackBaseUrl = playbackBaseUrl
    
    if (!finalStreamKey || !finalIngestBaseUrl || !finalPlaybackBaseUrl) {
      // Build URLs if not provided
      const urls = buildLivestreamUrls(tokenAddress)
      finalStreamKey = finalStreamKey || urls.streamKey
      finalIngestBaseUrl = finalIngestBaseUrl || urls.ingestBaseUrl
      finalPlaybackBaseUrl = finalPlaybackBaseUrl || urls.playbackBaseUrl
    }
    
    if (existing) {
      // Update existing record
      // Only update streamKey/URLs if provided (for new streams)
      if (streamKey || ingestBaseUrl || playbackBaseUrl) {
        await db.run(
          `UPDATE livestreams 
           SET creatorAddress = ?, streamKey = ?, ingestBaseUrl = ?, playbackBaseUrl = ?, status = ?, updatedAt = ?
           WHERE LOWER(tokenAddress) = LOWER(?)`,
          [
            creatorAddress.toLowerCase(),
            finalStreamKey,
            finalIngestBaseUrl,
            finalPlaybackBaseUrl,
            status,
            Date.now(),
            tokenAddress
          ]
        )
      } else {
        // Just update status if no new stream key provided
        await db.run(
          `UPDATE livestreams 
           SET status = ?, updatedAt = ?
           WHERE LOWER(tokenAddress) = LOWER(?)`,
          [status, Date.now(), tokenAddress]
        )
      }
      
      return {
        tokenAddress: tokenAddress.toLowerCase(),
        creatorAddress: creatorAddress.toLowerCase(),
        streamKey: finalStreamKey,
        ingestBaseUrl: finalIngestBaseUrl,
        playbackBaseUrl: finalPlaybackBaseUrl,
        status,
        updatedAt: Date.now(),
      }
    } else {
      // Create new record
      await db.run(
        `INSERT INTO livestreams 
         (tokenAddress, creatorAddress, streamKey, ingestBaseUrl, playbackBaseUrl, status, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          tokenAddress.toLowerCase(),
          creatorAddress.toLowerCase(),
          finalStreamKey,
          finalIngestBaseUrl,
          finalPlaybackBaseUrl,
          status,
          Date.now(),
        ]
      )
      
      return {
        tokenAddress: tokenAddress.toLowerCase(),
        creatorAddress: creatorAddress.toLowerCase(),
        streamKey: finalStreamKey,
        ingestBaseUrl: finalIngestBaseUrl,
        playbackBaseUrl: finalPlaybackBaseUrl,
        status,
        updatedAt: Date.now(),
      }
    }
  } finally {
    await db.close()
  }
}

/**
 * Get token creator from database or on-chain
 */
export async function getTokenCreator(tokenAddress: string): Promise<string | null> {
  const db = await getDatabase()
  try {
    // First try database
    const coin = await db.get(
      'SELECT creator FROM coins WHERE tokenAddress = ? OR LOWER(tokenAddress) = LOWER(?)',
      [tokenAddress, tokenAddress]
    )
    if (coin?.creator) {
      return coin.creator
    }
    
    // If not in database, try on-chain lookup
    try {
      const { ethers } = await import('ethers')
      const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                     process.env.RPC_URL || 
                     'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      
      // Try to get creator from token contract (for OGToken contracts)
      const optionalAbi = ['function creator() view returns (address)']
      const contract = new ethers.Contract(tokenAddress, optionalAbi, provider)
      
      try {
        const creator = await contract.creator()
        if (creator && creator !== ethers.ZeroAddress) {
          return creator
        }
      } catch {
        // creator() function not available, that's okay
      }
    } catch (e) {
      // On-chain lookup failed, that's okay
      console.warn('Failed to get creator on-chain:', e)
    }
    
    return null
  } finally {
    await db.close()
  }
}

