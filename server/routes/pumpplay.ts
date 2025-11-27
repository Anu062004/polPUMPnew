import { Express, Request, Response } from 'express'
import { Database } from 'sqlite'
import { PumpPlayRound, PumpPlayBet } from '../types/gaming'

/**
 * PumpPlay Routes
 * 
 * Flow:
 * 1. GET /gaming/pumpplay/rounds - Returns all rounds with coin details and bet totals
 *    - Frontend expects: rounds[] with id, status, timeRemaining, coinDetails[], bets[]
 * 2. POST /gaming/pumpplay/bet - Records a bet on a round
 *    - Frontend expects: {success: true, message?: string}
 */

export function setupPumpPlayRoutes(
  app: Express,
  getGamingDb: () => Promise<Database>,
  getCoinsDb: () => Promise<Database>
) {
  // GET /gaming/pumpplay/rounds
  app.get('/gaming/pumpplay/rounds', async (req: Request, res: Response) => {
    try {
      const db = await getGamingDb()
      const coinsDb = await getCoinsDb()

      // Get all rounds ordered by creation time (newest first)
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

      // Enrich rounds with coin details and bet totals
      const enrichedRounds = await Promise.all(
        rounds.map(async (round: any): Promise<PumpPlayRound> => {
          let candidates: string[] = []
          try {
            candidates = JSON.parse(round.candidates || '[]')
          } catch {
            candidates = []
          }

          // Get coin details for candidates
          const coinDetails = await Promise.all(
            candidates.map(async (coinId: string) => {
              const coin = await coinsDb.get(
                'SELECT * FROM coins WHERE id = ? OR tokenAddress = ?',
                [coinId, coinId]
              )
              return coin || {
                id: coinId,
                name: 'Unknown',
                symbol: 'UNK',
                tokenAddress: coinId
              }
            })
          )

          // Get bet totals per coin for this round
          const bets = await db.all(
            'SELECT coinId, SUM(amount) as total FROM gaming_pumpplay_bets WHERE roundId = ? GROUP BY coinId',
            [round.id]
          )

          // Map bets to expected format: {coinId: string, total: number}[]
          const betList: PumpPlayBet[] = bets.map((bet: any) => ({
            coinId: bet.coinId,
            total: bet.total || 0
          }))

          // Calculate time remaining in milliseconds
          const timeRemaining = Math.max(0, round.endsAt - Date.now())

          return {
            id: round.id,
            createdAt: round.createdAt,
            endsAt: round.endsAt,
            timeRemaining, // Used by frontend formatTime() function
            coinDetails, // Array of coin objects with id, symbol, name
            candidates: coinDetails.map((c: any) => c.id || c.tokenAddress),
            status: round.status as 'open' | 'closed' | 'resolved', // Used by frontend for display
            winnerCoinId: round.winnerCoinId,
            totalPool: round.totalPool || 0,
            bets: betList // Used by frontend: round.bets.find(b => b.coinId === coin.id)?.total
          }
        })
      )

      // Auto-create a new round if none exist or all are closed
      const openRounds = enrichedRounds.filter((r) => r.status === 'open')
      if (openRounds.length === 0) {
        const candidateCoins = await coinsDb.all(`
          SELECT id, name, symbol, tokenAddress 
          FROM coins 
          WHERE tokenAddress IS NOT NULL AND tokenAddress != ''
          ORDER BY createdAt DESC 
          LIMIT 5
        `)

        if (candidateCoins.length >= 2) {
          const now = Date.now()
          const endsAt = now + 24 * 60 * 60 * 1000 // 24 hours from now

          const result = await db.run(
            `INSERT INTO gaming_pumpplay_rounds (createdAt, endsAt, candidates, status, totalPool)
             VALUES (?, ?, ?, 'open', 0)`,
            [
              now,
              endsAt,
              JSON.stringify(candidateCoins.map((c: any) => c.id || c.tokenAddress))
            ]
          )

          const roundId = (result as any).lastID

          // Create enriched round object for new round
          const newRound: PumpPlayRound = {
            id: roundId,
            createdAt: now,
            endsAt,
            timeRemaining: endsAt - now,
            coinDetails: candidateCoins.map((c: any) => ({
              id: c.id || c.tokenAddress,
              name: c.name || 'Unknown',
              symbol: c.symbol || 'UNK',
              tokenAddress: c.tokenAddress
            })),
            candidates: candidateCoins.map((c: any) => c.id || c.tokenAddress),
            status: 'open',
            winnerCoinId: null,
            totalPool: 0,
            bets: []
          }

          enrichedRounds.unshift(newRound)
        }
      }

      res.json({
        success: true,
        rounds: enrichedRounds
      })
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error fetching PumpPlay rounds:', {
          message: error.message,
          stack: error.stack
        })
      } else {
        console.error('❌ Error fetching PumpPlay rounds:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch rounds'
      })
    }
  })

  // POST /gaming/pumpplay/bet
  app.post('/gaming/pumpplay/bet', async (req: Request, res: Response) => {
    try {
      const { roundId, userAddress, coinId, amount, tokenAddress, txHash } = req.body

      // Validation - all fields required
      if (!roundId || !userAddress || !coinId || amount === undefined || amount === null) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: roundId, userAddress, coinId, amount'
        })
      }

      // Validate amount is positive number
      const betAmount = parseFloat(amount)
      if (isNaN(betAmount) || betAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Amount must be a positive number'
        })
      }

      // Validate address format (basic check)
      if (!userAddress || typeof userAddress !== 'string' || userAddress.length < 20) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user address'
        })
      }

      const db = await getGamingDb()

      // Verify round exists
      const round = await db.get(
        'SELECT * FROM gaming_pumpplay_rounds WHERE id = ?',
        [roundId]
      )

      if (!round) {
        return res.status(404).json({
          success: false,
          error: 'Round not found'
        })
      }

      // Check round status
      if (round.status !== 'open') {
        return res.status(400).json({
          success: false,
          error: 'Round is not open for betting'
        })
      }

      // Check if round has ended
      if (Date.now() >= round.endsAt) {
        // Auto-close expired rounds
        await db.run(
          'UPDATE gaming_pumpplay_rounds SET status = ? WHERE id = ?',
          ['closed', roundId]
        )
        return res.status(400).json({
          success: false,
          error: 'Round has ended'
        })
      }

      // Verify coinId is in round candidates
      let candidates: string[] = []
      try {
        candidates = JSON.parse(round.candidates || '[]')
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid round configuration'
        })
      }

      if (!candidates.includes(coinId)) {
        return res.status(400).json({
          success: false,
          error: 'Selected coin is not a candidate in this round'
        })
      }

      // Record the bet
      try {
        await db.run(
          `INSERT INTO gaming_pumpplay_bets (roundId, userAddress, coinId, amount, tokenAddress, txHash, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            roundId,
            userAddress.toLowerCase(),
            coinId,
            betAmount,
            tokenAddress || null,
            txHash || null,
            Date.now()
          ]
        )
      } catch (dbError: any) {
        // Handle SQLite errors (e.g., constraint violations)
        console.error('Database error placing bet:', dbError)
        return res.status(500).json({
          success: false,
          error: 'Failed to record bet. Please try again.'
        })
      }

      // Update round total pool
      await db.run(
        'UPDATE gaming_pumpplay_rounds SET totalPool = totalPool + ? WHERE id = ?',
        [betAmount, roundId]
      )

      res.json({
        success: true,
        message: 'Bet placed successfully'
      })
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error placing bet:', {
          message: error.message,
          stack: error.stack,
          roundId,
          userAddress: userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'missing'
        })
      } else {
        console.error('❌ Error placing bet:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to place bet'
      })
    }
  })
}
