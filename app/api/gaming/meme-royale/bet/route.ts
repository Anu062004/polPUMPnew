import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { leftCoin, rightCoin, userAddress, stakeAmount, stakeSide, tokenAddress, txHash } = body

    if (!leftCoin || !rightCoin || !userAddress || !stakeAmount || !stakeSide) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

    // Simple AI judgment: random scores for now (can be enhanced with real AI)
    const leftScore = Math.random() * 100
    const rightScore = Math.random() * 100
    const winnerCoinId = leftScore > rightScore ? leftCoin.id || leftCoin.tokenAddress : rightCoin.id || rightCoin.tokenAddress

    // Record the battle
    const result = await db.run(
      `INSERT INTO gaming_meme_royale 
       (leftCoinId, rightCoinId, leftScore, rightScore, winnerCoinId, judge, createdAt)
       VALUES (?, ?, ?, ?, ?, 'random-judge', ?)`,
      [
        leftCoin.id || leftCoin.tokenAddress,
        rightCoin.id || rightCoin.tokenAddress,
        leftScore,
        rightScore,
        winnerCoinId,
        Date.now(),
      ]
    )

    const battleId = (result as any).lastID

    // Check if user won
    const userWon = (stakeSide === 'left' && winnerCoinId === (leftCoin.id || leftCoin.tokenAddress)) ||
                    (stakeSide === 'right' && winnerCoinId === (rightCoin.id || rightCoin.tokenAddress))

    await db.close()

    return NextResponse.json({
      success: true,
      judged: true,
      battleId,
      leftScore,
      rightScore,
      winnerCoinId,
      userWon,
      message: userWon ? 'You won!' : 'You lost. Better luck next time!',
    })
  } catch (error: any) {
    console.error('Error processing battle:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process battle' },
      { status: 500 }
    )
  }
}

