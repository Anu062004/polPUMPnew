import { NextRequest, NextResponse } from 'next/server'
import { getDb, initializeSchema } from '../../../../lib/postgresManager'

export const dynamic = 'force-dynamic'

function clampLimit(raw: string | null, fallback = 24, max = 200): number {
  const value = parseInt(raw || `${fallback}`, 10)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(value, max)
}

function toMillis(input: any): number {
  if (typeof input === 'number') return input
  const parsed = Date.parse(String(input || ''))
  return Number.isFinite(parsed) ? parsed : 0
}

async function getCreatorsFromCoinsFallback(
  request: NextRequest,
  search: string,
  limit: number
) {
  try {
    const fallbackUrl = new URL('/api/coins?page=1&limit=1000&sort=created_at&order=DESC', request.url)
    const response = await fetch(fallbackUrl.toString(), { cache: 'no-store' })
    if (!response.ok) return []
    const payload = await response.json().catch(() => ({}))
    const coins = Array.isArray(payload?.coins) ? payload.coins : []

    const creatorsByWallet = new Map<
      string,
      { wallet: string; createdAt: number; followerCount: number; tokenCount: number; latestTokenAddress: string | null; latestAt: number }
    >()

    for (const coin of coins) {
      const walletRaw = String(coin?.creator || '').trim()
      if (!walletRaw) continue
      const wallet = walletRaw.toLowerCase()
      if (search && !wallet.includes(search)) continue

      const createdAt = toMillis(coin?.created_at ?? coin?.createdAt)
      const tokenAddressRaw = String(coin?.tokenAddress || coin?.token_address || '').trim()
      const tokenAddress = tokenAddressRaw ? tokenAddressRaw.toLowerCase() : null

      const existing = creatorsByWallet.get(wallet)
      if (!existing) {
        creatorsByWallet.set(wallet, {
          wallet,
          createdAt,
          followerCount: 0,
          tokenCount: 1,
          latestTokenAddress: tokenAddress,
          latestAt: createdAt,
        })
        continue
      }

      existing.tokenCount += 1
      if (createdAt > existing.latestAt) {
        existing.latestAt = createdAt
        existing.latestTokenAddress = tokenAddress
      }
      if (createdAt > existing.createdAt) {
        existing.createdAt = createdAt
      }
      creatorsByWallet.set(wallet, existing)
    }

    return Array.from(creatorsByWallet.values())
      .sort((a, b) => {
        if (b.followerCount !== a.followerCount) return b.followerCount - a.followerCount
        if (b.tokenCount !== a.tokenCount) return b.tokenCount - a.tokenCount
        return b.createdAt - a.createdAt
      })
      .slice(0, limit)
      .map(({ latestAt, ...creator }) => creator)
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  try {
    await initializeSchema()

    const search = (request.nextUrl.searchParams.get('search') || '').trim().toLowerCase()
    const limit = clampLimit(request.nextUrl.searchParams.get('limit'))
    const likePattern = `%${search}%`

    let db: Awaited<ReturnType<typeof getDb>> | null = null
    try {
      db = await getDb()
    } catch {
      db = null
    }

    if (!db || db.type !== 'pg' || !db.pool) {
      const creators = await getCreatorsFromCoinsFallback(request, search, limit)
      return NextResponse.json({
        success: true,
        creators,
      })
    }

    const result = await db.pool.query(
      `
      SELECT
        c.wallet,
        c.created_at,
        (
          SELECT COUNT(*)
          FROM creator_followers f
          WHERE f.creator_wallet = c.wallet
        ) AS follower_count,
        (
          SELECT COUNT(*)
          FROM creator_tokens t
          WHERE t.creator_wallet = c.wallet
        ) AS token_count,
        (
          SELECT t.token_address
          FROM creator_tokens t
          WHERE t.creator_wallet = c.wallet
          ORDER BY t.created_at DESC
          LIMIT 1
        ) AS latest_token_address
      FROM creators c
      WHERE ($1 = '' OR c.wallet ILIKE $2)
      ORDER BY follower_count DESC, token_count DESC, c.created_at DESC
      LIMIT $3
      `,
      [search, likePattern, limit]
    )

    const creators = result.rows.map((row: any) => ({
      wallet: row.wallet,
      createdAt: Number(row.created_at || 0),
      followerCount: Number(row.follower_count || 0),
      tokenCount: Number(row.token_count || 0),
      latestTokenAddress: row.latest_token_address || null,
    }))

    return NextResponse.json({
      success: true,
      creators,
    })
  } catch (error: any) {
    console.error('Error fetching public creators:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch creators' },
      { status: 500 }
    )
  }
}
