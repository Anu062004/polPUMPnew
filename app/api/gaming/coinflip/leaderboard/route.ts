import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres } from '../../../../../lib/gamingPostgres'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: NextRequest) {
  try {
    const sql = await requirePostgres()

    const leaderboardResult = await sql`
      SELECT
        user_address,
        COUNT(*)::int AS total_games,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END)::int AS wins,
        SUM(CASE WHEN outcome = 'win' THEN wager ELSE 0 END) AS total_winnings,
        SUM(wager) AS total_wagered
      FROM gaming_coinflip
      GROUP BY user_address
      ORDER BY wins DESC, total_winnings DESC
      LIMIT 50
    `
    const leaderboard = Array.isArray(leaderboardResult)
      ? leaderboardResult
      : (leaderboardResult as any).rows || []

    return NextResponse.json({
      success: true,
      leaderboard: leaderboard.map((entry: any) => {
        const totalGames = Number(entry.total_games || 0)
        const wins = Number(entry.wins || 0)
        return {
          userAddress: entry.user_address,
          totalGames,
          wins,
          losses: Math.max(0, totalGames - wins),
          totalWinnings: Number(entry.total_winnings || 0),
          totalWagered: Number(entry.total_wagered || 0),
          winRate: totalGames > 0 ? ((wins / totalGames) * 100).toFixed(2) : '0.00',
        }
      }),
    })
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}
