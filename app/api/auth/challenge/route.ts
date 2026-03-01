import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { createAuthChallenge } from '../../../../lib/authChallengeService'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const challengeBuckets = new Map<string, { count: number; reset: number }>()

function parseChainId(raw: unknown): number | null {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed <= 0) return null
  return parsed
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.ip || 'unknown'
}

function enforceRateLimit(request: NextRequest, wallet: string): NextResponse | null {
  const key = `${wallet.toLowerCase()}:${getClientIp(request)}`
  const now = Date.now()
  const bucket = challengeBuckets.get(key) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS }
  if (bucket.reset < now) {
    bucket.count = 0
    bucket.reset = now + RATE_LIMIT_WINDOW_MS
  }
  bucket.count += 1
  challengeBuckets.set(key, bucket)
  if (challengeBuckets.size > 5000) {
    for (const [entryKey, entry] of challengeBuckets.entries()) {
      if (entry.reset < now) {
        challengeBuckets.delete(entryKey)
      }
    }
  }
  if (bucket.count > RATE_LIMIT_MAX) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const wallet = String(body?.wallet || '').trim()
    const chainId = parseChainId(body?.chainId)
    const domain = typeof body?.domain === 'string' ? body.domain.trim().slice(0, 120) : null

    if (!wallet || !ethers.isAddress(wallet)) {
      return NextResponse.json(
        { success: false, error: 'Valid wallet address is required' },
        { status: 400 }
      )
    }

    const rateLimited = enforceRateLimit(request, wallet)
    if (rateLimited) return rateLimited

    const challenge = await createAuthChallenge({
      wallet,
      purpose: 'authenticate',
      chainId,
      domain: domain || null,
    })

    return NextResponse.json({
      success: true,
      challengeId: challenge.challengeId,
      wallet: challenge.wallet,
      message: challenge.message,
      expiresAt: challenge.expiresAt,
    })
  } catch (error: any) {
    console.error('Challenge creation error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create challenge' },
      { status: 500 }
    )
  }
}
