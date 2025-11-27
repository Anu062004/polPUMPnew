import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gameId, tileIndex, userAddress } = body

    if (!gameId || tileIndex === undefined || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

    // Get game
    const game = await db.get('SELECT * FROM gaming_mines WHERE id = ? AND userAddress = ?', [gameId, userAddress.toLowerCase()])

    if (!game) {
      return NextResponse.json(
        { success: false, error: 'Game not found' },
        { status: 404 }
      )
    }

    if (game.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Game is not active' },
        { status: 400 }
      )
    }

    // Parse grid state
    let gridState: any[] = []
    try {
      gridState = JSON.parse(game.gridState || '[]')
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
      revealedTiles = JSON.parse(game.revealedTiles || '[]')
    } catch {}
    revealedTiles.push(tileIndex)

    // Check if it's a mine
    if (tile.isMine) {
      // Game over - lost
      await db.run(
        `UPDATE gaming_mines 
         SET gridState = ?, revealedTiles = ?, status = 'lost', completedAt = ?
         WHERE id = ?`,
        [JSON.stringify(gridState), JSON.stringify(revealedTiles), Date.now(), gameId]
      )

      await db.close()

      return NextResponse.json({
        success: true,
        gameOver: true,
        won: false,
        revealedTile: tileIndex,
        isMine: true,
        gridState: gridState.map((t: any) => ({ index: t.index, revealed: t.revealed, isMine: t.isMine })),
      })
    }

    // Calculate new multiplier (increases with each safe reveal)
    const safeReveals = revealedTiles.length
    const newMultiplier = 1.0 + (safeReveals * 0.1) // 10% increase per safe reveal

    // Update game
    await db.run(
      `UPDATE gaming_mines 
       SET gridState = ?, revealedTiles = ?, currentMultiplier = ?
       WHERE id = ?`,
      [JSON.stringify(gridState), JSON.stringify(revealedTiles), newMultiplier, gameId]
    )

    await db.close()

    return NextResponse.json({
      success: true,
      gameOver: false,
      revealedTile: tileIndex,
      isMine: false,
      currentMultiplier: newMultiplier,
      revealedTiles,
      gridState: gridState.map((t: any) => ({ index: t.index, revealed: t.revealed, isMine: false })), // Don't reveal mines
    })
  } catch (error: any) {
    console.error('Error revealing tile:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reveal tile' },
      { status: 500 }
    )
  }
}

