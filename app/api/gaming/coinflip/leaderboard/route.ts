import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

export async function GET(request: NextRequest) {
  try {
    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

    // Get leaderboard: users with most wins and total winnings
    const leaderboard = await db.all(`
      SELECT 
        userAddress,
        COUNT(*) as totalGames,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'win' THEN wager ELSE 0 END) as totalWinnings,
        SUM(wager) as totalWagered
      FROM gaming_coinflip
      GROUP BY userAddress
      ORDER BY wins DESC, totalWinnings DESC
      LIMIT 50
    `)

    await db.close()

    return NextResponse.json({
      success: true,
      leaderboard: leaderboard.map((entry: any) => ({
        userAddress: entry.userAddress,
        totalGames: entry.totalGames,
        wins: entry.wins,
        losses: entry.totalGames - entry.wins,
        totalWinnings: entry.totalWinnings || 0,
        totalWagered: entry.totalWagered || 0,
        winRate: entry.totalGames > 0 ? (entry.wins / entry.totalGames * 100).toFixed(2) : '0.00',
      })),
    })
  } catch (error: any) {
    console.error('Error fetching leaderboard:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch leaderboard' },
      { status: 500 }
    )
  }
}

