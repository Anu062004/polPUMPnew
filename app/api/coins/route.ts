import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

// Database file path
const DB_PATH = path.join(process.cwd(), 'data', 'coins.db')

// Ensure data directory exists
async function ensureDataDir() {
  const dataDir = path.dirname(DB_PATH)
  try {
    await fs.access(dataDir)
  } catch {
    await fs.mkdir(dataDir, { recursive: true })
  }
}

// Initialize database
async function initDatabase() {
  await ensureDataDir()
  
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  })

  // Create coins table if it doesn't exist
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
      description TEXT,
      telegramUrl TEXT,
      xUrl TEXT,
      discordUrl TEXT,
      websiteUrl TEXT,
      marketCap REAL,
      price REAL,
      volume24h REAL,
      holders INTEGER,
      totalTransactions INTEGER
    )
  `)
  
  // Add curveAddress column if it doesn't exist (migration)
  try {
    await db.exec(`ALTER TABLE coins ADD COLUMN curveAddress TEXT;`)
  } catch (e) {
    // Column already exists
  }

  // Create indexes for better performance
  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_coins_created_at ON coins(createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_coins_symbol ON coins(symbol);
    CREATE INDEX IF NOT EXISTS idx_coins_creator ON coins(creator);
  `)

  // Add social media URL columns if they don't exist (migration)
  try {
    await db.exec(`
      ALTER TABLE coins ADD COLUMN telegramUrl TEXT;
    `)
  } catch (e) {
    // Column already exists, ignore error
  }
  
  try {
    await db.exec(`
      ALTER TABLE coins ADD COLUMN xUrl TEXT;
    `)
  } catch (e) {
    // Column already exists, ignore error
  }
  
  try {
    await db.exec(`
      ALTER TABLE coins ADD COLUMN discordUrl TEXT;
    `)
  } catch (e) {
    // Column already exists, ignore error
  }
  
  try {
    await db.exec(`
      ALTER TABLE coins ADD COLUMN websiteUrl TEXT;
    `)
  } catch (e) {
    // Column already exists, ignore error
  }

  return db
}

// Get database connection
async function getDatabase() {
  return await initDatabase()
}

export async function GET() {
  try {
    const db = await getDatabase()
    
    // Get all coins with additional blockchain data
    const coins = await db.all(`
      SELECT * FROM coins 
      ORDER BY createdAt DESC 
      LIMIT 50
    `)
    
    await db.close()
    
    return NextResponse.json({
      success: true,
      coins: coins,
      total: coins.length
    })
  } catch (error) {
    console.error('Failed to fetch coins:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch coins' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const coinData = await request.json()
    
    // Validate required fields
    if (!coinData.name || !coinData.symbol || !coinData.supply) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Validate optional hashes to avoid storing invalid placeholders
    const isCid = (v: any) => typeof v === 'string' && /^bafy[\w\d]+$/i.test(v)
    const isBytes32 = (v: any) => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v)
    const safeImageHash = isCid(coinData.imageHash) || isBytes32(coinData.imageHash) ? coinData.imageHash : null
    
    const db = await getDatabase()
    
    // Prevent duplicate symbols (case-insensitive)
    const existing = await db.get(
      'SELECT 1 FROM coins WHERE lower(symbol) = lower(?) LIMIT 1',
      coinData.symbol
    )
    if (existing) {
      await db.close()
      return NextResponse.json(
        { success: false, error: 'Symbol already exists' },
        { status: 409 }
      )
    }
    
    // Create new coin with metadata
    const newCoin = {
      id: `${coinData.symbol.toLowerCase()}-${Date.now()}`,
      name: coinData.name,
      symbol: coinData.symbol,
      supply: coinData.supply,
      imageHash: safeImageHash,
      tokenAddress: coinData.tokenAddress || null,
      curveAddress: coinData.curveAddress || null,
      txHash: coinData.txHash,
      creator: coinData.creator,
      createdAt: Date.now(),
      description: coinData.description || `${coinData.name} (${coinData.symbol}) - A memecoin created on Polygon Amoy`,
      // Social media URLs
      telegramUrl: coinData.telegramUrl || null,
      xUrl: coinData.xUrl || null,
      discordUrl: coinData.discordUrl || null,
      websiteUrl: coinData.websiteUrl || null,
      marketCap: null,
      price: null,
      volume24h: null,
      holders: null,
      totalTransactions: null
    }
    
    // Insert into database
    await db.run(`
      INSERT INTO coins (
        id, name, symbol, supply, imageHash, tokenAddress, curveAddress, txHash, 
        creator, createdAt, description, telegramUrl, xUrl, discordUrl, websiteUrl,
        marketCap, price, volume24h, holders, totalTransactions
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newCoin.id, newCoin.name, newCoin.symbol, newCoin.supply,
      newCoin.imageHash, newCoin.tokenAddress, newCoin.curveAddress, newCoin.txHash,
      newCoin.creator, newCoin.createdAt, newCoin.description,
      newCoin.telegramUrl, newCoin.xUrl, newCoin.discordUrl, newCoin.websiteUrl,
      newCoin.marketCap, newCoin.price, newCoin.volume24h,
      newCoin.holders, newCoin.totalTransactions
    ])
    
    await db.close()
    
    console.log('New coin added to database:', newCoin)
    
    return NextResponse.json({
      success: true,
      coin: newCoin,
      message: 'Coin added successfully'
    })
  } catch (error) {
    console.error('Failed to add coin:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add coin' },
      { status: 500 }
    )
  }
}

// Danger zone: delete coins (for resets). Security:
// - If ADMIN_SECRET is set, require it as ?secret=...
// - If not set, allow only when not in production
// - Supports ?keep=PEPA to keep only coins with symbol PEPA
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const provided = url.searchParams.get('secret') || ''
    const keepSymbol = url.searchParams.get('keep') || ''
    const adminSecret = process.env.ADMIN_SECRET

    if (adminSecret) {
      if (provided !== adminSecret) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ success: false, error: 'Not allowed in production without ADMIN_SECRET' }, { status: 403 })
    }

    const db = await getDatabase()
    
    if (keepSymbol) {
      // Delete all coins except those with the specified symbol (case-insensitive)
      const result = await db.run(
        'DELETE FROM coins WHERE LOWER(symbol) != LOWER(?)',
        [keepSymbol]
      )
      await db.close()
      
      return NextResponse.json({ 
        success: true, 
        message: `All coins deleted except ${keepSymbol}`,
        deleted: result.changes 
      })
    } else {
      // Delete all coins
      await db.exec('DELETE FROM coins')
      await db.close()
      
      return NextResponse.json({ success: true, message: 'All coins deleted' })
    }
  } catch (error) {
    console.error('Failed to delete coins:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete coins' },
      { status: 500 }
    )
  }
}
