/**
 * JWT utilities for session management
 * Issues short-lived JWTs for authenticated wallet sessions
 */

import { SignJWT, jwtVerify } from 'jose'

// Use environment variable for JWT secret, fallback to a default (should be set in production)
const JWT_SECRET = process.env.JWT_SECRET || 'polpump-default-secret-change-in-production'
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET)

// JWT expiration times
export const JWT_EXPIRATION = {
  ACCESS_TOKEN: '15m', // 15 minutes
  REFRESH_TOKEN: '7d', // 7 days
}

export interface JWTPayload {
  wallet: string
  role: 'TRADER' | 'CREATOR'
  iat?: number
  exp?: number
}

/**
 * Issue a JWT access token for authenticated wallet
 */
export async function issueAccessToken(
  wallet: string,
  role: 'TRADER' | 'CREATOR'
): Promise<string> {
  const payload: JWTPayload = {
    wallet: wallet.toLowerCase(),
    role,
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION.ACCESS_TOKEN)
    .sign(JWT_SECRET_KEY)

  return token
}

/**
 * Issue a refresh token (longer-lived)
 */
export async function issueRefreshToken(
  wallet: string,
  role: 'TRADER' | 'CREATOR'
): Promise<string> {
  const payload: JWTPayload = {
    wallet: wallet.toLowerCase(),
    role,
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION.REFRESH_TOKEN)
    .sign(JWT_SECRET_KEY)

  return token
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY)
    return payload as JWTPayload
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null
  if (!authHeader.startsWith('Bearer ')) return null
  return authHeader.substring(7)
}










