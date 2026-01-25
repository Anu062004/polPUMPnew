import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { initializeSchema, getSql } from '@/lib/postgresManager'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

// MemeToken ABI (from bonding curve system)
const MEME_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

const allowSqliteFallback =
  process.env.NODE_ENV !== 'production' &&
  process.env.ALLOW_SQLITE_FALLBACK !== '0'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 120 // Increased for gaming page auto-refresh
const rateBuckets = new Map<string, { count: number; reset: number }>()

function getClientKey(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.ip ||
    'unknown'
  return `gaming-coins:${ip}`
}

function enforceRateLimit(request: NextRequest) {
  const key = getClientKey(request)
  const now = Date.now()
  const bucket = rateBuckets.get(key) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS }
  if (bucket.reset < now) {
    bucket.count = 0
    bucket.reset = now + RATE_LIMIT_WINDOW_MS
  }
  bucket.count += 1
  rateBuckets.set(key, bucket)
  if (bucket.count > RATE_LIMIT_MAX) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }
  return null
}

// Get token balance for a user
async function getTokenBalance(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  try {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const balance = await token.balanceOf(userAddress)
    const decimals = await token.decimals().catch(() => 18) // Default to 18 if decimals() fails
    return ethers.formatUnits(balance, decimals)
  } catch (error: any) {
    console.warn(`Failed to get balance for ${tokenAddress}:`, error.message)
    return '0'
  }
}

export const dynamic = 'force-dynamic'

async function loadCoinsFromSqlite() {
  try {
    if (!allowSqliteFallback) {
      console.warn('SQLite fallback disabled; returning empty coin list')
      return []
    }
    // Use the same database path logic as the coins API
    const isServerless = process.env.VERCEL === '1' || 
                        process.env.AWS_LAMBDA_FUNCTION_NAME || 
                        process.env.NEXT_RUNTIME === 'nodejs'
    
    const dbPath = isServerless 
      ? '/tmp/data/coins.db'
      : path.join(process.cwd(), 'data', 'coins.db')
    
    const fs = await import('fs/promises')
    
    // Check if database file exists
    try {
      await fs.access(dbPath)
      console.log(`📂 Reading SQLite database from: ${dbPath}`)
    } catch {
      console.log('⚠️ SQLite database file does not exist:', dbPath)
      // Try to create the directory if it doesn't exist
      try {
        await fs.mkdir(path.dirname(dbPath), { recursive: true })
        console.log(`📁 Created data directory: ${path.dirname(dbPath)}`)
      } catch (mkdirError) {
        console.warn('⚠️ Could not create data directory:', mkdirError)
      }
      return []
    }

    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })

    // Get all coins from SQLite - include ALL tokens regardless of status
    // Get ALL coins from SQLite - no filtering, include everything
    // Removed limit to show ALL coins
    const rows = await db.all<any[]>(
      `SELECT * FROM coins ORDER BY createdAt DESC`
    )

    await db.close()

    console.log(`📊 SQLite query returned ${rows.length} rows from ${dbPath}`)
    if (rows.length > 0) {
      console.log(`📋 SQLite coin symbols:`, rows.map((r: any) => r.symbol).join(', '))
      console.log(`📋 SQLite coin names:`, rows.map((r: any) => r.name).join(', '))
    }

    return rows.map((coin: any) => ({
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      supply: coin.supply,
      imageHash: coin.imageHash,
      tokenAddress: coin.tokenAddress,
      curveAddress: coin.curveAddress,
      txHash: coin.txHash,
      creator: coin.creator,
      createdAt: coin.createdAt,
      description: coin.description,
    }))
  } catch (error: any) {
    console.error('❌ SQLite fallback for gaming coins failed:', error?.message || error)
    return []
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> | { address: string } }
) {
  try {
    const rl = enforceRateLimit(request)
    if (rl) return rl

    // Handle both sync and async params (Next.js 13+ uses async params)
    const resolvedParams = params instanceof Promise ? await params : params
    const userAddress = resolvedParams.address

    console.log(`🔍 Gaming coins API called with address: ${userAddress}`)

    if (!userAddress || !ethers.isAddress(userAddress)) {
      console.error(`❌ Invalid address provided: ${userAddress}`)
      return NextResponse.json(
        { success: false, error: 'Invalid address', coins: [], userHoldings: [], totalCoins: 0, coinsWithBalance: 0 },
        { status: 400 }
      )
    }

    // Get RPC provider
    const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                   process.env.POLYGON_AMOY_RPC || 
                   'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
    
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Initialize PostgreSQL schema if needed
    // If this fails, we'll fall back to SQLite
    try {
      await initializeSchema()
    } catch (schemaError: any) {
      // If it's a connection/client error, log it but don't break - we'll use SQLite fallback
      if (schemaError.code === 'invalid_connection_string' || 
          schemaError.message?.includes('connection string') ||
          schemaError.message?.includes('POSTGRES_PRISMA_URL') ||
          schemaError.message?.includes('not properly initialized') ||
          schemaError.message?.includes('Cannot read properties')) {
        console.warn('⚠️ PostgreSQL connection/client issue, will use SQLite fallback:', schemaError.message)
        console.warn('⚠️ Error type:', schemaError.constructor?.name || typeof schemaError)
      } else {
        console.warn('⚠️ Schema initialization warning (may already exist):', schemaError.message)
      }
      // Don't throw - let the code continue to SQLite fallback
    }
    
    // Get all coins from PostgreSQL database - show ALL created tokens
    let coins: any[] = []
    let usedPostgres = false
    try {
      // Get SQL client for Vercel Postgres
      const sql = await getSql()
      
      // If sql is null, Postgres is not available - skip to SQLite fallback
      if (!sql) {
        console.log('📊 Postgres not available, skipping to SQLite fallback')
        throw new Error('Postgres not available')
      }
      
      // Get all coins, regardless of token_address status
      // Removed limit to show ALL coins
      const result = await sql`
        SELECT * FROM coins 
        ORDER BY created_at DESC
      `
      
      // Vercel Postgres sql template returns array directly, not { rows: [...] }
      const rows = Array.isArray(result) ? result : (result as any).rows || []
      console.log(`📊 PostgreSQL query returned ${rows.length} rows`)
      
      coins = rows.map((coin: any) => ({
        ...coin,
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
        supply: coin.supply,
        imageHash: coin.image_hash,
        tokenAddress: coin.token_address,
        curveAddress: coin.curve_address,
        txHash: coin.tx_hash,
        creator: coin.creator,
        createdAt: coin.created_at,
        description: coin.description
      }))
      usedPostgres = true
      console.log(`✅ Fetched ${coins.length} coins from PostgreSQL (including pending)`)
      if (coins.length > 0) {
        console.log(`📝 Sample coin:`, { id: coins[0].id, name: coins[0].name, symbol: coins[0].symbol, tokenAddress: coins[0].tokenAddress })
      }
    } catch (dbError: any) {
      console.warn('⚠️ PostgreSQL query failed:', dbError?.message || dbError)
      // On PostgreSQL failure, fall back to local SQLite database only when allowed
      if (allowSqliteFallback) {
        coins = await loadCoinsFromSqlite()
      } else {
        return NextResponse.json(
          {
            success: false,
            error: 'Database unavailable and SQLite fallback disabled',
            coins: [],
            userHoldings: [],
            totalCoins: 0,
            coinsWithBalance: 0
          },
          { status: 500 }
        )
      }
    }

    // If Postgres succeeded but returned no rows, try SQLite fallback (local dev only)
    // Note: On Vercel, SQLite is ephemeral and won't persist data
    if (usedPostgres && coins.length === 0) {
      console.log('📊 PostgreSQL returned 0 rows, trying SQLite fallback (local dev only)...')
      if (allowSqliteFallback) {
        const sqliteCoins = await loadCoinsFromSqlite()
        if (sqliteCoins.length > 0) {
          console.log(`✅ SQLite fallback found ${sqliteCoins.length} coins`)
          coins = sqliteCoins
        } else {
          console.warn('⚠️ No coins found in Postgres or SQLite. On Vercel, ensure POSTGRES_PRISMA_URL is configured and coins are saved to Postgres when created.')
        }
      }
    } else if (!usedPostgres && coins.length > 0) {
      console.log(`✅ Using SQLite data: ${coins.length} coins found`)
    }
    
    // Ensure we have coins - log what we found
    console.log(`📊 Total coins loaded: ${coins.length}`)
    if (coins.length > 0) {
      console.log(`📋 Coin symbols:`, coins.map(c => c.symbol).join(', '))
      console.log(`📋 Coin names:`, coins.map(c => c.name).join(', '))
    } else {
      console.warn('⚠️ No coins found in database!')
    }

    // Fetch balances for all coins in parallel (with rate limiting)
    const userHoldings: any[] = []
    const coinsWithData: any[] = []

    // Process coins in batches to avoid rate limits
    const batchSize = 10
    for (let i = 0; i < coins.length; i += batchSize) {
      const batch = coins.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (coin: any) => {
          try {
            // Include all coins, even without tokenAddress
            // For coins without tokenAddress, skip balance check but still include them
            if (!coin.tokenAddress) {
              // Add coin without balance check
              coinsWithData.push({
                id: coin.id || coin.txHash,
                name: coin.name,
                symbol: coin.symbol,
                tokenAddress: null,
                curveAddress: coin.curveAddress || null,
                imageHash: coin.imageHash,
                description: coin.description,
                createdAt: coin.createdAt,
                creator: coin.creator,
                txHash: coin.txHash,
                supply: coin.supply,
                isPending: true // Mark as pending
              })
              return
            }

            const balance = await getTokenBalance(provider, coin.tokenAddress, userAddress)
            const hasBalance = parseFloat(balance) > 0

            const coinData = {
              id: coin.id || coin.txHash,
              name: coin.name,
              symbol: coin.symbol,
              tokenAddress: coin.tokenAddress,
              curveAddress: coin.curveAddress || null,
              imageHash: coin.imageHash,
              description: coin.description,
              createdAt: coin.createdAt,
              creator: coin.creator,
              txHash: coin.txHash,
              supply: coin.supply
            }

            coinsWithData.push(coinData)

            // Add to user holdings if they have balance
            if (hasBalance) {
              userHoldings.push({
                ...coinData,
                balance,
                hasBalance: true
              })
            }
          } catch (error: any) {
            console.warn(`Error processing coin ${coin.id}:`, error.message)
            // Still add coin without balance
            coinsWithData.push({
              id: coin.id || coin.txHash,
              name: coin.name,
              symbol: coin.symbol,
              tokenAddress: coin.tokenAddress,
              curveAddress: coin.curveAddress || null,
              imageHash: coin.imageHash,
              description: coin.description,
              createdAt: coin.createdAt,
              creator: coin.creator,
              txHash: coin.txHash,
              supply: coin.supply
            })
          }
        })
      )

      // Small delay between batches to avoid rate limits
      if (i + batchSize < coins.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Also try to load from storage SDK as fallback
    try {
      const { ogStorageSDK } = await import('@/lib/0gStorageSDK')
      const storedCoins = await ogStorageSDK.getAllCoins()
      
      // Merge stored coins that aren't already in database.
      // Many legacy coins were stored without an explicit tokenAddress field,
      // using `id` as the token address instead. We handle both shapes here.
      for (const coin of storedCoins) {
        const rawTokenAddress =
          (coin as any).tokenAddress ||
          (typeof coin.id === 'string' &&
            coin.id.startsWith('0x') &&
            coin.id.length === 42
              ? coin.id
              : null)

        if (!rawTokenAddress) continue

        const tokenAddress = rawTokenAddress.toLowerCase()

        const exists = coinsWithData.find(
          (c) => c.tokenAddress?.toLowerCase() === tokenAddress
        )

        if (!exists) {
          try {
            const balance = await getTokenBalance(provider, tokenAddress, userAddress)
            const hasBalance = parseFloat(balance) > 0

            const coinData = {
              id: coin.id,
              name: coin.name,
              symbol: coin.symbol,
              tokenAddress,
              curveAddress: (coin as any).curveAddress || null,
              imageHash: coin.imageRootHash || coin.imageUrl,
              description: coin.description,
              createdAt: coin.createdAt,
              creator: coin.creator,
              txHash: coin.id,
              supply: coin.supply
            }

            coinsWithData.push(coinData)

            if (hasBalance) {
              userHoldings.push({
                ...coinData,
                balance,
                hasBalance: true
              })
            }
          } catch (error) {
            // Skip if error
          }
        }
      }
    } catch (error) {
      console.log('Storage SDK fallback failed:', error)
    }

    console.log(`✅ Gaming coins API: Returning ${coinsWithData.length} coins, ${userHoldings.length} user holdings`)
    console.log(`📋 Coin symbols:`, coinsWithData.map(c => c.symbol).join(', '))
    console.log(`👤 Created by user:`, coinsWithData.filter(c => c.creator?.toLowerCase() === userAddress.toLowerCase()).map(c => c.symbol).join(', '))
    
    return NextResponse.json({
      success: true,
      coins: coinsWithData,
      userHoldings: userHoldings,
      totalCoins: coinsWithData.length,
      coinsWithBalance: userHoldings.length
    })

  } catch (error: any) {
    console.error('❌ Error fetching gaming coins:', error)
    console.error('Error stack:', error.stack)
    
    // Return empty arrays instead of failing completely
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch coins',
        coins: [],
        userHoldings: [],
        totalCoins: 0,
        coinsWithBalance: 0
      },
      { status: 200 } // Return 200 so frontend doesn't treat it as an error
    )
  }
}

