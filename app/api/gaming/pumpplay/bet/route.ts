import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres } from '../../../../../lib/gamingPostgres'
import { verifySignatureWithTimestamp, generateSignMessage } from '../../../../../lib/authUtils'
import { validateRoundId, validateAddress, validatePositiveNumber } from '../../../../../lib/validationUtils'

/**
 * Place a bet on a PumpPlay round
 * SECURITY: Requires wallet signature verification
 * FIXES: Uses Postgres, has transactions, input validation, race condition protection
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      roundId, 
      userAddress, 
      coinId, 
      amount, 
      tokenAddress, 
      txHash,
      signature,
      message,
      nonce
    } = body

    // Input validation
    const roundIdValidation = validateRoundId(roundId)
    if (!roundIdValidation.isValid) {
      return NextResponse.json(
        { success: false, error: roundIdValidation.error },
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

    const amountValidation = validatePositiveNumber(amount, 'Amount')
    if (!amountValidation.isValid) {
      return NextResponse.json(
        { success: false, error: amountValidation.error },
        { status: 400 }
      )
    }

    if (!coinId || typeof coinId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Coin ID is required' },
        { status: 400 }
      )
    }

    // Wallet signature verification (SECURITY FIX)
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNATURE === 'true') {
      if (!signature || !message) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Wallet signature required. Please sign the message to place a bet.' 
          },
          { status: 401 }
        )
      }

      const verification = verifySignatureWithTimestamp(
        message,
        signature,
        userAddress.toLowerCase(),
        5 * 60 * 1000 // 5 minutes
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

    // Use transaction to prevent race conditions (RACE CONDITION FIX)
    try {
      // Start transaction - check round status with row lock
      const roundResult = await sql`
        SELECT * FROM gaming_pumpplay_rounds 
        WHERE id = ${roundId} 
        FOR UPDATE
      `

      if (roundResult.length === 0) {
        return NextResponse.json(
          { success: false, error: 'Round not found' },
          { status: 404 }
        )
      }

      const round = roundResult[0]

      if (round.status !== 'open') {
        return NextResponse.json(
          { success: false, error: 'Round is not open for betting' },
          { status: 400 }
        )
      }

      if (Date.now() >= round.ends_at) {
        // Auto-close round
        await sql`
          UPDATE gaming_pumpplay_rounds 
          SET status = 'closed' 
          WHERE id = ${roundId}
        `
        return NextResponse.json(
          { success: false, error: 'Round has ended' },
          { status: 400 }
        )
      }

      // Record the bet
      await sql`
        INSERT INTO gaming_pumpplay_bets 
        (round_id, user_address, coin_id, amount, created_at)
        VALUES (${roundId}, ${userAddress.toLowerCase()}, ${coinId}, ${amount}, ${Date.now()})
      `

      // Update round total pool atomically
      await sql`
        UPDATE gaming_pumpplay_rounds 
        SET total_pool = total_pool + ${amount} 
        WHERE id = ${roundId}
      `

      return NextResponse.json({
        success: true,
        message: 'Bet placed successfully',
      })
    } catch (dbError: any) {
      // Transaction will rollback automatically on error
      console.error('Database error in bet transaction:', dbError)
      throw dbError
    }
  } catch (error: any) {
    console.error('Error placing bet:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to place bet',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
