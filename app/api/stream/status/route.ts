/**
 * API Route: Get Stream Status
 * 
 * GET /api/stream/status?tokenAddress=0x...
 * 
 * Returns current livestream status for a token.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getLivestream, upsertLivestream } from '../../../../lib/livestreamDatabase'
import { buildLivestreamUrls } from '../../../../lib/livestreamHelpers'
import { getIvsLiveStream, isIvsConfigured } from '../../../../lib/ivsService'

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
    let playbackUrl: string | null = null
    let isLive = livestream.status === 'live'

    // If this stream is backed by AWS IVS, verify live status from IVS
    // only when DB currently marks it live.
    // If creator explicitly stopped (DB offline), respect offline immediately.
    if (livestream.status === 'live' && livestream.channelArn && isIvsConfigured()) {
      const ivsStream = await getIvsLiveStream(livestream.channelArn)
      if (ivsStream) {
        isLive = true
        playbackUrl = ivsStream.playbackUrl || livestream.playbackUrl || livestream.playbackBaseUrl || null
      } else {
        isLive = false
        if (livestream.status !== 'offline') {
          await upsertLivestream(
            livestream.tokenAddress,
            livestream.creatorAddress,
            'offline',
            livestream.streamKey,
            livestream.ingestBaseUrl,
            livestream.playbackBaseUrl,
            {
              channelArn: livestream.channelArn,
              streamKeyArn: livestream.streamKeyArn,
              ingestEndpoint: livestream.ingestEndpoint,
              playbackUrl: livestream.playbackUrl,
              provider: livestream.provider,
              channelType: livestream.channelType,
            }
          )
        }
      }
    } else if (isLive) {
      // Legacy self-hosted streaming fallback.
      if (livestream.playbackUrl) {
        playbackUrl = livestream.playbackUrl
      } else if (livestream.playbackBaseUrl?.includes('.m3u8')) {
        playbackUrl = livestream.playbackBaseUrl
      } else if (livestream.playbackBaseUrl) {
        playbackUrl = `${livestream.playbackBaseUrl.replace(/\/$/, '')}/${livestream.streamKey}/index.m3u8`
      } else {
        const urls = buildLivestreamUrls(normalizedAddress)
        playbackUrl = urls.playbackUrl
      }
    }

    return NextResponse.json({
      success: true,
      isLive,
      tokenAddress: livestream.tokenAddress,
      playbackUrl,
      creatorAddress: livestream.creatorAddress,
      provider: livestream.provider,
    })
  } catch (error: any) {
    console.error('Error getting livestream status:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get livestream status' },
      { status: 500 }
    )
  }
}
