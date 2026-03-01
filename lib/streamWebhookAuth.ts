import { NextRequest, NextResponse } from 'next/server'

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() || request.ip || 'unknown'
}

function parseAllowlist(raw: string): string[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => !!entry)
}

export function requireStreamWebhookAuth(request: NextRequest): NextResponse | null {
  const expectedSecret =
    process.env.STREAM_WEBHOOK_SECRET ||
    process.env.IVS_WEBHOOK_SECRET ||
    ''

  if (process.env.NODE_ENV === 'production' && !expectedSecret) {
    return NextResponse.json(
      { success: false, error: 'Stream webhook secret is not configured' },
      { status: 500 }
    )
  }

  if (expectedSecret) {
    const provided = request.headers.get('x-stream-webhook-secret') || ''
    if (provided !== expectedSecret) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized stream webhook request' },
        { status: 401 }
      )
    }
  }

  const allowlistRaw = process.env.STREAM_WEBHOOK_IP_ALLOWLIST || ''
  if (allowlistRaw) {
    const allowlist = parseAllowlist(allowlistRaw)
    const requestIp = getClientIp(request)
    if (!allowlist.includes(requestIp)) {
      return NextResponse.json(
        { success: false, error: 'Webhook IP not allowed' },
        { status: 403 }
      )
    }
  }

  return null
}
