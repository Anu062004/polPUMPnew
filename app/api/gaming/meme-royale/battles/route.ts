import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres } from '../../../../../lib/gamingPostgres'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: NextRequest) {
  try {
    const sql = await requirePostgres()
    const toRows = (result: any) =>
      Array.isArray(result) ? result : result?.rows || []

    const battlesResult = await sql`
      SELECT
        id,
        left_coin_id,
        right_coin_id,
        left_score,
        right_score,
        winner_coin_id,
        judge,
        created_at
      FROM gaming_meme_royale
      ORDER BY created_at DESC
      LIMIT 20
    `
    const battles = toRows(battlesResult)

    const enrichedBattles = await Promise.all(
      battles.map(async (battle: any) => {
        const [leftCoinResult, rightCoinResult, winnerCoinResult] = await Promise.all([
          sql`
            SELECT id, name, symbol, token_address
            FROM coins
            WHERE id = ${battle.left_coin_id}
               OR token_address = ${battle.left_coin_id}
            LIMIT 1
          `,
          sql`
            SELECT id, name, symbol, token_address
            FROM coins
            WHERE id = ${battle.right_coin_id}
               OR token_address = ${battle.right_coin_id}
            LIMIT 1
          `,
          battle.winner_coin_id
            ? sql`
                SELECT id, name, symbol, token_address
                FROM coins
                WHERE id = ${battle.winner_coin_id}
                   OR token_address = ${battle.winner_coin_id}
                LIMIT 1
              `
            : Promise.resolve([] as any[]),
        ])

        const leftCoin = toRows(leftCoinResult)[0]
        const rightCoin = toRows(rightCoinResult)[0]
        const winnerCoin = toRows(winnerCoinResult)[0]

        return {
          id: battle.id,
          leftCoin:
            leftCoin || { id: battle.left_coin_id, name: 'Unknown', symbol: 'UNK' },
          rightCoin:
            rightCoin || { id: battle.right_coin_id, name: 'Unknown', symbol: 'UNK' },
          leftScore: battle.left_score,
          rightScore: battle.right_score,
          winnerCoinId: battle.winner_coin_id,
          winnerCoin: winnerCoin || null,
          judge: battle.judge,
          createdAt: battle.created_at,
        }
      })
    )

    return NextResponse.json({
      success: true,
      battles: enrichedBattles,
    })
  } catch (error: any) {
    console.error('Error fetching battles:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch battles' },
      { status: 500 }
    )
  }
}
