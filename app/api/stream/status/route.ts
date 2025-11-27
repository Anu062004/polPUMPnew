/**
 * API Route: Get Stream Status
 * 
 * GET /api/stream/status?tokenAddress=0x...
 * 
 * Returns current livestream status for a token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getLivestream } from '../../../../lib/livestreamDatabase'
import { buildLivestreamUrls } from '../../../../lib/livestreamHelpers'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tokenAddress = searchParams.get('tokenAddress')

    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    const normalizedAddress = tokenAddress.toLowerCase()
    const livestream = await getLivestream(normalizedAddress)

    if (!livestream) {
      return NextResponse.json({
        success: true,
        isLive: false,
        tokenAddress: normalizedAddress,
        playbackUrl: null,
        streamKey: null,
      })
    }

    // Build playback URL if live
    let playbackUrl: string | null = null
    if (livestream.status === 'live') {
      // Use stored playback base URL or build from config
      if (livestream.playbackBaseUrl) {
        playbackUrl = `${livestream.playbackBaseUrl.replace(/\/$/, '')}/${livestream.streamKey}/index.m3u8`
      } else {
        // Fallback: build from environment
        const urls = buildLivestreamUrls(normalizedAddress)
        playbackUrl = urls.playbackUrl
      }
    }

    return NextResponse.json({
      success: true,
      isLive: livestream.status === 'live',
      tokenAddress: livestream.tokenAddress,
      playbackUrl,
      streamKey: livestream.streamKey,
      creatorAddress: livestream.creatorAddress,
    })
  } catch (error: any) {
    console.error('Error getting livestream status:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get livestream status' },
      { status: 500 }
    )
  }
}


