import { Express, Request, Response } from 'express'
import { Database } from 'sqlite'
import { ethers } from 'ethers'

export function setupMemeRoyaleRoutes(
  app: Express,
  getGamingDb: () => Promise<Database>,
  getCoinsDb: () => Promise<Database>,
  getProvider: () => ethers.JsonRpcProvider
) {
  // GET /gaming/meme-royale/battles
  app.get('/gaming/meme-royale/battles', async (req: Request, res: Response) => {
    try {
      const db = await getGamingDb()
      const coinsDb = await getCoinsDb()

      // Get recent battles
      const battles = await db.all(`
        SELECT 
          id,
          leftCoinId,
          rightCoinId,
          leftScore,
          rightScore,
          winnerCoinId,
          judge,
          createdAt
        FROM gaming_meme_royale
        ORDER BY createdAt DESC
        LIMIT 20
      `)

      // Enrich with coin details
      const enrichedBattles = await Promise.all(
        battles.map(async (battle: any) => {
          const [leftCoin, rightCoin, winnerCoin] = await Promise.all([
            coinsDb.get(
              'SELECT * FROM coins WHERE id = ? OR tokenAddress = ?',
              [battle.leftCoinId, battle.leftCoinId]
            ),
            coinsDb.get(
              'SELECT * FROM coins WHERE id = ? OR tokenAddress = ?',
              [battle.rightCoinId, battle.rightCoinId]
            ),
            battle.winnerCoinId
              ? coinsDb.get(
                  'SELECT * FROM coins WHERE id = ? OR tokenAddress = ?',
                  [battle.winnerCoinId, battle.winnerCoinId]
                )
              : null
          ])

          return {
            id: battle.id,
            leftCoin: leftCoin || { id: battle.leftCoinId, name: 'Unknown', symbol: 'UNK' },
            rightCoin: rightCoin || { id: battle.rightCoinId, name: 'Unknown', symbol: 'UNK' },
            leftSymbol: leftCoin?.symbol || 'UNK',
            rightSymbol: rightCoin?.symbol || 'UNK',
            leftScore: battle.leftScore || 0,
            rightScore: battle.rightScore || 0,
            winnerCoinId: battle.winnerCoinId,
            winnerCoin: winnerCoin || null,
            judge: battle.judge,
            createdAt: battle.createdAt
          }
        })
      )

      res.json({
        success: true,
        battles: enrichedBattles
      })
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error fetching battles:', {
          message: error.message,
          stack: error.stack
        })
      } else {
        console.error('❌ Error fetching battles:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch battles'
      })
    }
  })

  // POST /gaming/meme-royale
  app.post('/gaming/meme-royale', async (req: Request, res: Response) => {
    try {
      const {
        leftCoin,
        rightCoin,
        userAddress,
        stakeAmount,
        stakeSide,
        tokenAddress,
        txHash
      } = req.body

      if (!leftCoin || !rightCoin || !userAddress || !stakeAmount || !stakeSide) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        })
      }

      const db = await getGamingDb()

      // Simple AI judgment: random scores for now (can be enhanced with real AI)
      // Generate scores that add up to realistic ranges (0-30 total)
      const leftVirality = Math.random() * 10
      const leftTrend = Math.random() * 10
      const leftCreativity = Math.random() * 10
      const leftTotal = leftVirality + leftTrend + leftCreativity

      const rightVirality = Math.random() * 10
      const rightTrend = Math.random() * 10
      const rightCreativity = Math.random() * 10
      const rightTotal = rightVirality + rightTrend + rightCreativity

      const leftScore = leftTotal
      const rightScore = rightTotal
      const leftCoinId = leftCoin.id || leftCoin.tokenAddress
      const rightCoinId = rightCoin.id || rightCoin.tokenAddress
      const winnerCoinId = leftScore > rightScore ? leftCoinId : rightCoinId

      // Record the battle
      const result = await db.run(
        `INSERT INTO gaming_meme_royale 
         (leftCoinId, rightCoinId, leftScore, rightScore, winnerCoinId, judge, createdAt)
         VALUES (?, ?, ?, ?, ?, 'random-judge', ?)`,
        [leftCoinId, rightCoinId, leftScore, rightScore, winnerCoinId, Date.now()]
      )

      const battleId = (result as any).lastID

      // Check if user won
      const userWon =
        (stakeSide === 'left' && winnerCoinId === leftCoinId) ||
        (stakeSide === 'right' && winnerCoinId === rightCoinId)

      // Determine winner side ('left' or 'right')
      const winner = leftScore > rightScore ? 'left' : 'right'

      // Build response matching frontend expectations exactly
      // Frontend checks: data.judged (truthy check at line 408), data.winner (line 409), data.judged.left.total (line 1017)
      res.json({
        success: true,
        battleId,
        leftScore,
        rightScore,
        winnerCoinId,
        winner, // 'left' or 'right' - used by frontend at line 409
        userWon,
        judged: { // Object checked by frontend: if (data.judged) and accessed as data.judged.left.total
          left: {
            virality: Math.round(leftVirality * 10) / 10,
            trend: Math.round(leftTrend * 10) / 10,
            creativity: Math.round(leftCreativity * 10) / 10,
            total: Math.round(leftTotal * 10) / 10,
            reasons: `Virality: ${Math.round(leftVirality)}, Trend: ${Math.round(leftTrend)}, Creativity: ${Math.round(leftCreativity)}`
          },
          right: {
            virality: Math.round(rightVirality * 10) / 10,
            trend: Math.round(rightTrend * 10) / 10,
            creativity: Math.round(rightCreativity * 10) / 10,
            total: Math.round(rightTotal * 10) / 10,
            reasons: `Virality: ${Math.round(rightVirality)}, Trend: ${Math.round(rightTrend)}, Creativity: ${Math.round(rightCreativity)}`
          }
        },
        message: userWon ? 'You won!' : 'You lost. Better luck next time!',
        // Payout transaction would be generated here in production
        payoutTx: userWon ? `0x${Date.now().toString(16)}` : undefined
      })
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error processing battle:', {
          message: error.message,
          stack: error.stack,
          leftCoin: leftCoin?.id || leftCoin?.tokenAddress,
          rightCoin: rightCoin?.id || rightCoin?.tokenAddress
        })
      } else {
        console.error('❌ Error processing battle:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process battle'
      })
    }
  })
}

