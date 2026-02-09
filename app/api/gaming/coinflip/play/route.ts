import { NextRequest, NextResponse } from 'next/server'
import { requirePostgres, initializeGamingSchema } from '@/lib/gamingDb'
import { verifySignatureWithTimestamp } from '../../../../../lib/authUtils'
import { validateAddress, validatePositiveNumber, validateCoinflipChoice } from '../../../../../lib/validationUtils'
import { ethers } from 'ethers'
import { getEvmRpcUrl } from '../../../../../lib/rpcConfig'

// Force dynamic rendering to prevent build-time execution
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Play a coinflip game
 * SECURITY: Requires wallet signature verification
 * FIXES: Uses Postgres, input validation, removes hardcoded RPC
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      userAddress,
      wager,
      choice,
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

    const wagerValidation = validatePositiveNumber(wager, 'Wager')
    if (!wagerValidation.isValid) {
      return NextResponse.json(
        { success: false, error: wagerValidation.error },
        { status: 400 }
      )
    }

    const choiceValidation = validateCoinflipChoice(choice)
    if (!choiceValidation.isValid) {
      return NextResponse.json(
        { success: false, error: choiceValidation.error },
        { status: 400 }
      )
    }

    // Wallet signature verification (SECURITY FIX)
    if (process.env.NODE_ENV === 'production' || process.env.REQUIRE_SIGNATURE === 'true') {
      if (!signature || !message) {
        return NextResponse.json(
          {
            success: false,
            error: 'Wallet signature required. Please sign the message to play.'
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

    // Get a recent block for randomness (provably fair)
    const rpcUrl = getEvmRpcUrl() // FIX: Removed hardcoded API key
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    let blockNumber: number | null = null
    let blockHash: string | null = null

    try {
      const block = await provider.getBlock('latest')
      blockNumber = block?.number || null
      blockHash = block?.hash || null
    } catch (e) {
      console.warn('Failed to get block for randomness:', e)
    }

    // Generate outcome (heads = 0, tails = 1)
    // Use block hash if available, otherwise random
    let outcome: 'heads' | 'tails'
    if (blockHash) {
      // Use last bit of block hash
      const lastByte = parseInt(blockHash.slice(-2), 16)
      outcome = lastByte % 2 === 0 ? 'heads' : 'tails'
    } else {
      outcome = Math.random() < 0.5 ? 'heads' : 'tails'
    }

    const userWon = choice.toLowerCase() === outcome

    // Record the game in Postgres
    const seedHash = blockHash || ethers.id(`${userAddress}-${Date.now()}`)
    const seedReveal = blockHash || seedHash

    const result = await sql`
      INSERT INTO gaming_coinflip 
      (user_address, wager, outcome, seed_hash, seed_reveal, block_number, block_hash, created_at)
      VALUES (${userAddress.toLowerCase()}, ${wager}, ${userWon ? 'win' : 'lose'}, ${seedHash}, ${seedReveal}, ${blockNumber}, ${blockHash}, ${Date.now()})
      RETURNING id
    `

    return NextResponse.json({
      success: true,
      result: outcome,
      outcome: userWon ? 'win' : 'lose',
      userChoice: choice,
      won: userWon,
      blockNumber,
      blockHash,
    })
  } catch (error: any) {
    console.error('Error playing coinflip:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to play coinflip',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
