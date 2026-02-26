import { NextRequest, NextResponse } from 'next/server'
import { getDb, initializeSchema } from '../../../../lib/postgresManager'

export const dynamic = 'force-dynamic'

function clampLimit(raw: string | null, fallback = 24, max = 200): number {
  const value = parseInt(raw || `${fallback}`, 10)
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.min(value, max)
}

export async function GET(request: NextRequest) {
  try {
    await initializeSchema()

    const search = (request.nextUrl.searchParams.get('search') || '').trim().toLowerCase()
    const limit = clampLimit(request.nextUrl.searchParams.get('limit'))
    const likePattern = `%${search}%`

    const db = await getDb()
    if (db.type !== 'pg' || !db.pool) {
      return NextResponse.json({
        success: true,
        creators: [],
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
