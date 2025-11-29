import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getLivestream } from '../../../../lib/livestreamDatabase'
import { buildLivestreamUrls } from '../../../../lib/livestreamHelpers'

export const dynamic = 'force-dynamic'

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
      })
    }

    // Build playback URL if live
    const playbackUrl = livestream.status === 'live' 
      ? buildLivestreamUrls(normalizedAddress).playbackUrl 
      : null

    return NextResponse.json({
      success: true,
      isLive: livestream.status === 'live',
      tokenAddress: livestream.tokenAddress,
      playbackUrl,
      streamKey: livestream.streamKey,
    })
  } catch (error: any) {
    console.error('Error getting livestream status:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get livestream status' },
      { status: 500 }
    )
  }
}

