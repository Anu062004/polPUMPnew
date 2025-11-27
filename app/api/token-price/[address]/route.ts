import { NextRequest, NextResponse } from 'next/server'

// Mock token price history API
// Returns simple synthetic data for now

export async function GET(
  _req: NextRequest,
  { params }: { params: { address: string } }
) {
  const { address } = params

  // Generate deterministic mock prices based on address hash
  const baseSeed = Array.from(address || '')
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0) || 100

  const now = Date.now()
  const points = []

  for (let i = 30; i >= 0; i--) {
    const t = new Date(now - i * 60 * 1000) // every minute
    const volatility = 0.05
    const noise =
      Math.sin((baseSeed + i) / 5) * volatility +
      (Math.cos((baseSeed - i) / 7) * volatility) / 2
    const price = Math.max(0.0001, 0.1 + noise)

    points.push({
      time: t.toISOString(),
      price: Number(price.toFixed(4))
    })
  }

  return NextResponse.json(points)
}






