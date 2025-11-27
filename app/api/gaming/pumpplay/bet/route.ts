import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { roundId, userAddress, coinId, amount, tokenAddress, txHash } = body

    if (!roundId || !userAddress || !coinId || !amount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: roundId, userAddress, coinId, amount' },
        { status: 400 }
      )
    }

    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

    // Verify round exists and is open
    const round = await db.get(
      'SELECT * FROM gaming_pumpplay_rounds WHERE id = ?',
      [roundId]
    )

    if (!round) {
      return NextResponse.json(
        { success: false, error: 'Round not found' },
        { status: 404 }
      )
    }

    if (round.status !== 'open') {
      return NextResponse.json(
        { success: false, error: 'Round is not open for betting' },
        { status: 400 }
      )
    }

    if (Date.now() >= round.endsAt) {
      // Auto-close round
      await db.run('UPDATE gaming_pumpplay_rounds SET status = ? WHERE id = ?', ['closed', roundId])
      return NextResponse.json(
        { success: false, error: 'Round has ended' },
        { status: 400 }
      )
    }

    // Record the bet
    await db.run(
      `INSERT INTO gaming_pumpplay_bets (roundId, userAddress, coinId, amount, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [roundId, userAddress.toLowerCase(), coinId, amount, Date.now()]
    )

    // Update round total pool
    await db.run(
      'UPDATE gaming_pumpplay_rounds SET totalPool = totalPool + ? WHERE id = ?',
      [amount, roundId]
    )

    await db.close()

    return NextResponse.json({
      success: true,
      message: 'Bet placed successfully',
    })
  } catch (error: any) {
    console.error('Error placing bet:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to place bet' },
      { status: 500 }
    )
  }
}

