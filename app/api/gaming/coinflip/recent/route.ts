import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres } from '../../../../../lib/gamingPostgres'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitRaw = parseInt(searchParams.get('limit') || '20', 10)
    const limit = Math.max(1, Math.min(100, Number.isFinite(limitRaw) ? limitRaw : 20))

    const sql = await requirePostgres()

    const recentResult = await sql`
      SELECT
        id,
        user_address,
        wager,
        outcome,
        block_number,
        block_hash,
        created_at
      FROM gaming_coinflip
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
    const recent = Array.isArray(recentResult)
      ? recentResult
      : (recentResult as any).rows || []

    return NextResponse.json({
      success: true,
      recent: recent.map((game: any) => ({
        id: game.id,
        userAddress: game.user_address,
        wager: game.wager,
        outcome: game.outcome,
        won: game.outcome === 'win',
        blockNumber: game.block_number,
        blockHash: game.block_hash,
        createdAt: game.created_at,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching recent games:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch recent games' },
      { status: 500 }
    )
  }
}
