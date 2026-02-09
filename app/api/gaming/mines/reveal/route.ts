import { NextRequest, NextResponse } from 'next/server'
import { DatabaseManager } from '@/lib/databaseManager'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { verifySignatureWithTimestamp } from '../../../../../lib/authUtils'
import { validateGameId, validateAddress, validateInteger } from '../../../../../lib/validationUtils'

/**
 * Reveal a tile in Mines game
 * SECURITY: Requires wallet signature verification
 * FIXES: Uses Postgres, input validation, transaction with locking
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      gameId,
      tileIndex,
      userAddress,
      signature,
      message
    } = body

    // Input validation
    const gameIdValidation = validateGameId(gameId)
    if (!gameIdValidation.isValid) {
      return NextResponse.json(
        { success: false, error: gameIdValidation.error },
        { status: 400 }
      )
    }

    const addressValidation = validateAddress(userAddress)
    if (!addressValidation.isValid) {
      return NextResponse.json(
        { success: false, error: addressValidation.error },
        { status: 400 }
      )
    }

    const tileValidation = validateInteger(tileIndex, 'Tile index', 0, 24)
    if (!tileValidation.isValid) {
      return NextResponse.json(
        { success: false, error: tileValidation.error },
        { status: 400 }
      )
    }

    // Wallet signature verification (SECURITY FIX)
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNATURE === 'true') {
      if (!signature || !message) {
        return NextResponse.json(
          {
            success: false,
            error: 'Wallet signature required. Please sign the message to reveal tile.'
          },
          { status: 401 }
        )
      }

      const verification = verifySignatureWithTimestamp(
        message,
        signature,
        userAddress.toLowerCase(),
        5 * 60 * 1000
      )

      if (!verification.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: `Signature verification failed: ${verification.error}`
          },
          { status: 401 }
        )
      }
    }

    // Get Postgres connection (DATA PERSISTENCE FIX)
    const sql = await requirePostgres()

    // Use transaction with row lock to prevent race conditions
    try {
      // Lock the row for update
      const gameResult = await sql`
        SELECT * FROM gaming_mines 
        WHERE id = ${gameId} 
        AND user_address = ${userAddress.toLowerCase()}
        FOR UPDATE
      `

      if (gameResult.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Game not found' },
          { status: 404 }
        )
      }

      const game = gameResult[0]

      if (game.status !== 'active') {
        return NextResponse.json(
          { success: false, error: `Game is not active (status: ${game.status})` },
          { status: 400 }
        )
      }

      // Parse grid state
      let gridState: any[] = []
      try {
        gridState = JSON.parse(game.grid_state || '[]')
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid game state' },
          { status: 400 }
        )
      }

      // Check if tile is already revealed
      const tile = gridState[tileIndex]
      if (!tile || tile.revealed) {
        return NextResponse.json(
          { success: false, error: 'Tile already revealed' },
          { status: 400 }
        )
      }

      // Reveal tile
      tile.revealed = true
      gridState[tileIndex] = tile

      // Parse revealed tiles
      let revealedTiles: number[] = []
      try {
        revealedTiles = JSON.parse(game.revealed_tiles || '[]')
      } catch { }
      revealedTiles.push(tileIndex)

      // Check if it's a mine
      if (tile.isMine) {
        // Game over - lost
        const allMines = gridState.filter((t: any) => t.isMine).map((t: any) => t.index)

        await sql`
          UPDATE gaming_mines 
          SET grid_state = ${JSON.stringify(gridState)}, 
              revealed_tiles = ${JSON.stringify(revealedTiles)}, 
              status = 'lost', 
              completed_at = ${Date.now()}
          WHERE id = ${gameId}
        `

        return NextResponse.json({
          success: true,
          gameOver: true,
          won: false,
          revealedTile: tileIndex,
          isMine: true,
          revealedTiles,
          minePositions: allMines,
          gridState: gridState.map((t: any) => ({ index: t.index, revealed: t.revealed, isMine: t.isMine })),
        })
      }

      // Calculate new multiplier (increases with each safe reveal)
      const safeReveals = revealedTiles.length
      const newMultiplier = 1.0 + (safeReveals * 0.1) // 10% increase per safe reveal

      // Check if all safe tiles are revealed (game won)
      const totalSafeTiles = 25 - gridState.filter((t: any) => t.isMine).length
      if (revealedTiles.length >= totalSafeTiles) {
        // Game won
        const allMines = gridState.filter((t: any) => t.isMine).map((t: any) => t.index)

        await sql`
          UPDATE gaming_mines 
          SET grid_state = ${JSON.stringify(gridState)}, 
              revealed_tiles = ${JSON.stringify(revealedTiles)}, 
              status = 'won', 
              current_multiplier = ${newMultiplier},
              completed_at = ${Date.now()}
          WHERE id = ${gameId}
        `

        return NextResponse.json({
          success: true,
          gameOver: true,
          won: true,
          revealedTile: tileIndex,
          isMine: false,
          revealedTiles,
          minePositions: allMines,
          currentMultiplier: newMultiplier,
          gridState: gridState.map((t: any) => ({ index: t.index, revealed: t.revealed, isMine: t.isMine })),
        })
      }

      // Update game
      await sql`
        UPDATE gaming_mines 
        SET grid_state = ${JSON.stringify(gridState)}, 
            revealed_tiles = ${JSON.stringify(revealedTiles)}, 
            current_multiplier = ${newMultiplier}
        WHERE id = ${gameId}
      `

      return NextResponse.json({
        success: true,
        gameOver: false,
        revealedTile: tileIndex,
        isMine: false,
        currentMultiplier: newMultiplier,
        revealedTiles,
        gridState: gridState.map((t: any) => ({ index: t.index, revealed: t.revealed, isMine: false })), // Don't reveal mines
      })
    } catch (dbError: any) {
      console.error('Database error in reveal transaction:', dbError)
      throw dbError
    }
  } catch (error: any) {
    console.error('Error revealing tile:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to reveal tile',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
