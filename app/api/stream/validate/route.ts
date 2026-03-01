/**
 * API Route: Validate Stream Key
 * 
 * GET /api/stream/validate?streamKey=...&tokenAddress=0x...
 * 
 * Used by the streaming server to validate stream keys before allowing publish.
 * Returns whether the stream key is valid and the stream is marked as "live".
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getLivestream } from '../../../../lib/livestreamDatabase'
import { requireStreamWebhookAuth } from '../../../../lib/streamWebhookAuth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authError = requireStreamWebhookAuth(request)
    if (authError) return authError

    const { searchParams } = new URL(request.url)
    const streamKey = searchParams.get('streamKey')
    const tokenAddress = searchParams.get('tokenAddress')

    if (!streamKey) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Stream key required' },
        { status: 400 }
      )
    }

    // If token address provided, validate format
    if (tokenAddress && !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, valid: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    // Find livestream by stream key or token address
    let livestream = null
    
    if (tokenAddress) {
      livestream = await getLivestream(tokenAddress.toLowerCase())
    } else {
      // Try to extract token address from stream key (format: tokenAddress-randomSecret)
      const parts = streamKey.split('-')
      if (parts.length >= 2) {
        // Token address should be the first part (42 chars: 0x + 40 hex)
        const possibleAddress = parts[0]
        if (possibleAddress.startsWith('0x') && possibleAddress.length === 42) {
          livestream = await getLivestream(possibleAddress.toLowerCase())
        }
      }
    }

    // Validate stream key matches and stream is live
    if (!livestream) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: 'Stream not found',
      })
    }

    if (livestream.streamKey !== streamKey) {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: 'Stream key mismatch',
      })
    }

    if (livestream.status !== 'live') {
      return NextResponse.json({
        success: true,
        valid: false,
        reason: 'Stream not marked as live',
      })
    }

    return NextResponse.json({
      success: true,
      valid: true,
      tokenAddress: livestream.tokenAddress,
    })
  } catch (error: any) {
    console.error('Error validating stream key:', error)
    return NextResponse.json(
      { success: false, valid: false, error: error.message },
      { status: 500 }
    )
  }
}


