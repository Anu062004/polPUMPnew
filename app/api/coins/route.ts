import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from '../../../lib/contract-config'
import { upsertCreatorWallet, linkCreatorToken } from '../../../lib/creatorService'
import { extractTokenFromHeader, verifyToken } from '../../../lib/jwtUtils'

// Helper function to get database path (handles serverless environments)
function getDbPath() {
  const explicitPath = String(process.env.COINS_SQLITE_PATH || '').trim()
  if (explicitPath) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.join(process.cwd(), explicitPath)
  }

  // In local development, always keep SQLite under project data/.
  // Reserve /tmp for true serverless runtimes only.
  const isServerless =
    process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME

  return isServerless
    ? '/tmp/data/coins.db'
    : path.join(process.cwd(), 'data', 'coins.db')
}

// Database file path + chain metadata
const DB_PATH = getDbPath()
// SECURITY FIX: Removed hardcoded API key
function getRpcUrl(): string {
  const url = process.env.NEXT_PUBLIC_EVM_RPC ||
    process.env.POLYGON_AMOY_RPC ||
    process.env.RPC_URL
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_EVM_RPC or POLYGON_AMOY_RPC must be set in production')
    }
    console.warn('⚠️ RPC URL not configured, using public node. Set NEXT_PUBLIC_EVM_RPC for production.')
    return 'https://polygon-amoy.publicnode.com'
  }
  return url
}
const RPC_URL = getRpcUrl()

// Allow SQLite fallback for local development when Postgres is unavailable.
// Keep production on Postgres unless explicitly enabled via env.
const allowSqliteFallback =
  process.env.ENABLE_SQLITE_FALLBACK === '1' ||
  process.env.ENABLE_SQLITE_FALLBACK === 'true' ||
  process.env.NODE_ENV !== 'production'
const writeApiKey = process.env.API_AUTH_TOKEN || ''

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30
const rateBuckets = new Map<string, { count: number; reset: number }>()

function getClientKey(request: NextRequest, prefix: string) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.ip ||
    'unknown'
  return `${prefix}:${ip}`
}

function enforceRateLimit(request: NextRequest, prefix: string) {
  const key = getClientKey(request, prefix)
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

function requireWriteKey(request: NextRequest) {
  if (!writeApiKey) {
    // In development we allow missing key; in production this should be set
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { success: false, error: 'Write API key is not configured' },
        { status: 500 }
      )
    }
    return null
  }
  const provided = request.headers.get('x-api-key') || ''
  if (provided !== writeApiKey) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }
  return null
}

async function authorizeCoinWrite(
  request: NextRequest,
  creatorWallet: string
): Promise<{ creatorWallet: string } | { error: NextResponse }> {
  // Service-to-service writes are allowed with API key.
  if (writeApiKey) {
    const provided = request.headers.get('x-api-key') || ''
    if (provided === writeApiKey) {
      return { creatorWallet }
    }
  }

  // Frontend writes must come from authenticated CREATOR role.
  const token = extractTokenFromHeader(request.headers.get('authorization'))
  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, error: 'CREATOR role required for token creation' },
        { status: 403 }
      ),
    }
  }

  const payload = await verifyToken(token, 'access')
  if (!payload?.wallet || payload.role !== 'CREATOR') {
    return {
      error: NextResponse.json(
        { success: false, error: 'CREATOR role required for token creation' },
        { status: 403 }
      ),
    }
  }

  const normalizedAuthenticatedWallet = payload.wallet.toLowerCase()
  if (normalizedAuthenticatedWallet !== creatorWallet) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Creator wallet must match authenticated CREATOR wallet' },
        { status: 403 }
      ),
    }
  }

  return { creatorWallet: normalizedAuthenticatedWallet }
}

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

/**
 * Helper: load coins from local SQLite database (used as a fallback when
 * PostgreSQL isn't available or not configured in local development).
 */
async function loadCoinsFromSqlite(limit = 100) {
  try {
    await fs.access(DB_PATH)
  } catch {
    return []
  }

  const db = await getDatabase()
  try {
    const rows = await db.all<any[]>(
      'SELECT * FROM coins ORDER BY createdAt DESC LIMIT ?',
      limit
    )

    return rows.map((coin: any) => ({
      ...coin,
      tokenAddress: coin.tokenAddress,
      curveAddress: coin.curveAddress,
      txHash: coin.txHash,
      createdAt: new Date(coin.createdAt).toISOString(),
      imageHash: coin.imageHash,
      telegramUrl: coin.telegramUrl,
      xUrl: coin.xUrl,
      discordUrl: coin.discordUrl,
      websiteUrl: coin.websiteUrl,
      marketCap: coin.marketCap,
      volume24h: coin.volume24h,
      totalTransactions: coin.totalTransactions,
    }))
  } finally {
    await db.close()
  }
}

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters for pagination and filtering
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    let limit = parseInt(searchParams.get('limit') || '100', 10)
    // Enforce reasonable limits: minimum 1, maximum 1000 per page
    limit = Math.max(1, Math.min(1000, limit))
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order')?.toUpperCase() || 'DESC'
    const search = searchParams.get('search') || ''
    const offset = (page - 1) * limit

    // Validate sort field to prevent SQL injection
    // Map frontend sort fields to database column names
    const sortFieldMap: Record<string, string> = {
      'created_at': 'created_at',
      'name': 'name',
      'symbol': 'symbol',
      'market_cap': 'market_cap',
      'volume_24h': 'volume_24h',
      'trades_count': 'total_transactions' // Map trades_count to total_transactions
    }
    const validSortFields = Object.keys(sortFieldMap)
    const dbSortField = sortFieldMap[sort] || sortFieldMap['created_at']
    const sortOrder = order === 'ASC' ? 'ASC' : 'DESC'

    let coins: any[] = []
    let total = 0
    let totalPages = 0

    try {
      // Try PostgreSQL first (used in production / when configured)
      const { initializeSchema, getSql, getDb: getPostgresDb } = await import('../../../lib/postgresManager')

      await initializeSchema()

      const sql = await getSql()
      if (!sql) {
        throw new Error('Postgres not available')
      }

      // Build query with search and pagination
      // Note: Vercel Postgres sql template doesn't support dynamic column names in ORDER BY
      // So we use pg Pool directly for dynamic queries (safe because we validated sortField)
      const searchPattern = search ? `%${search}%` : null

      const db = await getPostgresDb()
      if (db.type !== 'pg' || !db.pool) {
        throw new Error('Postgres pool unavailable')
      }

      let result
      let countResult

      if (search && searchPattern) {
        // Search query with dynamic ORDER BY
        const queryText = `
          SELECT * FROM coins 
          WHERE LOWER(name) LIKE LOWER($1) 
             OR LOWER(symbol) LIKE LOWER($1)
          ORDER BY ${dbSortField} ${sortOrder}
          LIMIT $2 OFFSET $3
        `
        const countText = `
          SELECT COUNT(*) as total FROM coins 
          WHERE LOWER(name) LIKE LOWER($1) 
             OR LOWER(symbol) LIKE LOWER($1)
        `

        result = await db.pool.query(queryText, [searchPattern, limit, offset])
        countResult = await db.pool.query(countText, [searchPattern])
      } else {
        // No search - get all coins with pagination
        const queryText = `
          SELECT * FROM coins 
          ORDER BY ${dbSortField} ${sortOrder}
          LIMIT $1 OFFSET $2
        `
        const countText = `SELECT COUNT(*) as total FROM coins`

        result = await db.pool.query(queryText, [limit, offset])
        countResult = await db.pool.query(countText)
      }

      total = parseInt(countResult.rows[0]?.total || '0', 10)
      totalPages = Math.ceil(total / limit)

      const allCoins = result.rows

      const coinMap = new Map<string, any>()
      for (const coin of allCoins) {
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
          volume_24h: coin.volume_24h?.toString() || '0', // For frontend compatibility
          totalTransactions: coin.total_transactions,
          trades_count: coin.total_transactions || 0, // Map to frontend expected field
          unique_traders: coin.holders || 0, // Use holders as unique_traders for now
        }

        // Create a unique key for deduplication
        // Use id as primary key, fallback to other identifiers
        const normalizedId =
          mappedCoin.id !== undefined && mappedCoin.id !== null
            ? String(mappedCoin.id).toLowerCase()
            : null
        const normalizedTokenAddress =
          typeof mappedCoin.tokenAddress === 'string'
            ? mappedCoin.tokenAddress.toLowerCase()
            : null
        const normalizedTxHash =
          typeof mappedCoin.txHash === 'string' ? mappedCoin.txHash.toLowerCase() : null
        const normalizedSymbol =
          typeof mappedCoin.symbol === 'string' ? mappedCoin.symbol.toLowerCase() : ''
        const normalizedName =
          typeof mappedCoin.name === 'string' ? mappedCoin.name.toLowerCase() : ''

        const key =
          normalizedId ||
          (normalizedTokenAddress ? `token_${normalizedTokenAddress}` : null) ||
          (normalizedTxHash ? `tx_${normalizedTxHash}` : null) ||
          `${normalizedSymbol}-${normalizedName}-${mappedCoin.createdAt}` ||
          `coin_${coinMap.size}` // Fallback to prevent filtering out coins

        // Only skip if we have a valid key and it already exists
        if (key && !coinMap.has(key)) {
          coinMap.set(key, mappedCoin)
        } else if (!key || key.startsWith('coin_')) {
          // If no valid key, still add the coin with a unique key
          coinMap.set(`coin_${Date.now()}_${coinMap.size}`, mappedCoin)
        }
      }

      coins = Array.from(coinMap.values())

      // Backfill addresses if we have sql client
      if (sql) {
        await backfillCoinAddresses(sql, coins)
      }

      // Return coins (already deduplicated in the mapping step above)
      if (coins.length > 0) {
        return NextResponse.json({
          success: true,
          coins: coins,
          total,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        })
      }

      // Fallback: return empty result if no coins found
      return NextResponse.json({
        success: true,
        coins: [],
        total: 0,
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 0,
        },
      })
    } catch (pgError: any) {
      console.warn('PostgreSQL not available for /api/coins GET:', pgError?.message || pgError)
      if (allowSqliteFallback) {
        // For SQLite, apply pagination manually
        const allSqliteCoins = await loadCoinsFromSqlite(10000) // Get all, then paginate

        // Apply search filter
        let filtered = allSqliteCoins
        if (search) {
          filtered = allSqliteCoins.filter((c: any) =>
            c.name?.toLowerCase().includes(search.toLowerCase()) ||
            c.symbol?.toLowerCase().includes(search.toLowerCase())
          )
        }

        // Map SQLite coins to include frontend-expected fields
        const mappedSqliteCoins = filtered.map((c: any) => ({
          ...c,
          tokenAddress: c.tokenAddress || c.token_address,
          token_address: c.tokenAddress || c.token_address,
          volume_24h: (c.volume24h || 0).toString(),
          trades_count: c.totalTransactions || 0,
          unique_traders: c.holders || 0,
        }))

        // Apply sorting
        mappedSqliteCoins.sort((a: any, b: any) => {
          let aVal: any, bVal: any
          switch (sort) {
            case 'created_at':
              aVal = new Date(a.createdAt || 0).getTime()
              bVal = new Date(b.createdAt || 0).getTime()
              break
            case 'name':
              aVal = (a.name || '').toLowerCase()
              bVal = (b.name || '').toLowerCase()
              break
            case 'symbol':
              aVal = (a.symbol || '').toLowerCase()
              bVal = (b.symbol || '').toLowerCase()
              break
            case 'market_cap':
              aVal = parseFloat(a.marketCap || '0')
              bVal = parseFloat(b.marketCap || '0')
              break
            case 'volume_24h':
              aVal = parseFloat(a.volume24h || a.volume_24h || '0')
              bVal = parseFloat(b.volume24h || b.volume_24h || '0')
              break
            case 'trades_count':
              aVal = a.trades_count || a.totalTransactions || 0
              bVal = b.trades_count || b.totalTransactions || 0
              break
            default:
              aVal = new Date(a.createdAt || 0).getTime()
              bVal = new Date(b.createdAt || 0).getTime()
          }

          if (sortOrder === 'ASC') {
            return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
          } else {
            return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
          }
        })

        // Apply pagination
        total = mappedSqliteCoins.length
        totalPages = Math.ceil(total / limit)
        coins = mappedSqliteCoins.slice(offset, offset + limit)

        return NextResponse.json({
          success: true,
          coins,
          total,
          pagination: {
            page,
            limit,
            total,
            totalPages,
          },
        })
      } else {
        return NextResponse.json(
          { success: false, error: 'Database unavailable and SQLite fallback disabled' },
          { status: 500 }
        )
      }
    }
  } catch (error: any) {
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
    const rl = enforceRateLimit(request, 'coins-post')
    if (rl) return rl

    const coinData = await request.json()
    const normalizedName = String(coinData?.name || '').trim()
    const normalizedSymbol = String(coinData?.symbol || '').trim()

    // Validate required fields
    if (!normalizedName || !normalizedSymbol || !coinData.supply) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    coinData.name = normalizedName
    coinData.symbol = normalizedSymbol

    if (!coinData.creator || !ethers.isAddress(coinData.creator)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid creator wallet address.',
        },
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

    const normalizedCreatorWallet = ethers.getAddress(coinData.creator).toLowerCase()
    const writeAuth = await authorizeCoinWrite(request, normalizedCreatorWallet)
    if ('error' in writeAuth) {
      return writeAuth.error
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

    const createdAt = Date.now()
    const description = coinData.description || `${coinData.name} (${coinData.symbol}) - A memecoin created on Polygon`

    // First try PostgreSQL (for production / when configured)
    try {
      const { initializeSchema, getSql } = await import('../../../lib/postgresManager')

      await initializeSchema()

      const sql = await getSql()
      if (!sql) {
        throw new Error('Postgres not available')
      }

      const existingBySymbol = await sql`
        SELECT id, token_address FROM coins 
        WHERE LOWER(symbol) = LOWER(${coinData.symbol}) 
        LIMIT 1
      `

      const existingByName = await sql`
        SELECT id, token_address FROM coins
        WHERE LOWER(TRIM(name)) = LOWER(${coinData.name})
        LIMIT 1
      `

      const existingByToken = await sql`
        SELECT id FROM coins 
        WHERE LOWER(token_address) = LOWER(${normalizedTokenAddress})
        LIMIT 1
      `

      if (existingByToken.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Token address already exists in database' },
          { status: 409 }
        )
      }

      if (existingByName.rows.length > 0) {
        const existingNameRow = existingByName.rows[0]
        const existingSymbolRow = existingBySymbol.rows[0]
        const isSamePendingRow =
          !!existingSymbolRow &&
          String(existingSymbolRow.id) === String(existingNameRow.id) &&
          !existingSymbolRow.token_address

        if (!isSamePendingRow) {
          return NextResponse.json(
            { success: false, error: 'Token name already exists' },
            { status: 409 }
          )
        }
      }

      if (existingBySymbol.rows.length > 0 && !existingBySymbol.rows[0].token_address) {
        const existingId = existingBySymbol.rows[0].id

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

        try {
          await upsertCreatorWallet(normalizedCreatorWallet)
          await linkCreatorToken({
            creatorWallet: normalizedCreatorWallet,
            tokenAddress: normalizedTokenAddress,
            coinId: existingId,
          })
        } catch (creatorSyncError: any) {
          console.warn('Failed to sync creator registry after coin update:', creatorSyncError?.message || creatorSyncError)
        }

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
            creator: normalizedCreatorWallet,
            createdAt: new Date(createdAt).toISOString(),
            description,
          },
          message: 'Coin updated successfully',
        })
      }

      if (existingBySymbol.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Symbol already exists' },
          { status: 409 }
        )
      }

      const coinId = `${coinData.symbol.toLowerCase()}-${createdAt}`

      await sql`
        INSERT INTO coins (
          id, name, symbol, supply, image_hash, token_address, curve_address, tx_hash, 
          creator, created_at, description, telegram_url, x_url, discord_url, website_url
        ) VALUES (
          ${coinId}, ${coinData.name}, ${coinData.symbol}, ${coinData.supply},
          ${safeImageHash}, ${normalizedTokenAddress}, ${normalizedCurveAddress}, ${coinData.txHash},
          ${normalizedCreatorWallet}, ${createdAt}, ${description},
          ${coinData.telegramUrl || null}, ${coinData.xUrl || null},
          ${coinData.discordUrl || null}, ${coinData.websiteUrl || null}
        )
      `

      try {
        await upsertCreatorWallet(normalizedCreatorWallet)
        await linkCreatorToken({
          creatorWallet: normalizedCreatorWallet,
          tokenAddress: normalizedTokenAddress,
          coinId,
        })
      } catch (creatorSyncError: any) {
        console.warn('Failed to sync creator registry after coin insert:', creatorSyncError?.message || creatorSyncError)
      }

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
        creator: normalizedCreatorWallet,
        createdAt: new Date(createdAt).toISOString(),
        description,
      }

      return NextResponse.json({
        success: true,
        coin: newCoin,
        message: 'Coin added successfully',
      })
    } catch (pgError: any) {
      console.warn('PostgreSQL not available for /api/coins POST:', pgError?.message || pgError)
      if (!allowSqliteFallback) {
        return NextResponse.json(
          { success: false, error: 'Database unavailable and SQLite fallback disabled' },
          { status: 500 }
        )
      }
    }

    // Fallback: store in local SQLite database for local development
    try {
      const db = await getDatabase()

      // Check for existing coin by token address
      const existingByToken = await db.get(
        'SELECT id FROM coins WHERE LOWER(tokenAddress) = LOWER(?) LIMIT 1',
        [normalizedTokenAddress]
      )

      if (existingByToken) {
        await db.close()
        return NextResponse.json(
          { success: false, error: 'Token address already exists in database' },
          { status: 409 }
        )
      }

      // Check for existing coin by symbol
      const existingBySymbol = await db.get(
        'SELECT id, tokenAddress FROM coins WHERE LOWER(symbol) = LOWER(?) LIMIT 1',
        [coinData.symbol.toLowerCase()]
      )

      const existingByName = await db.get(
        'SELECT id, tokenAddress FROM coins WHERE LOWER(TRIM(name)) = LOWER(?) LIMIT 1',
        [coinData.name]
      )

      if (existingByName) {
        const isSamePendingRow =
          !!existingBySymbol &&
          String(existingBySymbol.id) === String(existingByName.id) &&
          !existingBySymbol.tokenAddress

        if (!isSamePendingRow) {
          await db.close()
          return NextResponse.json(
            { success: false, error: 'Token name already exists' },
            { status: 409 }
          )
        }
      }

      if (existingBySymbol && !existingBySymbol.tokenAddress) {
        const existingId = existingBySymbol.id
        await db.run(
          `UPDATE coins SET 
            tokenAddress = ?, 
            curveAddress = ?, 
            txHash = ?, 
            imageHash = ?, 
            description = ?, 
            telegramUrl = ?, 
            xUrl = ?, 
            discordUrl = ?, 
            websiteUrl = ?
          WHERE id = ?`,
          [
            normalizedTokenAddress,
            normalizedCurveAddress,
            coinData.txHash,
            safeImageHash,
            description,
            coinData.telegramUrl || null,
            coinData.xUrl || null,
            coinData.discordUrl || null,
            coinData.websiteUrl || null,
            existingId
          ]
        )

        await db.close()
        console.log(`✅ Updated existing coin ${existingId} in SQLite with token address: ${normalizedTokenAddress}`)

        try {
          await upsertCreatorWallet(normalizedCreatorWallet)
          await linkCreatorToken({
            creatorWallet: normalizedCreatorWallet,
            tokenAddress: normalizedTokenAddress,
            coinId: existingId,
          })
        } catch (creatorSyncError: any) {
          console.warn('Failed to sync creator registry after SQLite coin update:', creatorSyncError?.message || creatorSyncError)
        }


        const updatedCoin = {
          id: existingId,
          name: coinData.name,
          symbol: coinData.symbol,
          supply: coinData.supply,
          imageHash: safeImageHash,
          tokenAddress: normalizedTokenAddress,
          curveAddress: normalizedCurveAddress,
          txHash: coinData.txHash,
          creator: normalizedCreatorWallet,
          createdAt: new Date(createdAt).toISOString(),
          description,
        }

        return NextResponse.json({
          success: true,
          coin: updatedCoin,
          message: 'Coin updated successfully (SQLite)',
        })
      }

      if (existingBySymbol && existingBySymbol.tokenAddress) {
        await db.close()
        return NextResponse.json(
          { success: false, error: 'Symbol already exists' },
          { status: 409 }
        )
      }

      const coinId = `${coinData.symbol.toLowerCase()}-${createdAt}`

      await db.run(
        `INSERT INTO coins (
          id, name, symbol, supply, imageHash, tokenAddress, curveAddress, txHash,
          creator, createdAt, description, telegramUrl, xUrl, discordUrl, websiteUrl
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          coinId,
          coinData.name,
          coinData.symbol,
          coinData.supply,
          safeImageHash,
          normalizedTokenAddress,
          normalizedCurveAddress,
          coinData.txHash,
          normalizedCreatorWallet,
          createdAt,
          description,
          coinData.telegramUrl || null,
          coinData.xUrl || null,
          coinData.discordUrl || null,
          coinData.websiteUrl || null
        ]
      )

      await db.close()

      console.log(`✅ New coin added to SQLite: ${coinId} with token address: ${normalizedTokenAddress}`)

      try {
        await upsertCreatorWallet(normalizedCreatorWallet)
        await linkCreatorToken({
          creatorWallet: normalizedCreatorWallet,
          tokenAddress: normalizedTokenAddress,
          coinId,
        })
      } catch (creatorSyncError: any) {
        console.warn('Failed to sync creator registry after SQLite coin insert:', creatorSyncError?.message || creatorSyncError)
      }


      const newCoin = {
        id: coinId,
        name: coinData.name,
        symbol: coinData.symbol,
        supply: coinData.supply,
        imageHash: safeImageHash,
        tokenAddress: normalizedTokenAddress,
        curveAddress: normalizedCurveAddress,
        txHash: coinData.txHash,
        creator: normalizedCreatorWallet,
        createdAt: new Date(createdAt).toISOString(),
        description,
      }

      return NextResponse.json({
        success: true,
        coin: newCoin,
        message: 'Coin added successfully (SQLite)',
      })
    } catch (sqliteError: any) {
      console.error('❌ SQLite save failed:', sqliteError)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to save coin to database: ${sqliteError?.message || 'Unknown error'}. Please check database configuration.`
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('❌ Failed to add coin:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to add coin'
      },
      { status: 500 }
    )
  }
}

// Danger zone: delete coins (for resets). Security:
// - Requires ADMIN_SECRET via x-admin-secret header
// - Supports ?keep=PEPA to keep only coins with symbol PEPA
export async function DELETE(request: NextRequest) {
  try {
    const authError = requireWriteKey(request)
    if (authError) return authError
    const rl = enforceRateLimit(request, 'coins-delete')
    if (rl) return rl

    const url = new URL(request.url)
    const providedHeaderSecret = request.headers.get('x-admin-secret') || ''
    const keepSymbol = url.searchParams.get('keep') || ''
    const adminSecret = process.env.ADMIN_SECRET || ''

    if (!adminSecret) {
      return NextResponse.json(
        { success: false, error: 'ADMIN_SECRET is required for destructive operations' },
        { status: 500 }
      )
    }
    if (providedHeaderSecret !== adminSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { initializeSchema, getSql } = await import('../../../lib/postgresManager')
    await initializeSchema()
    const sql = await getSql()
    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'PostgreSQL unavailable' },
        { status: 500 }
      )
    }

    if (keepSymbol) {
      const deletedResult = await sql`
        DELETE FROM coins
        WHERE LOWER(symbol) <> LOWER(${keepSymbol})
      `
      const deleted =
        typeof (deletedResult as any).rowCount === 'number'
          ? (deletedResult as any).rowCount
          : Array.isArray(deletedResult)
            ? deletedResult.length
            : 0

      return NextResponse.json({
        success: true,
        message: `All coins deleted except ${keepSymbol}`,
        deleted
      })
    }

    const deletedResult = await sql`
      DELETE FROM coins
    `
    const deleted =
      typeof (deletedResult as any).rowCount === 'number'
        ? (deletedResult as any).rowCount
        : Array.isArray(deletedResult)
          ? deletedResult.length
          : 0
    return NextResponse.json({
      success: true,
      message: 'All coins deleted',
      deleted,
    })
  } catch (error) {
    console.error('Failed to delete coins:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete coins' },
      { status: 500 }
    )
  }
}
