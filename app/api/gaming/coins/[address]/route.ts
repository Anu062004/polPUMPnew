import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { initializeSchema, getSql } from '@/lib/postgresManager'

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

const allowSqliteFallback = false

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 120 // Increased for gaming page auto-refresh
const rateBuckets = new Map<string, { count: number; reset: number }>()
const BALANCE_CACHE_TTL_MS = 20_000
const BALANCE_FETCH_CONCURRENCY = 8
const balanceCache = new Map<string, { value: string; expiresAt: number }>()

function getBalanceCacheKey(userAddress: string, tokenAddress: string): string {
  return `${userAddress.toLowerCase()}:${tokenAddress.toLowerCase()}`
}

function pruneExpiredBalanceCache() {
  const now = Date.now()
  for (const [key, cached] of balanceCache.entries()) {
    if (cached.expiresAt <= now) {
      balanceCache.delete(key)
    }
  }
}

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
  const cacheKey = getBalanceCacheKey(userAddress, tokenAddress)
  const cached = balanceCache.get(cacheKey)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.value
  }

  try {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const balance = await token.balanceOf(userAddress)
    const decimals = await token.decimals().catch(() => 18) // Default to 18 if decimals() fails
    const formatted = ethers.formatUnits(balance, decimals)
    balanceCache.set(cacheKey, {
      value: formatted,
      expiresAt: now + BALANCE_CACHE_TTL_MS,
    })
    return formatted
  } catch (error: any) {
    console.warn(`Failed to get balance for ${tokenAddress}:`, error.message)
    balanceCache.set(cacheKey, {
      value: '0',
      expiresAt: now + 5_000,
    })
    return '0'
  }
}

export const dynamic = 'force-dynamic'

async function loadCoinsFromSqlite() {
  return []
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return []

  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (true) {
        const currentIndex = nextIndex
        nextIndex += 1
        if (currentIndex >= items.length) break
        results[currentIndex] = await worker(items[currentIndex], currentIndex)
      }
    }
  )

  await Promise.all(runners)
  return results
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

    console.log(`ðŸ” Gaming coins API called with address: ${userAddress}`)

    if (!userAddress || !ethers.isAddress(userAddress)) {
      console.error(`âŒ Invalid address provided: ${userAddress}`)
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
        console.warn('âš ï¸ PostgreSQL connection/client issue, will use SQLite fallback:', schemaError.message)
        console.warn('âš ï¸ Error type:', schemaError.constructor?.name || typeof schemaError)
      } else {
        console.warn('âš ï¸ Schema initialization warning (may already exist):', schemaError.message)
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
        console.log('ðŸ“Š Postgres not available, skipping to SQLite fallback')
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
      console.log(`ðŸ“Š PostgreSQL query returned ${rows.length} rows`)
      
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
      console.log(`âœ… Fetched ${coins.length} coins from PostgreSQL (including pending)`)
      if (coins.length > 0) {
        console.log(`ðŸ“ Sample coin:`, { id: coins[0].id, name: coins[0].name, symbol: coins[0].symbol, tokenAddress: coins[0].tokenAddress })
      }
    } catch (dbError: any) {
      console.warn('âš ï¸ PostgreSQL query failed:', dbError?.message || dbError)
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
      console.log('ðŸ“Š PostgreSQL returned 0 rows, trying SQLite fallback (local dev only)...')
      if (allowSqliteFallback) {
        const sqliteCoins = await loadCoinsFromSqlite()
        if (sqliteCoins.length > 0) {
          console.log(`âœ… SQLite fallback found ${sqliteCoins.length} coins`)
          coins = sqliteCoins
        } else {
          console.warn('âš ï¸ No coins found in Postgres or SQLite. On Vercel, ensure POSTGRES_PRISMA_URL is configured and coins are saved to Postgres when created.')
        }
      }
    } else if (!usedPostgres && coins.length > 0) {
      console.log(`âœ… Using SQLite data: ${coins.length} coins found`)
    }
    
    // Ensure we have coins - log what we found
    console.log(`ðŸ“Š Total coins loaded: ${coins.length}`)
    if (coins.length > 0) {
      console.log(`ðŸ“‹ Coin symbols:`, coins.map(c => c.symbol).join(', '))
      console.log(`ðŸ“‹ Coin names:`, coins.map(c => c.name).join(', '))
    } else {
      console.warn('âš ï¸ No coins found in database!')
    }

    pruneExpiredBalanceCache()

    // Fetch balances with capped concurrency to avoid RPC overload while staying responsive.
    const processedCoins = await mapWithConcurrency<any, { coinData: any; holding: any | null }>(
      coins,
      BALANCE_FETCH_CONCURRENCY,
      async (coin: any) => {
        const coinData = {
          id: coin.id || coin.txHash,
          name: coin.name,
          symbol: coin.symbol,
          tokenAddress: coin.tokenAddress || null,
          curveAddress: coin.curveAddress || null,
          imageHash: coin.imageHash,
          description: coin.description,
          createdAt: coin.createdAt,
          creator: coin.creator,
          txHash: coin.txHash,
          supply: coin.supply,
          isPending: !coin.tokenAddress,
        }

        if (!coin.tokenAddress) {
          return { coinData, holding: null }
        }

        try {
          const balance = await getTokenBalance(provider, coin.tokenAddress, userAddress)
          const hasBalance = parseFloat(balance) > 0
          if (!hasBalance) {
            return { coinData, holding: null }
          }

          return {
            coinData,
            holding: {
              ...coinData,
              balance,
              hasBalance: true,
            },
          }
        } catch (error: any) {
          console.warn(`Error processing coin ${coin.id}:`, error.message)
          return { coinData, holding: null }
        }
      }
    )

    const coinsWithData = processedCoins.map((entry) => entry.coinData)
    const userHoldings = processedCoins
      .map((entry) => entry.holding)
      .filter((entry): entry is any => !!entry)

    // Only hit storage fallback when DB sources returned no coins.
    if (coinsWithData.length === 0) {
      try {
        const { ogStorageSDK } = await import('@/lib/0gStorageSDK')
        const storedCoins = await ogStorageSDK.getAllCoins()
        const existingTokens = new Set(
          coinsWithData
            .map((coin) => coin.tokenAddress?.toLowerCase())
            .filter((token): token is string => !!token)
        )

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
          if (existingTokens.has(tokenAddress)) continue

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
            existingTokens.add(tokenAddress)

            if (hasBalance) {
              userHoldings.push({
                ...coinData,
                balance,
                hasBalance: true
              })
            }
          } catch {
            // Skip coin if balance lookup fails.
          }
        }
      } catch (error) {
        console.log('Storage SDK fallback failed:', error)
      }
    }

    console.log(`âœ… Gaming coins API: Returning ${coinsWithData.length} coins, ${userHoldings.length} user holdings`)
    console.log(`ðŸ“‹ Coin symbols:`, coinsWithData.map(c => c.symbol).join(', '))
    console.log(`ðŸ‘¤ Created by user:`, coinsWithData.filter(c => c.creator?.toLowerCase() === userAddress.toLowerCase()).map(c => c.symbol).join(', '))
    
    return NextResponse.json({
      success: true,
      coins: coinsWithData,
      userHoldings: userHoldings,
      totalCoins: coinsWithData.length,
      coinsWithBalance: userHoldings.length
    })

  } catch (error: any) {
    console.error('âŒ Error fetching gaming coins:', error)
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

