/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, issueAccessToken, issueRefreshToken } from '../../../../lib/jwtUtils'
import { resolveLockedRole, type Role } from '../../../../lib/roleService'
import { getDb } from '../../../../lib/postgresManager'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { refreshToken } = body

    if (!refreshToken) {
      return NextResponse.json(
        { success: false, error: 'Refresh token required' },
        { status: 400 }
      )
    }

    // Verify refresh token
    const payload = await verifyToken(refreshToken, 'refresh')
    if (!payload || !payload.wallet || !payload.role) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

    const db = await getDb()
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex')

    if (db.type !== 'pg' || !db.pool) {
      return NextResponse.json(
        { success: false, error: 'Session storage unavailable' },
        { status: 503 }
      )
    }

    const sessionResult = await db.pool.query(
      `SELECT wallet
       FROM user_sessions
       WHERE wallet = $1
         AND refresh_token = $2
         AND expires_at > NOW()
       LIMIT 1`,
      [payload.wallet.toLowerCase(), refreshTokenHash]
    )

    if (!sessionResult.rows[0]?.wallet) {
      return NextResponse.json(
        { success: false, error: 'Refresh token revoked or expired' },
        { status: 401 }
      )
    }

    // Resolve wallet-locked role (prevents role switching per wallet)
    const sessionRole = payload.role as Role
    const newRole = await resolveLockedRole(payload.wallet, sessionRole)

    // Rotate refresh token and issue new access token.
    const newAccessToken = await issueAccessToken(payload.wallet, newRole)
    const newRefreshToken = await issueRefreshToken(payload.wallet, newRole)
    const newRefreshTokenHash = crypto
      .createHash('sha256')
      .update(newRefreshToken)
      .digest('hex')

    await db.pool.query(
      `UPDATE user_sessions
       SET role = $2, refresh_token = $3, expires_at = $4, updated_at = $5
       WHERE wallet = $1`,
      [
        payload.wallet.toLowerCase(),
        newRole,
        newRefreshTokenHash,
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        new Date().toISOString(),
      ]
    )

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      role: newRole,
      roleChanged: newRole !== sessionRole,
    })
  } catch (error: any) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Token refresh failed' },
      { status: 500 }
    )
  }
}










