import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres } from '../../../../../lib/gamingPostgres'
import { verifySignatureWithTimestamp } from '../../../../../lib/authUtils'
import { validateAddress, validatePositiveNumber, validateStakeSide } from '../../../../../lib/validationUtils'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function toRows(result: any): any[] {
  return Array.isArray(result) ? result : result?.rows || []
}

/**
 * Start a Meme Royale battle
 * SECURITY: Requires wallet signature verification
 * FIXES: Uses Postgres, input validation, transaction safety
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      leftCoin,
      rightCoin,
      userAddress,
      stakeAmount,
      stakeSide,
      tokenAddress,
      txHash,
      signature,
      message
    } = body

    // Input validation
    if (!leftCoin || !rightCoin) {
      return NextResponse.json(
        { success: false, error: 'Both left and right coins are required' },
        { status: 400 }
      )
    }

    const leftCoinId = leftCoin.id || leftCoin.tokenAddress
    const rightCoinId = rightCoin.id || rightCoin.tokenAddress

    if (!leftCoinId || !rightCoinId) {
      return NextResponse.json(
        { success: false, error: 'Coin IDs are required' },
        { status: 400 }
      )
    }

    if (leftCoinId === rightCoinId) {
      return NextResponse.json(
        { success: false, error: 'Left and right coins must be different' },
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

    const amountValidation = validatePositiveNumber(stakeAmount, 'Stake amount')
    if (!amountValidation.isValid) {
      return NextResponse.json(
        { success: false, error: amountValidation.error },
        { status: 400 }
      )
    }

    const sideValidation = validateStakeSide(stakeSide)
    if (!sideValidation.isValid) {
      return NextResponse.json(
        { success: false, error: sideValidation.error },
        { status: 400 }
      )
    }

    // Wallet signature verification (SECURITY FIX)
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNATURE === 'true') {
      if (!signature || !message) {
        return NextResponse.json(
          {
            success: false,
            error: 'Wallet signature required. Please sign the message to start battle.'
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

    // Simple AI judgment: random scores for now (can be enhanced with real AI)
    const leftScore = Math.random() * 100
    const rightScore = Math.random() * 100
    const winnerCoinId = leftScore > rightScore ? leftCoinId : rightCoinId

    // Record the battle in Postgres
    const result = await sql`
      INSERT INTO gaming_meme_royale 
      (left_coin_id, right_coin_id, left_score, right_score, winner_coin_id, judge, created_at)
      VALUES (${leftCoinId}, ${rightCoinId}, ${leftScore}, ${rightScore}, ${winnerCoinId}, 'random-judge', ${Date.now()})
      RETURNING id
    `
    const rows = toRows(result)
    const battleId = rows[0]?.id

    if (!battleId) {
      throw new Error('Failed to create battle')
    }

    // Check if user won
    const userWon = (stakeSide.toLowerCase() === 'left' && winnerCoinId === leftCoinId) ||
      (stakeSide.toLowerCase() === 'right' && winnerCoinId === rightCoinId)

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
      {
        success: false,
        error: error.message || 'Failed to process battle',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
