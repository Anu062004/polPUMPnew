/**
 * API Route: Start Live Stream
 * 
 * POST /api/stream/start
 * Body: { tokenAddress: string, creatorAddress: string }
 * 
 * Validates that caller is the token creator, generates a stream key,
 * and marks the stream as "live" in the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { upsertLivestream, getTokenCreator } from '../../../../lib/livestreamDatabase'
import { generateStreamKey } from '../../../../lib/livestreamHelpers'
import crypto from 'crypto'

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

    // Verify creator is the token creator
    const tokenCreator = await getTokenCreator(tokenAddress)
    
    if (tokenCreator) {
      // Check if caller is the creator (case-insensitive)
      if (tokenCreator.toLowerCase() !== creatorAddress.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'Only token creator can start livestream' },
          { status: 403 }
        )
      }
    }
    // If token creator not found in DB, allow if address is valid (for on-chain tokens)

    // Generate stream key: tokenAddress-randomSecret
    const randomSecret = crypto.randomBytes(16).toString('hex')
    const streamKey = `${tokenAddress.toLowerCase()}-${randomSecret}`

    // Get streaming server URLs from environment
    const rtmpUrl = process.env.RTMP_URL || 'rtmp://localhost:1935/live'
    const hlsBaseUrl = process.env.NEXT_PUBLIC_HLS_BASE_URL || 'http://localhost:8000/live'
    const ingestBaseUrl = rtmpUrl.replace(/\/[^/]+$/, '') // Remove /live part for base URL

    // Create or update livestream record
    const livestream = await upsertLivestream(
      tokenAddress,
      creatorAddress,
      'live',
      streamKey,
      ingestBaseUrl,
      hlsBaseUrl
    )

    // Build full URLs
    const playbackUrl = `${hlsBaseUrl.replace(/\/$/, '')}/${streamKey}/index.m3u8`
    const ingestUrlFull = `${rtmpUrl}/${streamKey}`

    return NextResponse.json({
      success: true,
      tokenAddress: livestream.tokenAddress,
      streamKey: livestream.streamKey,
      rtmpUrl: rtmpUrl, // Base RTMP URL (without stream key)
      ingestUrl: ingestBaseUrl, // Base ingest URL
      ingestUrlFull: ingestUrlFull, // Full RTMP URL with stream key
      playbackUrl: playbackUrl,
      hlsBaseUrl: hlsBaseUrl,
    })
  } catch (error: any) {
    console.error('Error starting livestream:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start livestream' },
      { status: 500 }
    )
  }
}



