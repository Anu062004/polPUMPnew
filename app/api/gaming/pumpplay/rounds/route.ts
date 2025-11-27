import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

export async function GET(request: NextRequest) {
  try {
    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

    // Get all rounds, ordered by creation time
    const rounds = await db.all(`
      SELECT 
        id,
        createdAt,
        endsAt,
        candidates,
        status,
        winnerCoinId,
        totalPool
      FROM gaming_pumpplay_rounds
      ORDER BY createdAt DESC
      LIMIT 50
    `)

    // Parse candidates JSON and enrich with coin details
    const enrichedRounds = await Promise.all(
      rounds.map(async (round: any) => {
        let candidates = []
        try {
          candidates = JSON.parse(round.candidates || '[]')
        } catch {
          candidates = []
        }

        // Get coin details for candidates
        const coinDetails = await Promise.all(
          candidates.map(async (coinId: string) => {
            const coin = await db.get('SELECT * FROM coins WHERE id = ? OR tokenAddress = ?', [coinId, coinId])
            return coin || { id: coinId, name: 'Unknown', symbol: 'UNK' }
          })
        )

        // Get bet counts and total for this round
        const bets = await db.all(
          'SELECT coinId, SUM(amount) as total FROM gaming_pumpplay_bets WHERE roundId = ? GROUP BY coinId',
          [round.id]
        )

        const betMap: Record<string, number> = {}
        bets.forEach((bet: any) => {
          betMap[bet.coinId] = bet.total || 0
        })

        return {
          id: round.id,
          createdAt: round.createdAt,
          endsAt: round.endsAt,
          candidates: coinDetails,
          status: round.status,
          winnerCoinId: round.winnerCoinId,
          totalPool: round.totalPool || 0,
          bets: betMap,
        }
      })
    )

    // Create a new round if none exist or all are closed
    const openRounds = enrichedRounds.filter((r: any) => r.status === 'open')
    if (openRounds.length === 0) {
      // Get some candidate coins
      const candidateCoins = await db.all(`
        SELECT id, name, symbol, tokenAddress 
        FROM coins 
        WHERE tokenAddress IS NOT NULL 
        ORDER BY createdAt DESC 
        LIMIT 5
      `)

      if (candidateCoins.length >= 2) {
        const now = Date.now()
        const endsAt = now + 24 * 60 * 60 * 1000 // 24 hours from now

        const newRound = await db.run(
          `INSERT INTO gaming_pumpplay_rounds (createdAt, endsAt, candidates, status, totalPool)
           VALUES (?, ?, ?, 'open', 0)`,
          [now, endsAt, JSON.stringify(candidateCoins.map((c: any) => c.id || c.tokenAddress))]
        )

        const roundId = (newRound as any).lastID
        const newRoundData = {
          id: roundId,
          createdAt: now,
          endsAt,
          candidates: candidateCoins,
          status: 'open',
          winnerCoinId: null,
          totalPool: 0,
          bets: {},
        }

        enrichedRounds.unshift(newRoundData)
      }
    }

    await db.close()

    return NextResponse.json({
      success: true,
      rounds: enrichedRounds,
    })
  } catch (error: any) {
    console.error('Error fetching PumpPlay rounds:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch rounds' },
      { status: 500 }
    )
  }
}

