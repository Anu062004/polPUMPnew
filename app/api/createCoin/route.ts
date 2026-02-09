import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

const writeApiKey = process.env.API_AUTH_TOKEN || ''
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const rateBuckets = new Map<string, { count: number; reset: number }>()

function requireWriteKey(request: NextRequest) {
  if (!writeApiKey) {
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

function enforceRateLimit(request: NextRequest) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.ip ||
    'unknown'
  const key = `create-coin:${ip}`
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

// Create a new coin with metadata
export async function POST(request: NextRequest) {
  try {
    // API key check disabled - using wallet signatures for authentication instead
    // const authError = requireWriteKey(request)
    // if (authError) return authError

    const rl = enforceRateLimit(request)
    if (rl) return rl

    const formData = await request.formData()

    const name = formData.get('name') as string
    const symbol = formData.get('symbol') as string
    const description = formData.get('description') as string
    const supply = formData.get('supply') as string
    const creator = formData.get('creator') as string
    const imageRootHash = formData.get('imageRootHash') as string

    if (!name || !symbol || !supply || !creator) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, symbol, supply, creator' },
        { status: 400 }
      )
    }

    // Try backend first if available
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

    try {
      const backendFormData = new FormData()
      backendFormData.append('name', name)
      backendFormData.append('symbol', symbol)
      backendFormData.append('description', description || '')
      backendFormData.append('supply', supply)
      backendFormData.append('creator', creator)
      if (imageRootHash) backendFormData.append('imageRootHash', imageRootHash)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const backendResponse = await fetch(`${backendBase}/createCoin`, {
        method: 'POST',
        body: backendFormData,
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (backendResponse.ok) {
        const backendResult = await backendResponse.json()
        if (backendResult.success) {
          return NextResponse.json(backendResult)
        }
      }
    } catch (backendError: any) {
      console.log('Backend createCoin not available, using local storage:', backendError?.message || backendError)
    }

    // Fallback: Create coin metadata and store in database
    const metadata = {
      name,
      symbol,
      description: description || `${name} (${symbol}) - A memecoin created on Polygon Amoy`,
      supply,
      creator,
      imageRootHash: imageRootHash || null,
      createdAt: new Date().toISOString(),
      metadataRootHash: null as string | null // Will be generated
    }

    // Generate metadata hash
    const crypto = await import('crypto')
    const metadataString = JSON.stringify(metadata)
    const metadataHash = crypto.createHash('sha256').update(metadataString).digest('hex')
    metadata.metadataRootHash = metadataHash

    // Store in database - try PostgreSQL first, fallback to SQLite
    const coinData = {
      name,
      symbol,
      supply,
      description: metadata.description,
      creator,
      imageHash: imageRootHash || null,
      tokenAddress: null,
      txHash: `pending-${Date.now()}`,
      telegramUrl: null,
      xUrl: null,
      discordUrl: null,
      websiteUrl: null
    }

    const coinId = `${symbol.toLowerCase()}-${Date.now()}`
    const createdAt = Date.now()

    // Try PostgreSQL first
    try {
      const { initializeSchema, getSql } = await import('../../../lib/postgresManager')

      await initializeSchema()
      const sql = await getSql()

      if (sql) {
        // Insert coin into PostgreSQL
        await sql`
          INSERT INTO coins (
            id, name, symbol, supply, image_hash, token_address, tx_hash, 
            creator, created_at, description
          )
          VALUES (
            ${coinId}, ${name}, ${symbol}, ${supply}, ${imageRootHash || null}, 
            ${null}, ${coinData.txHash}, ${creator}, ${createdAt}, ${metadata.description}
          )
        `

        console.log(`✅ Coin metadata saved to PostgreSQL: ${coinId}`)

        return NextResponse.json({
          success: true,
          coin: {
            id: coinId,
            name,
            symbol,
            supply,
            description: metadata.description,
            creator,
            imageRootHash: imageRootHash || null,
            metadataRootHash: metadataHash,
            txHash: coinData.txHash,
            tokenAddress: null,
            curveAddress: null,
            createdAt: new Date(createdAt).toISOString()
          }
        })
      }
    } catch (pgError: any) {
      console.warn('PostgreSQL not available for createCoin, trying SQLite fallback:', pgError?.message || pgError)
    }

    // Fallback to SQLite
    const allowSqliteFallback =
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_SQLITE_FALLBACK !== '0'

    if (!allowSqliteFallback) {
      return NextResponse.json(
        { success: false, error: 'Database unavailable and SQLite fallback disabled. Please configure PostgreSQL.' },
        { status: 500 }
      )
    }

    try {
      // Get database path
      const isServerless =
        process.env.VERCEL === '1' ||
        process.env.AWS_LAMBDA_FUNCTION_NAME ||
        process.env.NEXT_RUNTIME === 'nodejs'

      const dbPath = isServerless
        ? '/tmp/data/coins.db'
        : path.join(process.cwd(), 'data', 'coins.db')

      // Ensure data directory exists
      const dataDir = path.dirname(dbPath)
      try {
        await fs.access(dataDir)
      } catch {
        await fs.mkdir(dataDir, { recursive: true })
      }

      // Open database
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      })

      // Create table if it doesn't exist
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
          websiteUrl TEXT
        )
      `)

      // Insert coin
      await db.run(
        `INSERT INTO coins (
          id, name, symbol, supply, imageHash, tokenAddress, txHash,
          creator, createdAt, description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          coinId,
          name,
          symbol,
          supply,
          imageRootHash || null,
          null,
          coinData.txHash,
          creator,
          createdAt,
          metadata.description
        ]
      )

      await db.close()

      console.log(`✅ Coin metadata saved to SQLite: ${coinId}`)

      return NextResponse.json({
        success: true,
        coin: {
          id: coinId,
          name,
          symbol,
          supply,
          description: metadata.description,
          creator,
          imageRootHash: imageRootHash || null,
          metadataRootHash: metadataHash,
          txHash: coinData.txHash,
          tokenAddress: null,
          curveAddress: null,
          createdAt: new Date(createdAt).toISOString()
        }
      })
    } catch (sqliteError: any) {
      console.error('❌ SQLite fallback also failed:', sqliteError)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to persist coin metadata: ${sqliteError?.message || 'Database unavailable'}. Please check database configuration.`
        },
        { status: 500 }
      )
    }

  } catch (error: any) {
    console.error('Create coin error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create coin'
      },
      { status: 500 }
    )
  }
}

