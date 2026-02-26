import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { upsertLivestream, getLivestream, getTokenCreator } from '../../../../lib/livestreamDatabase'
import { withCreatorAuth } from '../../../../lib/roleMiddleware'

export const dynamic = 'force-dynamic'

export const POST = withCreatorAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const tokenAddress = body?.tokenAddress as string

    // Validate inputs
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    const creatorAddress = user.wallet.toLowerCase()

    // Check if stream exists
    const existing = await getLivestream(tokenAddress.toLowerCase())
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'No active stream found' },
        { status: 404 }
      )
    }

    // Verify creator
    const tokenCreator = await getTokenCreator(tokenAddress)
    if (tokenCreator && tokenCreator.toLowerCase() !== creatorAddress.toLowerCase()) {
      return NextResponse.json(
        { success: false, error: 'Only token creator can stop livestream' },
        { status: 403 }
      )
    }

    // Mark stream as offline
    await upsertLivestream(
      tokenAddress,
      creatorAddress,
      'offline',
      existing.streamKey,
      existing.ingestBaseUrl,
      existing.playbackBaseUrl,
      {
        channelArn: existing.channelArn,
        streamKeyArn: existing.streamKeyArn,
        ingestEndpoint: existing.ingestEndpoint,
        playbackUrl: existing.playbackUrl,
        provider: existing.provider,
        channelType: existing.channelType,
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Livestream stopped',
    })
  } catch (error: any) {
    console.error('Error stopping livestream:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to stop livestream' },
      { status: 500 }
    )
  }
})





