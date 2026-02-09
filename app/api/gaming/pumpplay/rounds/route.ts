import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres } from '../../../../../lib/gamingPostgres'
import { initializeSchema, getSql } from '../../../../../lib/postgresManager'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Get PumpPlay rounds
 * FIXES: Uses Postgres instead of SQLite
 */
export async function GET(request: NextRequest) {
  try {
    // Get Postgres connection (DATA PERSISTENCE FIX)
    const sql = await requirePostgres()

    // Also ensure coins schema is initialized
    await initializeSchema()
    const coinsSql = await getSql()
    if (!coinsSql) {
      throw new Error('Postgres not available for coins')
    }

    // Get all rounds, ordered by creation time
    const rounds = await sql`
      SELECT 
        id,
        created_at,
        ends_at,
        candidates,
        status,
        winner_coin_id,
        total_pool
      FROM gaming_pumpplay_rounds
      ORDER BY created_at DESC
      LIMIT 50
    `


    // Ensure rounds is an array
    const roundsArray = Array.isArray(rounds) ? rounds : (rounds?.rows || [])

    // Parse candidates JSON and enrich with coin details
    const enrichedRounds = await Promise.all(
      roundsArray.map(async (round: any) => {
        let candidates: string[] = []
        try {
          candidates = JSON.parse(round.candidates || '[]')
        } catch {
          candidates = []
        }

        // Get coin details for candidates from Postgres
        const coinDetails = await Promise.all(
          candidates.map(async (coinId: string) => {
            const coinResult = await coinsSql`
              SELECT * FROM coins 
              WHERE id = ${coinId} OR token_address = ${coinId}
              LIMIT 1
            `
            const coinArray = Array.isArray(coinResult) ? coinResult : (coinResult?.rows || [])
            const coin = coinArray[0]
            return coin ? {
              id: coin.id,
              name: coin.name,
              symbol: coin.symbol,
              tokenAddress: coin.token_address
            } : { id: coinId, name: 'Unknown', symbol: 'UNK' }
          })
        )

        // Get bet counts and total for this round
        const bets = await sql`
          SELECT coin_id, SUM(amount) as total 
          FROM gaming_pumpplay_bets 
          WHERE round_id = ${round.id} 
          GROUP BY coin_id
        `

        const betsArray = Array.isArray(bets) ? bets : (bets?.rows || [])
        const betMap: Record<string, number> = {}
        betsArray.forEach((bet: any) => {
          betMap[bet.coin_id] = parseFloat(bet.total) || 0
        })

        return {
          id: round.id,
          createdAt: round.created_at,
          endsAt: round.ends_at,
          candidates: coinDetails,
          status: round.status,
          winnerCoinId: round.winner_coin_id,
          totalPool: parseFloat(round.total_pool) || 0,
          bets: betMap,
        }
      })
    )

    // Create a new round if none exist or all are closed
    const openRounds = enrichedRounds.filter((r: any) => r.status === 'open')
    if (openRounds.length === 0) {
      // Get some candidate coins from Postgres
      const candidateCoinsResult = await coinsSql`
        SELECT id, name, symbol, token_address 
        FROM coins 
        WHERE token_address IS NOT NULL 
        ORDER BY created_at DESC 
        LIMIT 5
      `

      const candidateCoinsArray = Array.isArray(candidateCoinsResult) ? candidateCoinsResult : (candidateCoinsResult?.rows || [])
      const candidateCoins = candidateCoinsArray.map((c: any) => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        tokenAddress: c.token_address
      }))

      if (candidateCoins.length >= 2) {
        const now = Date.now()
        const endsAt = now + 24 * 60 * 60 * 1000 // 24 hours from now

        const newRound = await sql`
          INSERT INTO gaming_pumpplay_rounds (created_at, ends_at, candidates, status, total_pool)
          VALUES (${now}, ${endsAt}, ${JSON.stringify(candidateCoins.map((c: any) => c.id || c.tokenAddress))}, 'open', 0)
          RETURNING id
        `

        const newRoundArray = Array.isArray(newRound) ? newRound : (newRound?.rows || [])
        const roundId = newRoundArray[0]?.id
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

    return NextResponse.json({
      success: true,
      rounds: enrichedRounds,
    })
  } catch (error: any) {
    console.error('Error fetching PumpPlay rounds:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch rounds',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
