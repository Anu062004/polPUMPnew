import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getTokenCreator, upsertLivestream } from '../../../../lib/livestreamDatabase'
import { buildLivestreamUrls } from '../../../../lib/livestreamHelpers'
import { withCreatorAuth } from '../../../../lib/roleMiddleware'

export const POST = withCreatorAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { tokenAddress } = body

    // Validate token address
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    // Use authenticated user's wallet as creator address
    const creatorAddress = user.wallet

    // Verify creator is the token creator (optional check - role already verified)
    const tokenCreator = await getTokenCreator(tokenAddress)

    // If token creator not found, allow if creatorAddress matches (for on-chain tokens)
    if (!tokenCreator) {
      console.warn(`Token creator not found for ${tokenAddress}, allowing CREATOR role user`)
      // For on-chain tokens without creator in DB, we'll allow CREATOR role users
      // This is a fallback for tokens not yet indexed
    } else {
      // Check if caller is the creator (case-insensitive)
      if (tokenCreator.toLowerCase() !== creatorAddress.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'Only token creator can start livestream' },
          { status: 403 }
        )
      }
    }

    // Create or update livestream record
    const livestream = await upsertLivestream(
      tokenAddress,
      creatorAddress,
      'live'
    )

    // Build URLs
    const urls = buildLivestreamUrls(tokenAddress)

    return NextResponse.json({
      success: true,
      tokenAddress: livestream.tokenAddress,
      streamKey: livestream.streamKey,
      ingestUrl: urls.ingestBaseUrl, // Base URL for OBS server (without stream key)
      ingestUrlFull: urls.ingestUrl, // Full URL with stream key
      playbackUrl: urls.playbackUrl,
      ingestBaseUrl: urls.ingestBaseUrl,
      playbackBaseUrl: urls.playbackBaseUrl,
    })
  } catch (error: any) {
    console.error('Error starting livestream:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start livestream' },
      { status: 500 }
    )
  }
})
