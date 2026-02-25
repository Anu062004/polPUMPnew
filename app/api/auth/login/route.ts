/**
 * POST /api/auth/login
 * Wallet-based authentication endpoint
 * 
 * Flow:
 * 1. Client signs a message with their wallet
 * 2. Backend verifies signature
 * 3. Backend resolves wallet-locked role (assigned once per wallet)
 * 4. Backend issues JWT tokens (access + refresh)
 * 5. Client stores tokens for authenticated requests
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifySignatureWithTimestamp } from '../../../../lib/authUtils'
import { getLockedRole, resolveLockedRole, Role } from '../../../../lib/roleService'
import { issueAccessToken, issueRefreshToken } from '../../../../lib/jwtUtils'
import { getDb } from '../../../../lib/postgresManager'

function normalizeDesiredRole(input: any): Role | null {
  if (typeof input !== 'string') return null
  const role = input.toUpperCase()
  return role === 'TRADER' || role === 'CREATOR' ? role : null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { wallet, signature, message, nonce } = body
    const desiredRole = normalizeDesiredRole(body?.desiredRole)

    // Validate input
    if (!wallet || !signature || !message) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: wallet, signature, message' },
        { status: 400 }
      )
    }

    // Verify signature
    const verification = verifySignatureWithTimestamp(message, signature, wallet)
    if (!verification.isValid) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid signature' },
        { status: 401 }
      )
    }

    // Resolve wallet-locked role (created once per wallet, then immutable).
    const existingLockedRole = await getLockedRole(wallet)
    if (!existingLockedRole && !desiredRole) {
      return NextResponse.json(
        {
          success: false,
          error: 'Role selection required for first-time wallet registration',
          errorCode: 'ROLE_SELECTION_REQUIRED',
          roleSelectionRequired: true,
          availableRoles: ['TRADER', 'CREATOR'],
        },
        { status: 409 }
      )
    }

    const role = existingLockedRole
      ? existingLockedRole
      : await resolveLockedRole(wallet, desiredRole as Role)

    // Issue JWT tokens
    const accessToken = await issueAccessToken(wallet, role)
    const refreshToken = await issueRefreshToken(wallet, role)

    // Store session in database (optional, for tracking/logout)
    try {
      const db = await getDb()
      if (db.type === 'pg') {
        await db.pool.query(
          `INSERT INTO user_sessions (wallet, role, refresh_token, expires_at, created_at)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (wallet) 
           DO UPDATE SET 
             role = $2,
             refresh_token = $3,
             expires_at = $4,
             updated_at = $5`,
          [
            wallet.toLowerCase(),
            role,
            refreshToken,
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
            new Date().toISOString(),
          ]
        )
      }
    } catch (dbError: any) {
      // Log but don't fail - session storage is optional
      console.warn('Failed to store session in database:', dbError.message)
    }

    return NextResponse.json({
      success: true,
      accessToken,
      refreshToken,
      role,
      wallet: wallet.toLowerCase(),
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Authentication failed' },
      { status: 500 }
    )
  }
}










