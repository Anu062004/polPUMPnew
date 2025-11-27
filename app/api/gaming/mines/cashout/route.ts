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

    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

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

