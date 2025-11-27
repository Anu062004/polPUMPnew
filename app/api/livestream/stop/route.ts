import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { getTokenCreator, upsertLivestream, getLivestream } from '../../../../lib/livestreamDatabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenAddress, creatorAddress } = body

    // Validate token address
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    // Validate creator address
    if (!creatorAddress || !ethers.isAddress(creatorAddress)) {
      return NextResponse.json(
        { success: false, error: 'Creator address required' },
        { status: 400 }
      )
    }

    // Verify creator is the token creator
    const tokenCreator = await getTokenCreator(tokenAddress)
    
    // If token creator not found, allow if creatorAddress matches (for on-chain tokens)
    if (!tokenCreator) {
      console.warn(`Token creator not found for ${tokenAddress}, allowing if creatorAddress matches`)
      // For on-chain tokens without creator in DB, we'll allow it if the address is valid
    } else {
      // Check if caller is the creator (case-insensitive)
      if (tokenCreator.toLowerCase() !== creatorAddress.toLowerCase()) {
        return NextResponse.json(
          { success: false, error: 'Only token creator can stop livestream' },
          { status: 403 }
        )
      }
    }

    // Check if livestream exists
    const existing = await getLivestream(tokenAddress)
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Livestream not found' },
        { status: 404 }
      )
    }

    // Update status to offline
    await upsertLivestream(tokenAddress, creatorAddress, 'offline')

    return NextResponse.json({
      success: true,
      tokenAddress: existing.tokenAddress,
    })
  } catch (error: any) {
    console.error('Error stopping livestream:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to stop livestream' },
      { status: 500 }
    )
  }
}
