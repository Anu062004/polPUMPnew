/**
 * JWT utilities for session management
 * Issues short-lived JWTs for authenticated wallet sessions
 */

import { SignJWT, jwtVerify } from 'jose'
import { randomUUID } from 'crypto'

const JWT_SECRET = process.env.JWT_SECRET || ''
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to a strong secret (min 32 chars)')
}
const JWT_SECRET_KEY = new TextEncoder().encode(JWT_SECRET)
const JWT_ISSUER = process.env.JWT_ISSUER || 'polpump-api'
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'polpump-clients'

// JWT expiration times
export const JWT_EXPIRATION = {
  ACCESS_TOKEN: '15m', // 15 minutes
  REFRESH_TOKEN: '7d', // 7 days
}

export type JWTTokenType = 'access' | 'refresh'

export interface JWTPayload {
  [key: string]: unknown
  wallet: string
  role: 'TRADER' | 'CREATOR'
  tokenType: JWTTokenType
  jti: string
  iat?: number
  exp?: number
  iss?: string
  aud?: string | string[]
}

/**
 * Issue a JWT access token for authenticated wallet
 */
export async function issueAccessToken(
  wallet: string,
  role: 'TRADER' | 'CREATOR'
): Promise<string> {
  const jti = randomUUID()
  const payload: JWTPayload = {
    wallet: wallet.toLowerCase(),
    role,
    tokenType: 'access',
    jti,
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setJti(jti)
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
  const jti = randomUUID()
  const payload: JWTPayload = {
    wallet: wallet.toLowerCase(),
    role,
    tokenType: 'refresh',
    jti,
  }

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION.REFRESH_TOKEN)
    .sign(JWT_SECRET_KEY)

  return token
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string,
  expectedTokenType?: JWTTokenType
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET_KEY, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    })

    const typedPayload = payload as unknown as Partial<JWTPayload>
    if (
      typeof typedPayload.wallet !== 'string' ||
      (typedPayload.role !== 'TRADER' && typedPayload.role !== 'CREATOR') ||
      (typedPayload.tokenType !== 'access' && typedPayload.tokenType !== 'refresh')
    ) {
      return null
    }
    if (expectedTokenType && typedPayload.tokenType !== expectedTokenType) {
      return null
    }

    return typedPayload as JWTPayload
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










