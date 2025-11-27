import { Express, Request, Response } from 'express'
import { Database } from 'sqlite'
import { MinesGame, MinesRevealResponse, MinesCashoutResponse } from '../types/gaming'

/**
 * Calculate multiplier based on mines count and revealed tiles
 * Progressive multiplier: increases with each safe reveal
 */
function calculateMinesMultiplier(minesCount: number, tilesRevealed: number): number {
  const totalTiles = 25
  // Base multiplier starts at 1.0, increases by 10% per safe tile revealed
  // Cap at 25x maximum
  const multiplierBase = 1.0 + (tilesRevealed * 0.1)
  return Math.min(multiplierBase, 25.0)
}

/**
 * Mines Routes
 * 
 * Flow:
 * 1. POST /gaming/mines/start - Start a new mines game
 *    - Generates random mine positions
 *    - Frontend expects: {success: true, gameId, totalTiles, minesCount}
 * 
 * 2. POST /gaming/mines/reveal - Reveal a tile
 *    - Frontend expects: {success, hitMine, revealedTiles, minePositions, currentMultiplier, status}
 * 
 * 3. POST /gaming/mines/cashout - Cash out current game
 *    - Frontend expects: {success, cashoutAmount}
 */

export function setupMinesRoutes(
  app: Express,
  getGamingDb: () => Promise<Database>
) {
  // POST /gaming/mines/start
  app.post('/gaming/mines/start', async (req: Request, res: Response) => {
    try {
      const { userAddress, betAmount, tokenAddress, minesCount, txHash } = req.body

      // Validation
      if (!userAddress || betAmount === undefined || !tokenAddress || minesCount === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: userAddress, betAmount, tokenAddress, minesCount'
        })
      }

      // Validate minesCount is within valid range
      const mines = parseInt(minesCount)
      if (isNaN(mines) || mines < 1 || mines > 24) {
        return res.status(400).json({
          success: false,
          error: 'Mines count must be between 1 and 24'
        })
      }

      // Validate bet amount
      const bet = parseFloat(betAmount)
      if (isNaN(bet) || bet <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Bet amount must be a positive number'
        })
      }

      const db = await getGamingDb()
      const totalTiles = 25

      // Generate random mine positions (ensuring no duplicates)
      const minePositions: number[] = []
      while (minePositions.length < mines) {
        const pos = Math.floor(Math.random() * totalTiles)
        if (!minePositions.includes(pos)) {
          minePositions.push(pos)
        }
      }
      minePositions.sort((a, b) => a - b)

      // Create grid state - store mine positions server-side only
      const gridState = Array(totalTiles)
        .fill(null)
        .map((_, i) => ({
          index: i,
          isMine: minePositions.includes(i),
          revealed: false
        }))

      // Create game session in database
      let gameId: number
      try {
        const result = await db.run(
          `INSERT INTO gaming_mines 
           (userAddress, betAmount, tokenAddress, minesCount, gridState, revealedTiles, status, currentMultiplier, createdAt)
           VALUES (?, ?, ?, ?, ?, ?, 'active', 1.0, ?)`,
          [
            userAddress.toLowerCase(),
            bet,
            tokenAddress,
            mines,
            JSON.stringify(gridState),
            JSON.stringify([]), // No tiles revealed yet
            Date.now()
          ]
        )

        gameId = (result as any).lastID
      } catch (dbError: any) {
        console.error('Database error starting mines game:', dbError)
        return res.status(500).json({
          success: false,
          error: 'Failed to create game. Please try again.'
        })
      }

      // Return response matching frontend expectations
      const game: MinesGame = {
        gameId, // Used by frontend: minesGame.gameId
        totalTiles, // 25 - implicit in frontend logic
        minesCount: mines // Used by frontend: minesCount state
      }

      res.json({
        success: true,
        ...game
      })
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error starting mines game:', {
          message: error.message,
          stack: error.stack,
          userAddress: userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'missing',
          minesCount: mines
        })
      } else {
        console.error('❌ Error starting mines game:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to start game'
      })
    }
  })

  // POST /gaming/mines/reveal
  app.post('/gaming/mines/reveal', async (req: Request, res: Response) => {
    try {
      const { gameId, tileIndex } = req.body

      // Validation
      if (!gameId || tileIndex === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: gameId, tileIndex'
        })
      }

      const tileIdx = parseInt(tileIndex)
      if (isNaN(tileIdx) || tileIdx < 0 || tileIdx >= 25) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tile index (must be 0-24)'
        })
      }

      const db = await getGamingDb()

      // Get game from database
      const game = await db.get('SELECT * FROM gaming_mines WHERE id = ?', [gameId])

      if (!game) {
        return res.status(404).json({
          success: false,
          error: 'Game not found'
        })
      }

      // Check game status
      if (game.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Game is not active'
        })
      }

      // Parse grid state
      let gridState: Array<{ index: number; isMine: boolean; revealed: boolean }> = []
      try {
        gridState = JSON.parse(game.gridState || '[]')
      } catch {
        return res.status(400).json({
          success: false,
          error: 'Invalid game state'
        })
      }

      // Validate tile index
      const tile = gridState[tileIdx]
      if (!tile) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tile index'
        })
      }

      // Check if tile is already revealed
      if (tile.revealed) {
        return res.status(400).json({
          success: false,
          error: 'Tile already revealed'
        })
      }

      // Reveal the tile
      tile.revealed = true
      gridState[tileIdx] = tile

      // Get current revealed tiles
      let revealedTiles: number[] = []
      try {
        revealedTiles = JSON.parse(game.revealedTiles || '[]')
      } catch {
        revealedTiles = []
      }
      
      // Add this tile to revealed list
      if (!revealedTiles.includes(tileIdx)) {
        revealedTiles.push(tileIdx)
      }

      // Check if it's a mine
      if (tile.isMine) {
        // Game over - player hit a mine (lost)
        // Reveal all mines for display
        const minePositions: number[] = []
        gridState.forEach((t, idx) => {
          if (t.isMine) {
            t.revealed = true
            minePositions.push(idx)
          }
        })

        // Update database
        await db.run(
          `UPDATE gaming_mines 
           SET gridState = ?, revealedTiles = ?, status = 'lost', completedAt = ?
           WHERE id = ?`,
          [JSON.stringify(gridState), JSON.stringify(revealedTiles), Date.now(), gameId]
        )

        // Return response matching frontend expectations
        const response: MinesRevealResponse = {
          success: true,
          hitMine: true, // Used by frontend: if (data.hitMine) { setGameStatus('lost') }
          gameOver: true,
          won: false,
          revealedTile: tileIdx,
          isMine: true,
          revealedTiles, // Used by frontend: setRevealedTiles(data.revealedTiles)
          minePositions, // Used by frontend: setMinePositions(data.minePositions)
          status: 'lost' // Used by frontend: setGameStatus('lost')
        }

        return res.json(response)
      }

      // Safe tile revealed - calculate new multiplier
      const safeReveals = revealedTiles.length
      const totalTiles = 25
      const safeTiles = totalTiles - game.minesCount
      const newMultiplier = calculateMinesMultiplier(game.minesCount, safeReveals)

      // Check if all safe tiles are revealed (win condition)
      const allSafeRevealed = safeReveals === safeTiles
      let finalStatus: 'active' | 'won' | 'lost' = 'active'
      let minePositions: number[] = []

      if (allSafeRevealed) {
        // Game won - reveal all mines for display
        gridState.forEach((t, idx) => {
          if (t.isMine) {
            t.revealed = true
            minePositions.push(idx)
          }
        })
        finalStatus = 'won'
      }

      // Update database
      await db.run(
        `UPDATE gaming_mines 
         SET gridState = ?, revealedTiles = ?, currentMultiplier = ?, status = ?, completedAt = ?
         WHERE id = ?`,
        [
          JSON.stringify(gridState),
          JSON.stringify(revealedTiles),
          newMultiplier,
          finalStatus,
          allSafeRevealed ? Date.now() : null,
          gameId
        ]
      )

      // Return response matching frontend expectations
      const response: MinesRevealResponse = {
        success: true,
        hitMine: false, // Used by frontend: if (data.hitMine) else branch
        gameOver: allSafeRevealed,
        revealedTile: tileIdx,
        isMine: false,
        currentMultiplier: newMultiplier, // Used by frontend: setCurrentMultiplier(data.currentMultiplier)
        revealedTiles, // Used by frontend: setRevealedTiles(data.revealedTiles)
        minePositions: allSafeRevealed ? minePositions : [], // Only sent when game won
        status: finalStatus // Used by frontend: if (data.status === 'won') { setGameStatus('won') }
      }

      res.json(response)
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error revealing tile:', {
          message: error.message,
          stack: error.stack,
          gameId,
          tileIndex: tileIdx
        })
      } else {
        console.error('❌ Error revealing tile:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to reveal tile'
      })
    }
  })

  // POST /gaming/mines/cashout
  app.post('/gaming/mines/cashout', async (req: Request, res: Response) => {
    try {
      const { gameId } = req.body

      // Validation
      if (!gameId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required field: gameId'
        })
      }

      const db = await getGamingDb()

      // Get game from database
      const game = await db.get('SELECT * FROM gaming_mines WHERE id = ?', [gameId])

      if (!game) {
        return res.status(404).json({
          success: false,
          error: 'Game not found'
        })
      }

      // Check game status
      if (game.status !== 'active') {
        return res.status(400).json({
          success: false,
          error: 'Game is not active'
        })
      }

      // Calculate cashout amount
      const betAmount = parseFloat(game.betAmount)
      const multiplier = parseFloat(game.currentMultiplier)
      const cashoutAmount = betAmount * multiplier

      // Mark as cashed out
      try {
        await db.run(
          `UPDATE gaming_mines 
           SET status = 'cashed_out', cashoutAmount = ?, completedAt = ?
           WHERE id = ?`,
          [cashoutAmount, Date.now(), gameId]
        )
      } catch (dbError: any) {
        console.error('Database error cashing out:', dbError)
        return res.status(500).json({
          success: false,
          error: 'Failed to cash out. Please try again.'
        })
      }

      // Return response matching frontend expectations
      const response: MinesCashoutResponse = {
        success: true,
        cashoutAmount, // Used by frontend: data.cashoutAmount.toFixed(4)
        multiplier // Used by frontend: current multiplier value
      }

      res.json(response)
    } catch (error: any) {
      // Enhanced error logging with stack trace for database errors
      if (error.message?.includes('SQLITE') || error.message?.includes('database')) {
        console.error('❌ Database error cashing out:', {
          message: error.message,
          stack: error.stack,
          gameId
        })
      } else {
        console.error('❌ Error cashing out:', error.message)
      }
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to cash out'
      })
    }
  })
}
