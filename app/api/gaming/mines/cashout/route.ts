import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { gameId, userAddress } = body

    if (!gameId || !userAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    try {
      await databaseManager.initialize()
    } catch (dbError: any) {
      console.error('Database initialization error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Database not available. Please try again later.' },
        { status: 503 }
      )
    }

    let db
    try {
      db = await databaseManager.getConnection()
    } catch (dbError: any) {
      console.error('Database connection error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again.' },
        { status: 503 }
      )
    }

    // Ensure table exists
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS gaming_mines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userAddress TEXT NOT NULL,
          betAmount REAL NOT NULL,
          tokenAddress TEXT NOT NULL,
          minesCount INTEGER NOT NULL,
          gridState TEXT NOT NULL,
          revealedTiles TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          currentMultiplier REAL NOT NULL DEFAULT 1.0,
          cashoutAmount REAL,
          createdAt INTEGER NOT NULL,
          completedAt INTEGER
        )
      `)
    } catch (tableError: any) {
      console.warn('Table creation warning (may already exist):', tableError.message)
    }

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

    // Calculate cashout amount
    const cashoutAmount = parseFloat(game.betAmount) * parseFloat(game.currentMultiplier)

    // Mark as cashed out
    await db.run(
      `UPDATE gaming_mines 
       SET status = 'cashed_out', cashoutAmount = ?, completedAt = ?
       WHERE id = ?`,
      [cashoutAmount, Date.now(), gameId]
    )

    await db.close()

    return NextResponse.json({
      success: true,
      cashoutAmount,
      multiplier: game.currentMultiplier,
    })
  } catch (error: any) {
    console.error('Error cashing out:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cash out' },
      { status: 500 }
    )
  }
}

