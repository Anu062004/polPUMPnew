import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { withAuth } from '../../../../lib/roleMiddleware'
import {
  getActiveViewerCount,
  removeViewerPresence,
  touchViewerPresence,
} from '../../../../lib/livestreamViewerService'
import { getTokenCreator } from '../../../../lib/livestreamDatabase'

export const dynamic = 'force-dynamic'

function parseTokenAddress(input?: string | null): string | null {
  if (!input || !ethers.isAddress(input)) return null
  return input.toLowerCase()
}

function parseTokenAddressFromRequest(request: NextRequest): string | null {
  return parseTokenAddress(request.nextUrl.searchParams.get('tokenAddress'))
}

export async function GET(request: NextRequest) {
  try {
    const tokenAddress = parseTokenAddressFromRequest(request)
    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    const viewerCount = await getActiveViewerCount(tokenAddress)

    return NextResponse.json({
      success: true,
      tokenAddress,
      viewerCount,
    })
  } catch (error: any) {
    console.error('Error getting viewer count:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get viewer count' },
      { status: 500 }
    )
  }
}

export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const tokenAddress = parseTokenAddress(body?.tokenAddress)

    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    const tokenCreator = await getTokenCreator(tokenAddress)
    const normalizedUserWallet = user.wallet.toLowerCase()
    const isTokenCreator =
      !!tokenCreator && tokenCreator.toLowerCase() === normalizedUserWallet

    await touchViewerPresence(tokenAddress, normalizedUserWallet, user.role, isTokenCreator)
    const viewerCount = await getActiveViewerCount(tokenAddress)

    return NextResponse.json({
      success: true,
      tokenAddress,
      viewerCount,
    })
  } catch (error: any) {
    console.error('Error updating viewer presence:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update viewer presence' },
      { status: 500 }
    )
  }
})

export const DELETE = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json().catch(() => ({}))
    const tokenAddress =
      parseTokenAddress(body?.tokenAddress) || parseTokenAddressFromRequest(request)

    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    await removeViewerPresence(tokenAddress, user.wallet)
    const viewerCount = await getActiveViewerCount(tokenAddress)

    return NextResponse.json({
      success: true,
      tokenAddress,
      viewerCount,
    })
  } catch (error: any) {
    console.error('Error removing viewer presence:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to remove viewer presence' },
      { status: 500 }
    )
  }
})
