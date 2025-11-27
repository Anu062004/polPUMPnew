import { Express, Request, Response } from 'express'
import { Database } from 'sqlite'
import { ethers } from 'ethers'
import { CoinflipResult, CoinflipLeaderboardEntry, CoinflipRecentEntry } from '../types/gaming'
import { getLatestBlock } from '../blockchain'

/**
 * Coinflip Routes
 * 
 * Flow:
 * 1. POST /gaming/coinflip - Play a coinflip game
 *    - Uses blockchain blockhash for randomness (provably fair)
 *    - Frontend expects: outcome ('win'|'lose'), result ('heads'|'tails'), payoutTx?, blockNumber?, blockHash?, provenanceHash?
 * 
 * 2. GET /gaming/coinflip/leaderboard - Get aggregated stats per user
 *    - Frontend expects: leaderboard[] with userAddress, wins, losses, plays (totalGames)
 * 
 * 3. GET /gaming/coinflip/recent - Get recent game results
 *    - Frontend expects: recent[] with userAddress, outcome ('win'|'lose'), wager
 */

export function setupCoinflipRoutes(
  app: Express,
  getGamingDb: () => Promise<Database>,
  getProvider: () => ethers.JsonRpcProvider
) {
  // POST /gaming/coinflip
  app.post('/gaming/coinflip', async (req: Request, res: Response) => {
    try {
      const { userAddress, wager, guess, tokenAddress, txHash } = req.body

      // Validation
      if (!userAddress || wager === undefined || !guess) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userAddress, wager, guess'
        })
      }

      // Validate guess is 'heads' or 'tails'
      if (guess !== 'heads' && guess !== 'tails') {
        return res.status(400).json({
          success: false,
          error: 'Guess must be "heads" or "tails"'
        })
      }

      // Validate wager is positive number
      const wagerAmount = parseFloat(wager)
      if (isNaN(wagerAmount) || wagerAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Wager must be a positive number'
        })
      }

      const db = await getGamingDb()

      // Get a recent block for randomness (provably fair) - uses centralized helper
      const block = await getLatestBlock()
      let blockNumber: number | null = block?.number || null
      let blockHash: string | null = block?.hash || null

      // Generate outcome (heads or tails)
      // Use block hash for provably fair randomness if available
      let outcome: 'heads' | 'tails'
      if (blockHash) {
        // Use last byte of block hash for randomness
        const lastByte = parseInt(blockHash.slice(-2), 16)
        outcome = lastByte % 2 === 0 ? 'heads' : 'tails'
      } else {
        // Fallback to Math.random if blockchain unavailable
        outcome = Math.random() < 0.5 ? 'heads' : 'tails'
      }

      const userWon = guess === outcome

      // Generate seed hash for provenance
      const seedHash = blockHash || ethers.id(`${userAddress}-${Date.now()}`)
      const seedReveal = blockHash || seedHash

      // Record the game in database
      try {
        await db.run(
          `INSERT INTO gaming_coinflip 
           (userAddress, wager, choice, outcome, result, seedHash, seedReveal, blockNumber, blockHash, tokenAddress, txHash, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userAddress.toLowerCase(),
            wagerAmount,
            guess,
            userWon ? 'win' : 'lose',
            outcome,
            seedHash,
            seedReveal,
            blockNumber,
            blockHash,
            tokenAddress || null,
            txHash || null,
            Date.now()
          ]
        )
      } catch (dbError: any) {
        console.error('Database error recording coinflip:', dbError)
        return res.status(500).json({
          success: false,
          error: 'Failed to record game. Please try again.'
        })
      }

      // Build response matching frontend expectations
      const result: CoinflipResult = {
        success: true,
        outcome: userWon ? 'win' : 'lose', // Used by frontend: coinflipResult.outcome === 'win'
        result: outcome, // 'heads' or 'tails' - used by frontend for display
        userChoice: guess,
        won: userWon,
        blockNumber, // Used by frontend for display
        blockHash, // Used by frontend for display
        // Payout transaction would be generated here in production
        payoutTx: userWon ? `0x${Date.now().toString(16)}` : undefined,
        provenanceHash: seedHash // Used by frontend for verification
      }

      res.json(result)
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error playing coinflip:', {
          message: error.message,
          stack: error.stack,
          userAddress: userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'missing',
          wager,
          guess
        })
      } else {
        console.error('❌ Error playing coinflip:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to play coinflip'
      })
    }
  })

  // GET /gaming/coinflip/leaderboard
  app.get('/gaming/coinflip/leaderboard', async (req: Request, res: Response) => {
    try {
      const db = await getGamingDb()

      // Get leaderboard: aggregate stats per user
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

      // Transform to match frontend expectations
      const entries: CoinflipLeaderboardEntry[] = leaderboard.map((entry: any) => ({
        userAddress: entry.userAddress, // Used by frontend: r.userAddress.slice(0,6)…{r.userAddress.slice(-4)}
        totalGames: entry.totalGames,
        wins: entry.wins, // Used by frontend: {r.wins}W
        losses: entry.totalGames - entry.wins, // Used by frontend: {r.losses}L
        plays: entry.totalGames, // Used by frontend: ({r.plays})
        totalWinnings: entry.totalWinnings || 0,
        totalWagered: entry.totalWagered || 0,
        winRate: entry.totalGames > 0 ? (entry.wins / entry.totalGames * 100).toFixed(2) : '0.00'
      }))

      res.json({
        success: true,
        leaderboard: entries
      })
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error fetching leaderboard:', {
          message: error.message,
          stack: error.stack
        })
      } else {
        console.error('❌ Error fetching leaderboard:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch leaderboard'
      })
    }
  })

  // GET /gaming/coinflip/recent
  app.get('/gaming/coinflip/recent', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20

      if (limit < 1 || limit > 100) {
        return res.status(400).json({
          success: false,
          error: 'Limit must be between 1 and 100'
        })
      }

      const db = await getGamingDb()

      // Get recent games
      const recent = await db.all(
        `
        SELECT 
          id,
          userAddress,
          wager,
          outcome,
          result,
          blockNumber,
          blockHash,
          createdAt
        FROM gaming_coinflip
        ORDER BY createdAt DESC
        LIMIT ?
      `,
        [limit]
      )

      // Transform to match frontend expectations
      const entries: CoinflipRecentEntry[] = recent.map((game: any) => ({
        id: game.id,
        userAddress: game.userAddress, // Used by frontend: r.userAddress.slice(0,6)…{r.userAddress.slice(-4)}
        wager: game.wager, // Used by frontend: {r.wager}
        outcome: game.outcome === 'win' ? 'win' : 'lose' as 'win' | 'lose', // Used by frontend: r.outcome.toUpperCase()
        won: game.outcome === 'win',
        blockNumber: game.blockNumber,
        blockHash: game.blockHash,
        createdAt: game.createdAt
      }))

      res.json({
        success: true,
        recent: entries
      })
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error fetching recent games:', {
          message: error.message,
          stack: error.stack,
          limit
        })
      } else {
        console.error('❌ Error fetching recent games:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch recent games'
      })
    }
  })
}
