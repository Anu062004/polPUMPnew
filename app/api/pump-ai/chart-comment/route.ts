import { NextRequest, NextResponse } from 'next/server'

interface PricePoint {
  time: string
  price: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tokenAddress, data } = body as {
      tokenAddress?: string
      data?: PricePoint[]
    }

    if (!data || !Array.isArray(data) || data.length < 2) {
      return NextResponse.json({
        comment: 'Not enough data to analyze price action yet.'
      })
    }

    const first = data[0].price
    const last = data[data.length - 1].price
    if (!first || !last) {
      return NextResponse.json({
        comment: 'Price data is incomplete. Try again in a few moments.'
      })
    }

    const change = ((last - first) / first) * 100

    let comment: string
    if (change >= 20) {
      comment = `🚀 This token is PUMPING (+${change.toFixed(
        1
      )}%). Momentum is strong, but be careful of late entries.`
    } else if (change <= -20) {
      comment = `📉 This token is DUMPING (${change.toFixed(
        1
      )}%). Volatility is high — only degen with size you can afford to lose.`
    } else {
      comment = `🔁 Price is CHOPPY (${change.toFixed(
        1
      )}%). Range-bound action — good for scalpers, meh for trend traders.`
    }

    if (tokenAddress) {
      comment += ' (Mock analysis based on synthetic data.)'
    }

    return NextResponse.json({ comment })
  } catch (error: any) {
    console.error('chart-comment error:', error)
    return NextResponse.json(
      { comment: 'Unable to analyze chart data right now.' },
      { status: 500 }
    )
  }
}






