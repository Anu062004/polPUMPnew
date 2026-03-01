/**
 * Role-based middleware for API route protection
 * Verifies JWT and enforces role-based access control
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, extractTokenFromHeader } from './jwtUtils'
import { Role } from './roleService'

export interface AuthenticatedRequest extends NextRequest {
  user?: {
    wallet: string
    role: Role
  }
}

/**
 * Middleware to verify JWT and attach user to request
 */
export async function authenticateRequest(
  request: NextRequest
): Promise<{ user: { wallet: string; role: Role } } | { error: NextResponse }> {
  const authHeader = request.headers.get('authorization')
  const token = extractTokenFromHeader(authHeader)

  if (!token) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  const payload = await verifyToken(token, 'access')
  if (!payload || !payload.wallet || !payload.role) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      ),
    }
  }

  return {
    user: {
      wallet: payload.wallet,
      role: payload.role as Role,
    },
  }
}

/**
 * Middleware to require CREATOR role
 */
export async function requireCreator(
  request: NextRequest
): Promise<{ user: { wallet: string; role: Role } } | { error: NextResponse }> {
  const authResult = await authenticateRequest(request)

  if ('error' in authResult) {
    return authResult
  }

  if (authResult.user.role !== 'CREATOR') {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: 'CREATOR role required',
          requiredRole: 'CREATOR',
          currentRole: authResult.user.role,
        },
        { status: 403 }
      ),
    }
  }

  return authResult
}

/**
 * Helper to create authenticated route handler
 */
export function withAuth<T = any>(
  handler: (req: NextRequest, user: { wallet: string; role: Role }) => Promise<NextResponse<any>>
) {
  return async (req: NextRequest) => {
    const authResult = await authenticateRequest(req)
    if ('error' in authResult) {
      return authResult.error
    }
    return handler(req, authResult.user)
  }
}

/**
 * Helper to create CREATOR-only route handler
 */
export function withCreatorAuth<T = any>(
  handler: (req: NextRequest, user: { wallet: string; role: Role }) => Promise<NextResponse<any>>
) {
  return async (req: NextRequest) => {
    const authResult = await requireCreator(req)
    if ('error' in authResult) {
      return authResult.error
    }
    return handler(req, authResult.user)
  }
}










