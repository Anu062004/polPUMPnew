/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, extractTokenFromHeader, issueAccessToken } from '../../../../lib/jwtUtils'
import { revalidateRole } from '../../../../lib/roleService'

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
    const payload = await verifyToken(refreshToken)
    if (!payload || !payload.wallet || !payload.role) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired refresh token' },
        { status: 401 }
      )
    }

    // Revalidate role (important: role may have changed)
    const roleCheck = await revalidateRole(payload.wallet, payload.role)
    const newRole = roleCheck.role

    // Issue new access token with updated role
    const newAccessToken = await issueAccessToken(payload.wallet, newRole)

    return NextResponse.json({
      success: true,
      accessToken: newAccessToken,
      role: newRole,
      roleChanged: roleCheck.changed,
    })
  } catch (error: any) {
    console.error('Refresh error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Token refresh failed' },
      { status: 500 }
    )
  }
}






