/**
 * GET /api/auth/verify
 * Verify JWT token and return current user info
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '../../../../lib/roleMiddleware'
import { revalidateRole } from '../../../../lib/roleService'
import { issueAccessToken } from '../../../../lib/jwtUtils'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    
    if ('error' in authResult) {
      return authResult.error
    }

    const { user } = authResult

    // Optionally revalidate role (can be disabled for performance)
    const revalidate = request.nextUrl.searchParams.get('revalidate') === 'true'
    let role = user.role

    if (revalidate) {
      const roleCheck = await revalidateRole(user.wallet, user.role)
      role = roleCheck.role

      // If role changed, issue new token
      if (roleCheck.changed) {
        const newAccessToken = await issueAccessToken(user.wallet, role)
        return NextResponse.json({
          success: true,
          user: {
            wallet: user.wallet,
            role,
          },
          accessToken: newAccessToken,
          roleChanged: true,
        })
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        wallet: user.wallet,
        role,
      },
    })
  } catch (error: any) {
    console.error('Verify error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Verification failed' },
      { status: 500 }
    )
  }
}









