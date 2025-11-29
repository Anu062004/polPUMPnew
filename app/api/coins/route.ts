import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from '../../../lib/contract-config'

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

// Database file path + chain metadata
const DB_PATH = getDbPath()
const RPC_URL =
  process.env.NEXT_PUBLIC_EVM_RPC ||
  process.env.POLYGON_AMOY_RPC ||
  'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'

const FACTORY_ABI = [
  'event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens)',
]

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
    // Use PostgreSQL instead of SQLite
    const { sql } = await import('@vercel/postgres')
    const { initializeSchema } = await import('../../../lib/postgresManager')
    
    // Initialize schema if needed
    await initializeSchema()

    // Get all coins with additional blockchain data
    // We'll deduplicate in code to ensure we get the most recent version of each unique coin
    const result = await sql`
      SELECT * FROM coins 
      ORDER BY created_at DESC 
      LIMIT 100
    `
    const allCoins = result.rows
    
    // Deduplicate: keep the most recent entry for each unique coin
    const coinMap = new Map<string, any>()
    for (const coin of allCoins) {
      // Map PostgreSQL column names to camelCase for compatibility
      const mappedCoin = {
        ...coin,
        tokenAddress: coin.token_address,
        curveAddress: coin.curve_address,
        txHash: coin.tx_hash,
        createdAt: coin.created_at,
        imageHash: coin.image_hash,
        telegramUrl: coin.telegram_url,
        xUrl: coin.x_url,
        discordUrl: coin.discord_url,
        websiteUrl: coin.website_url,
        marketCap: coin.market_cap,
        volume24h: coin.volume_24h,
        totalTransactions: coin.total_transactions,
      }
      
      const key = mappedCoin.tokenAddress?.toLowerCase() || 
                  mappedCoin.id?.toLowerCase() || 
                  `${mappedCoin.symbol?.toLowerCase()}-${mappedCoin.name?.toLowerCase()}` || 
                  mappedCoin.txHash?.toLowerCase() || 
                  ''
      
      if (key && !coinMap.has(key)) {
        coinMap.set(key, mappedCoin)
      }
    }
    
    const coins = Array.from(coinMap.values()).slice(0, 50)

    await backfillCoinAddresses(sql, coins)

    // Deduplicate coins based on unique identifiers
    const seen = new Set<string>()
    const uniqueCoins: any[] = []
    
    for (const coin of coins) {
      // Create unique key from tokenAddress, id, or symbol+name
      const key = coin.tokenAddress?.toLowerCase() || 
                  coin.id?.toLowerCase() || 
                  `${coin.symbol?.toLowerCase()}-${coin.name?.toLowerCase()}` || 
                  coin.txHash?.toLowerCase() || 
                  ''
      
      if (key && !seen.has(key)) {
        seen.add(key)
        uniqueCoins.push(coin)
      }
    }

    return NextResponse.json({
      success: true,
      coins: uniqueCoins,
      total: uniqueCoins.length
    })
  } catch (error) {
    console.error('Failed to fetch coins:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch coins' },
      { status: 500 }
    )
  }
}

async function backfillCoinAddresses(sql: any, coins: any[]) {
  if (!coins?.length) return coins

  const unresolved = coins.filter(
    (coin) =>
      (!coin.tokenAddress || !coin.curveAddress) &&
      coin.txHash &&
      typeof coin.txHash === 'string' &&
      coin.txHash.startsWith('0x')
  )

  if (unresolved.length === 0) return coins

  const provider = new ethers.JsonRpcProvider(RPC_URL)
  const factoryAddress = (CONTRACT_CONFIG.FACTORY_ADDRESS || '').toLowerCase()
  const iface = new ethers.Interface(FACTORY_ABI)
  const pairCreatedTopic = iface.getEvent('PairCreated')!.topicHash

  for (const coin of unresolved) {
    try {
      let resolved = await resolveAddressesFromChain({
        provider,
        txHash: coin.txHash,
        factoryAddress,
        pairCreatedTopic,
        iface,
      })

      // If we have tokenAddress but no curveAddress, try to get it from the token's minter()
      if (coin.tokenAddress && !resolved?.curveAddress && ethers.isAddress(coin.tokenAddress)) {
        try {
          const MEME_TOKEN_ABI = ['function minter() external view returns (address)']
          const tokenContract = new ethers.Contract(coin.tokenAddress, MEME_TOKEN_ABI, provider)
          const minter = await tokenContract.minter()
          if (minter && minter !== ethers.ZeroAddress) {
            resolved = {
              tokenAddress: coin.tokenAddress.toLowerCase(),
              curveAddress: minter.toLowerCase()
            }
            console.log('✅ Resolved curve from token minter():', minter)
          }
        } catch (e) {
          console.warn('Failed to get minter from token:', e)
        }
      }

      if (resolved?.tokenAddress && resolved?.curveAddress) {
        await sql`
          UPDATE coins 
          SET token_address = ${resolved.tokenAddress}, curve_address = ${resolved.curveAddress} 
          WHERE id = ${coin.id}
        `
        coin.tokenAddress = resolved.tokenAddress
        coin.curveAddress = resolved.curveAddress
        console.log('✅ Backfilled addresses for coin:', coin.id, resolved)
      }
    } catch (error) {
      console.warn('Failed to backfill coin addresses:', coin?.id, error)
    }
  }

  return coins
}

async function resolveAddressesFromChain({
  provider,
  txHash,
  factoryAddress,
  pairCreatedTopic,
  iface,
}: {
  provider: ethers.JsonRpcProvider
  txHash: string
  factoryAddress?: string
  pairCreatedTopic: string
  iface: ethers.Interface
}) {
  const receipt = await provider.getTransactionReceipt(txHash)
  if (!receipt) {
    return null
  }

  const normalizedFactory = factoryAddress || ''

  const relevantLogs = receipt.logs?.filter((log: any) => {
    if (!normalizedFactory) return true
    return log.address?.toLowerCase() === normalizedFactory
  })

  let parsedAddresses = parsePairCreatedLogs(relevantLogs, iface, pairCreatedTopic)

  if (!parsedAddresses?.tokenAddress || !parsedAddresses?.curveAddress) {
    // Retry by querying nearby blocks if receipt logs didn't include the event
    const blockNumber = receipt.blockNumber || 0
    const fromBlock = blockNumber > 25 ? blockNumber - 25 : 0
    const toBlock = blockNumber + 25

    const logs = await provider.getLogs({
      fromBlock,
      toBlock,
      address: normalizedFactory || undefined,
      topics: [pairCreatedTopic],
    })

    parsedAddresses = parsePairCreatedLogs(logs, iface, pairCreatedTopic)
  }

  return parsedAddresses
}

function parsePairCreatedLogs(
  logs: any[] = [],
  iface: ethers.Interface,
  pairCreatedTopic: string
) {
  if (!logs?.length) return null

  for (const log of logs) {
    try {
      if (log.topics?.[0] !== pairCreatedTopic) continue
      const parsed = iface.parseLog(log)
      if (parsed?.name === 'PairCreated') {
        return {
          tokenAddress: parsed.args[0]?.toLowerCase(),
          curveAddress: parsed.args[1]?.toLowerCase(),
        }
      }
    } catch {
      // Ignore parse errors and continue
    }
  }

  return null
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

    if (!coinData.tokenAddress || !ethers.isAddress(coinData.tokenAddress)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Token creation has not finished on-chain yet. Please wait for the Polygon transaction to confirm before saving.',
        },
        { status: 400 }
      )
    }

    if (!coinData.curveAddress || !ethers.isAddress(coinData.curveAddress)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bonding curve address missing. Ensure the factory transaction is confirmed before continuing.',
        },
        { status: 400 }
      )
    }

    if (!coinData.txHash || !ethers.isHexString(coinData.txHash, 32)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid transaction hash. Please provide the confirmed Polygon transaction hash.',
        },
        { status: 400 }
      )
    }

    let normalizedTokenAddress: string
    let normalizedCurveAddress: string
    try {
      normalizedTokenAddress = ethers.getAddress(coinData.tokenAddress)
      normalizedCurveAddress = ethers.getAddress(coinData.curveAddress)
    } catch (e: any) {
      return NextResponse.json(
        {
          success: false,
          error: `Failed to normalize addresses: ${e?.message || 'invalid address'}`,
        },
        { status: 400 }
      )
    }
    
    // Validate optional hashes to avoid storing invalid placeholders
    const isCid = (v: any) => typeof v === 'string' && /^bafy[\w\d]+$/i.test(v)
    const isBytes32 = (v: any) => typeof v === 'string' && /^0x[0-9a-fA-F]{64}$/.test(v)
    const safeImageHash = isCid(coinData.imageHash) || isBytes32(coinData.imageHash) ? coinData.imageHash : null
    
    // Use PostgreSQL instead of SQLite
    const { sql } = await import('@vercel/postgres')
    const { initializeSchema } = await import('../../../lib/postgresManager')
    
    // Initialize schema if needed
    await initializeSchema()
    
    // Check if coin already exists (by symbol or token_address)
    const existingBySymbol = await sql`
      SELECT id, token_address FROM coins 
      WHERE LOWER(symbol) = LOWER(${coinData.symbol}) 
      LIMIT 1
    `
    
    const existingByToken = await sql`
      SELECT id FROM coins 
      WHERE LOWER(token_address) = LOWER(${normalizedTokenAddress})
      LIMIT 1
    `
    
    // If exists by token address, it's a duplicate
    if (existingByToken.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Token address already exists in database' },
        { status: 409 }
      )
    }
    
    const createdAt = Date.now()
    const description = coinData.description || `${coinData.name} (${coinData.symbol}) - A memecoin created on Polygon Amoy`
    
    // If coin exists by symbol but has no token_address, update it
    if (existingBySymbol.rows.length > 0 && !existingBySymbol.rows[0].token_address) {
      const existingId = existingBySymbol.rows[0].id
      
      // Update existing coin with token addresses
      await sql`
        UPDATE coins 
        SET 
          token_address = ${normalizedTokenAddress},
          curve_address = ${normalizedCurveAddress},
          tx_hash = ${coinData.txHash},
          image_hash = ${safeImageHash},
          description = ${description},
          telegram_url = ${coinData.telegramUrl || null},
          x_url = ${coinData.xUrl || null},
          discord_url = ${coinData.discordUrl || null},
          website_url = ${coinData.websiteUrl || null},
          updated_at = ${createdAt}
        WHERE id = ${existingId}
      `
      
      console.log(`✅ Updated existing coin ${existingId} with token address: ${normalizedTokenAddress}`)
      
      return NextResponse.json({
        success: true,
        coin: {
          id: existingId,
          name: coinData.name,
          symbol: coinData.symbol,
          supply: coinData.supply,
          imageHash: safeImageHash,
          tokenAddress: normalizedTokenAddress,
          curveAddress: normalizedCurveAddress,
          txHash: coinData.txHash,
          creator: coinData.creator,
          createdAt: new Date(createdAt).toISOString(),
          description
        },
        message: 'Coin updated successfully'
      })
    }
    
    // If exists by symbol and already has token_address, it's a duplicate
    if (existingBySymbol.rows.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Symbol already exists' },
        { status: 409 }
      )
    }
    
    // Create new coin
    const coinId = `${coinData.symbol.toLowerCase()}-${createdAt}`
    
    await sql`
      INSERT INTO coins (
        id, name, symbol, supply, image_hash, token_address, curve_address, tx_hash, 
        creator, created_at, description, telegram_url, x_url, discord_url, website_url
      ) VALUES (
        ${coinId}, ${coinData.name}, ${coinData.symbol}, ${coinData.supply},
        ${safeImageHash}, ${normalizedTokenAddress}, ${normalizedCurveAddress}, ${coinData.txHash},
        ${coinData.creator}, ${createdAt}, ${description},
        ${coinData.telegramUrl || null}, ${coinData.xUrl || null},
        ${coinData.discordUrl || null}, ${coinData.websiteUrl || null}
      )
    `
    
    console.log(`✅ New coin added to PostgreSQL: ${coinId} with token address: ${normalizedTokenAddress}`)
    
    const newCoin = {
      id: coinId,
      name: coinData.name,
      symbol: coinData.symbol,
      supply: coinData.supply,
      imageHash: safeImageHash,
      tokenAddress: normalizedTokenAddress,
      curveAddress: normalizedCurveAddress,
      txHash: coinData.txHash,
      creator: coinData.creator,
      createdAt: new Date(createdAt).toISOString(),
      description
    }
    
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
