/**
 * POST /api/auth/logout
 * Logout user by invalidating refresh token
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '../../../../lib/roleMiddleware'
import { getDb } from '../../../../lib/postgresManager'

export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request)
    
    if ('error' in authResult) {
      return authResult.error
    }

    const { user } = authResult

    // Remove session from database
    try {
      const db = await getDb()
      if (db.type === 'pg') {
        await db.pool.query('DELETE FROM user_sessions WHERE wallet = $1', [user.wallet])
      }
    } catch (dbError: any) {
      console.warn('Failed to remove session from database:', dbError.message)
      // Don't fail - logout should succeed even if DB cleanup fails
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })
  } catch (error: any) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Logout failed' },
      { status: 500 }
    )
  }
}










