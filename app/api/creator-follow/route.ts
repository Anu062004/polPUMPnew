import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { withAuth } from '../../../lib/roleMiddleware'
import {
  followCreator,
  getCreatorFollowerCount,
  getFollowedCreator,
  unfollowCreator,
} from '../../../lib/creatorService'
import { getDb } from '../../../lib/postgresManager'

// GET /api/creator-follow
// - No query: returns which creator current wallet follows (max one).
// - ?creatorWallet=0x...: returns creator profile + associated tokens + follower count.
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const creatorWalletQuery = request.nextUrl.searchParams.get('creatorWallet')
    let followed: Awaited<ReturnType<typeof getFollowedCreator>> = null
    try {
      followed = await getFollowedCreator(user.wallet)
    } catch {
      followed = null
    }

    if (!creatorWalletQuery) {
      return NextResponse.json({
        success: true,
        followerWallet: user.wallet,
        followedCreator: followed?.creatorWallet || null,
        followedAt: followed?.followedAt || null,
      })
    }

    if (!ethers.isAddress(creatorWalletQuery)) {
      return NextResponse.json(
        { success: false, error: 'Invalid creator wallet address' },
        { status: 400 }
      )
    }

    const creatorWallet = creatorWalletQuery.toLowerCase()
    let followerCount = 0
    try {
      followerCount = await getCreatorFollowerCount(creatorWallet)
    } catch {
      followerCount = 0
    }

    let tokens: Array<{ tokenAddress: string; coinId: string | null; createdAt: number }> = []
    try {
      const db = await getDb()
      if (db.type === 'pg' && db.pool) {
        const tokenRows = await db.pool.query(
          `SELECT token_address, coin_id, created_at
           FROM creator_tokens
           WHERE creator_wallet = $1
           ORDER BY created_at DESC
           LIMIT 200`,
          [creatorWallet]
        )

        tokens = tokenRows.rows.map((row: any) => ({
          tokenAddress: row.token_address,
          coinId: row.coin_id || null,
          createdAt: Number(row.created_at || 0),
        }))
      }
    } catch {
      tokens = []
    }

    return NextResponse.json({
      success: true,
      creatorWallet,
      followerCount,
      associatedTokens: tokens,
      isFollowing: followed?.creatorWallet === creatorWallet,
      yourFollowedCreator: followed?.creatorWallet || null,
    })
  } catch (error: any) {
    console.error('Error reading creator follow data:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to load creator follow data' },
      { status: 500 }
    )
  }
})

// POST /api/creator-follow
// Body: { creatorWallet: string }
// Enforces one followed creator per follower wallet.
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const creatorWallet = body?.creatorWallet as string

    if (!creatorWallet || !ethers.isAddress(creatorWallet)) {
      return NextResponse.json(
        { success: false, error: 'Invalid creator wallet address' },
        { status: 400 }
      )
    }

    const followRecord = await followCreator(user.wallet, creatorWallet.toLowerCase())
    return NextResponse.json({
      success: true,
      follow: followRecord,
      message: 'Now following creator. Only one creator can be followed per wallet.',
    })
  } catch (error: any) {
    console.error('Error following creator:', error)
    const message = error.message || 'Failed to follow creator'
    const status =
      message.includes('not a registered creator') ||
      message.includes('cannot follow your own wallet')
        ? 400
        : 500
    return NextResponse.json(
      { success: false, error: message },
      { status }
    )
  }
})

// DELETE /api/creator-follow
// Removes current wallet's followed creator (if any).
export const DELETE = withAuth(async (_request: NextRequest, user) => {
  try {
    const result = await unfollowCreator(user.wallet)
    return NextResponse.json({
      success: true,
      removed: result.removed,
    })
  } catch (error: any) {
    console.error('Error unfollowing creator:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to unfollow creator' },
      { status: 500 }
    )
  }
})
