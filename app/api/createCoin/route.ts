import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { upsertCreatorWallet } from '../../../lib/creatorService'
import { withCreatorAuth } from '../../../lib/roleMiddleware'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const rateBuckets = new Map<string, { count: number; reset: number }>()

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

// Create a new coin with metadata.
// Note: SQLite fallback has been retired; Postgres is required.
export const POST = withCreatorAuth(async (request: NextRequest, user) => {
  try {
    const rl = enforceRateLimit(request)
    if (rl) return rl

    const formData = await request.formData()

    const rawName = formData.get('name') as string
    const rawSymbol = formData.get('symbol') as string
    const description = formData.get('description') as string
    const supply = formData.get('supply') as string
    const creator = formData.get('creator') as string | null
    const imageRootHash = formData.get('imageRootHash') as string
    const name = (rawName || '').trim()
    const symbol = (rawSymbol || '').trim()

    if (!name || !symbol || !supply) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, symbol, supply' },
        { status: 400 }
      )
    }

    if (creator && !ethers.isAddress(creator)) {
      return NextResponse.json(
        { success: false, error: 'Invalid creator wallet address' },
        { status: 400 }
      )
    }

    const normalizedCreatorWallet = ethers.getAddress(user.wallet).toLowerCase()
    if (creator) {
      const normalizedProvidedCreatorWallet = ethers.getAddress(creator).toLowerCase()
      if (normalizedProvidedCreatorWallet !== normalizedCreatorWallet) {
        return NextResponse.json(
          { success: false, error: 'Creator wallet must match your authenticated CREATOR role wallet' },
          { status: 403 }
        )
      }
    }

    // Enforce case-insensitive unique token names across all coins.
    // This check runs before backend forwarding so the rule is consistent.
    try {
      const { initializeSchema, getSql } = await import('../../../lib/postgresManager')
      await initializeSchema()
      const sql = await getSql()
      if (!sql) {
        throw new Error('Postgres not available')
      }

      const existingByName = await sql`
        SELECT id
        FROM coins
        WHERE LOWER(TRIM(name)) = LOWER(${name})
        LIMIT 1
      `

      if (existingByName.rows.length > 0) {
        return NextResponse.json(
          { success: false, error: 'Token name already exists' },
          { status: 409 }
        )
      }
    } catch (pgError: any) {
      console.error(
        'PostgreSQL not available for createCoin name uniqueness check:',
        pgError?.message || pgError
      )
      return NextResponse.json(
        {
          success: false,
          error:
            'Coin metadata could not be saved because PostgreSQL is unavailable. SQLite fallback is disabled.',
        },
        { status: 500 }
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
      backendFormData.append('creator', normalizedCreatorWallet)
      if (imageRootHash) backendFormData.append('imageRootHash', imageRootHash)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const backendResponse = await fetch(`${backendBase}/createCoin`, {
        method: 'POST',
        body: backendFormData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (backendResponse.ok) {
        const backendResult = await backendResponse.json()
        if (backendResult.success) {
          return NextResponse.json(backendResult)
        }
      }
    } catch (backendError: any) {
      console.log(
        'Backend createCoin not available, using local Postgres route:',
        backendError?.message || backendError
      )
    }

    const metadata = {
      name,
      symbol,
      description: description || `${name} (${symbol}) - A memecoin created on Polygon Amoy`,
      supply,
      creator: normalizedCreatorWallet,
      imageRootHash: imageRootHash || null,
      createdAt: new Date().toISOString(),
      metadataRootHash: null as string | null,
    }

    const crypto = await import('crypto')
    const metadataString = JSON.stringify(metadata)
    const metadataHash = crypto.createHash('sha256').update(metadataString).digest('hex')
    metadata.metadataRootHash = metadataHash

    const coinData = {
      txHash: `pending-${Date.now()}`,
    }

    const coinId = `${symbol.toLowerCase()}-${Date.now()}`
    const createdAt = Date.now()

    try {
      const { initializeSchema, getSql } = await import('../../../lib/postgresManager')

      await initializeSchema()
      const sql = await getSql()
      if (!sql) {
        throw new Error('Postgres not available')
      }

      await sql`
        INSERT INTO coins (
          id, name, symbol, supply, image_hash, token_address, tx_hash,
          creator, created_at, description
        )
        VALUES (
          ${coinId}, ${name}, ${symbol}, ${supply}, ${imageRootHash || null},
          ${null}, ${coinData.txHash}, ${normalizedCreatorWallet}, ${createdAt}, ${metadata.description}
        )
      `

      try {
        await upsertCreatorWallet(normalizedCreatorWallet)
      } catch (creatorSyncError: any) {
        console.warn(
          'Failed to upsert creator wallet during createCoin:',
          creatorSyncError?.message || creatorSyncError
        )
      }

      return NextResponse.json({
        success: true,
        coin: {
          id: coinId,
          name,
          symbol,
          supply,
          description: metadata.description,
          creator: normalizedCreatorWallet,
          imageRootHash: imageRootHash || null,
          metadataRootHash: metadataHash,
          txHash: coinData.txHash,
          tokenAddress: null,
          curveAddress: null,
          createdAt: new Date(createdAt).toISOString(),
        },
      })
    } catch (pgError: any) {
      console.error(
        'PostgreSQL not available for createCoin (SQLite fallback retired):',
        pgError?.message || pgError
      )
      return NextResponse.json(
        {
          success: false,
          error:
            'Coin metadata could not be saved because PostgreSQL is unavailable. SQLite fallback is disabled.',
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Create coin error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to create coin',
      },
      { status: 500 }
    )
  }
})
