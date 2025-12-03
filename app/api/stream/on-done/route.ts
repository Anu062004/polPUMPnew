/**
 * API Route: Stream Done Notification
 * 
 * POST /api/stream/on-done
 * 
 * Called by the streaming server when OBS stops publishing.
 * Marks the stream as offline.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getLivestream, upsertLivestream } from '../../../../lib/livestreamDatabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { streamKey, streamPath } = body

    if (!streamKey) {
      return NextResponse.json(
        { success: false, error: 'Stream key required' },
        { status: 400 }
      )
    }

    // Extract token address from stream key
    const parts = streamKey.split('-')
    if (parts.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Invalid stream key format' },
        { status: 400 }
      )
    }

    const tokenAddress = parts[0]
    if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address in stream key' },
        { status: 400 }
      )
    }

    // Find livestream
    const livestream = await getLivestream(tokenAddress.toLowerCase())

    if (!livestream || livestream.streamKey !== streamKey) {
      // Stream might have already been stopped, that's okay
      return NextResponse.json({
        success: true,
        message: 'Stream already stopped or not found',
      })
    }

    // Mark stream as offline
    await upsertLivestream(
      livestream.tokenAddress,
      livestream.creatorAddress,
      'offline',
      livestream.streamKey,
      livestream.ingestBaseUrl,
      livestream.playbackBaseUrl
    )

    return NextResponse.json({
      success: true,
      message: 'Stream marked as offline',
    })
  } catch (error: any) {
    console.error('Error handling stream done:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}





