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
import { verifySignatureWithTimestamp, verifyWalletSignature } from '../../../../lib/authUtils'
import { getLockedRole, resolveLockedRole, Role } from '../../../../lib/roleService'
import { issueAccessToken, issueRefreshToken, verifyToken } from '../../../../lib/jwtUtils'
import { getDb } from '../../../../lib/postgresManager'
import { consumeAuthChallenge } from '../../../../lib/authChallengeService'
import crypto from 'crypto'
import { ethers } from 'ethers'

function normalizeDesiredRole(input: any): Role | null {
  if (typeof input !== 'string') return null
  const role = input.toUpperCase()
  return role === 'TRADER' || role === 'CREATOR' ? role : null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const wallet = String(body?.wallet || '').trim()
    const signature = String(body?.signature || '').trim()
    const challengeId = String(body?.challengeId || '').trim()
    const fallbackMessage = String(body?.message || '').trim()
    const desiredRole = normalizeDesiredRole(body?.desiredRole)

    // Validate input
    if (!wallet || !signature || !challengeId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: wallet, signature, challengeId' },
        { status: 400 }
      )
    }

    if (!ethers.isAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: 'Invalid wallet address' },
        { status: 400 }
      )
    }

    let messageToVerify: string | null = null
    let usedStatelessFallback = false
    try {
      const challenge = await consumeAuthChallenge({
        wallet,
        challengeId,
        purpose: 'authenticate',
      })
      messageToVerify = challenge.message
    } catch {
      // Stateless fallback for local/dev modes when challenge persistence is unavailable.
      if (fallbackMessage) {
        messageToVerify = fallbackMessage
        usedStatelessFallback = true
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired challenge' },
          { status: 401 }
        )
      }
    }

    // Verify signature (timestamp + nonce check when fallback path is used).
    const verification = usedStatelessFallback
      ? verifySignatureWithTimestamp(messageToVerify, signature, wallet)
      : verifyWalletSignature(messageToVerify, signature, wallet)
    if (!verification.isValid) {
      return NextResponse.json(
        { success: false, error: verification.error || 'Invalid signature' },
        { status: 401 }
      )
    }

    // Resolve wallet-locked role (created once per wallet, then immutable).
    // Never let transient DB/RPC issues block login; fallback to requested role.
    let existingLockedRole: Role | null = null
    try {
      existingLockedRole = await getLockedRole(wallet)
    } catch (roleReadError: any) {
      console.warn(
        'Failed to read locked role, continuing with fallback:',
        roleReadError?.message || roleReadError
      )
    }

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

    let role: Role
    if (existingLockedRole) {
      role = existingLockedRole
    } else {
      try {
        role = await resolveLockedRole(wallet, desiredRole as Role)
      } catch (roleResolveError: any) {
        console.warn(
          'Failed to resolve/persist locked role, using requested role fallback:',
          roleResolveError?.message || roleResolveError
        )
        role = desiredRole as Role
      }
    }

    // Issue JWT tokens
    const accessToken = await issueAccessToken(wallet, role)
    const refreshToken = await issueRefreshToken(wallet, role)
    const refreshPayload = await verifyToken(refreshToken, 'refresh')
    if (!refreshPayload?.jti) {
      throw new Error('Failed to issue refresh token')
    }
    const refreshTokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex')

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
            refreshTokenHash,
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










