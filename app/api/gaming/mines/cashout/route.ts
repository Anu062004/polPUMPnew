import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres } from '../../../../../lib/gamingPostgres'
import { verifySignatureWithTimestamp } from '../../../../../lib/authUtils'
import { validateGameId, validateAddress } from '../../../../../lib/validationUtils'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Cash out from a Mines game
 * SECURITY: Requires wallet signature verification
 * FIXES: Uses Postgres, has transactions, prevents double cashout (race condition)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      gameId,
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

    // Wallet signature verification (SECURITY FIX)
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNATURE === 'true') {
      if (!signature || !message) {
        return NextResponse.json(
          {
            success: false,
            error: 'Wallet signature required. Please sign the message to cash out.'
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

    // Use transaction with row lock to prevent double cashout (RACE CONDITION FIX)
    try {
      // Lock the row for update to prevent concurrent cashouts
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
          {
            success: false,
            error: `Game is not active (status: ${game.status})`
          },
          { status: 400 }
        )
      }

      // Calculate cashout amount
      const cashoutAmount = parseFloat(game.bet_amount) * parseFloat(game.current_multiplier)

      // Atomically update status to prevent double cashout
      const updateResult = await sql`
        UPDATE gaming_mines 
        SET status = 'cashed_out', 
            cashout_amount = ${cashoutAmount}, 
            completed_at = ${Date.now()}
        WHERE id = ${gameId} 
        AND status = 'active'
        RETURNING *
      `

      // Check if update succeeded (another request may have cashed out first)
      if (updateResult.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Game was already cashed out or is no longer active'
          },
          { status: 409 } // Conflict
        )
      }

      return NextResponse.json({
        success: true,
        cashoutAmount,
        multiplier: game.current_multiplier,
      })
    } catch (dbError: any) {
      // Transaction will rollback automatically on error
      console.error('Database error in cashout transaction:', dbError)
      throw dbError
    }
  } catch (error: any) {
    console.error('Error cashing out:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to cash out',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
