import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres } from '../../../../../lib/gamingPostgres'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
import { verifySignatureWithTimestamp } from '../../../../../lib/authUtils'
import { validateAddress, validatePositiveNumber, validateMinesCount } from '../../../../../lib/validationUtils'

function toRows(result: any): any[] {
  return Array.isArray(result) ? result : result?.rows || []
}

/**
 * Start a new Mines game
 * SECURITY: Requires wallet signature verification
 * FIXES: Uses Postgres, input validation, transaction safety
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userAddress,
      betAmount,
      tokenAddress,
      minesCount,
      signature,
      message
    } = body

    // Input validation
    const addressValidation = validateAddress(userAddress)
    if (!addressValidation.isValid) {
      return NextResponse.json(
        { success: false, error: addressValidation.error },
        { status: 400 }
      )
    }

    const amountValidation = validatePositiveNumber(betAmount, 'Bet amount')
    if (!amountValidation.isValid) {
      return NextResponse.json(
        { success: false, error: amountValidation.error },
        { status: 400 }
      )
    }

    const tokenValidation = validateAddress(tokenAddress)
    if (!tokenValidation.isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    const minesValidation = validateMinesCount(minesCount)
    if (!minesValidation.isValid) {
      return NextResponse.json(
        { success: false, error: minesValidation.error },
        { status: 400 }
      )
    }

    // Wallet signature verification (SECURITY FIX)
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNATURE === 'true') {
      if (!signature || !message) {
        return NextResponse.json(
          {
            success: false,
            error: 'Wallet signature required. Please sign the message to start game.'
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

    // Generate random mine positions (25 tiles, minesCount mines)
    const totalTiles = 25
    const minePositions: number[] = []
    while (minePositions.length < minesCount) {
      const pos = Math.floor(Math.random() * totalTiles)
      if (!minePositions.includes(pos)) {
        minePositions.push(pos)
      }
    }
    minePositions.sort((a, b) => a - b)

    // Create grid state with mine positions
    const gridState = Array(totalTiles).fill(null).map((_, i) => ({
      index: i,
      isMine: minePositions.includes(i),
      revealed: false,
    }))

    // Create game session in Postgres
    const result = await sql`
      INSERT INTO gaming_mines 
      (user_address, bet_amount, token_address, mines_count, grid_state, revealed_tiles, status, current_multiplier, created_at)
      VALUES (${userAddress.toLowerCase()}, ${betAmount}, ${tokenAddress.toLowerCase()}, ${minesCount}, ${JSON.stringify(gridState)}, ${JSON.stringify([])}, 'active', 1.0, ${Date.now()})
      RETURNING id
    `
    const rows = toRows(result)
    const gameId = rows[0]?.id

    if (!gameId) {
      throw new Error('Failed to create mines game')
    }

    return NextResponse.json({
      success: true,
      gameId,
      totalTiles,
      minesCount,
      // Don't send mine positions to client
    })
  } catch (error: any) {
    console.error('Error starting mines game:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to start game',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
