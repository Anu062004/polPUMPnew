/**
 * API Route: Stream Publish Notification
 * 
 * POST /api/stream/on-publish
 * 
 * Called by the streaming server when OBS starts publishing.
 * Updates the stream status to ensure it's marked as live.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLivestream, upsertLivestream } from '../../../../lib/livestreamDatabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { streamKey, tokenAddress, streamPath } = body

    if (!streamKey) {
      return NextResponse.json(
        { success: false, error: 'Stream key required' },
        { status: 400 }
      )
    }

    // Find livestream
    let livestream = null
    if (tokenAddress) {
      livestream = await getLivestream(tokenAddress.toLowerCase())
    } else {
      // Extract from stream key
      const parts = streamKey.split('-')
      if (parts.length >= 2) {
        const possibleAddress = parts[0]
        if (possibleAddress.startsWith('0x') && possibleAddress.length === 42) {
          livestream = await getLivestream(possibleAddress.toLowerCase())
        }
      }
    }

    if (!livestream || livestream.streamKey !== streamKey) {
      return NextResponse.json(
        { success: false, error: 'Stream not found or key mismatch' },
        { status: 404 }
      )
    }

    // Ensure stream is marked as live
    if (livestream.status !== 'live') {
      await upsertLivestream(
        livestream.tokenAddress,
        livestream.creatorAddress,
        'live',
        livestream.streamKey,
        livestream.ingestBaseUrl,
        livestream.playbackBaseUrl
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Stream publish acknowledged',
    })
  } catch (error: any) {
    console.error('Error handling stream publish:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}





