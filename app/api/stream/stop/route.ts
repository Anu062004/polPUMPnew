/**
 * API Route: Stop Live Stream
 * 
 * POST /api/stream/stop
 * Body: { tokenAddress: string, creatorAddress: string }
 * 
 * Validates creator and marks the stream as "offline".
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { upsertLivestream, getLivestream, getTokenCreator } from '../../../../lib/livestreamDatabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenAddress, creatorAddress } = body

    // Validate inputs
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    if (!creatorAddress || !ethers.isAddress(creatorAddress)) {
      return NextResponse.json(
        { success: false, error: 'Creator address required' },
        { status: 400 }
      )
    }

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
      existing.playbackBaseUrl
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
}


