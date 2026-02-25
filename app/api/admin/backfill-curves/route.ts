import { NextRequest, NextResponse } from 'next/server'
import { resolveCoinAddresses, updateCoinAddresses } from '../../../../lib/curveResolver'
import { getSql, initializeSchema } from '../../../../lib/postgresManager'

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const providedSecret = url.searchParams.get('secret') || ''
    const adminSecret = process.env.ADMIN_SECRET

    if (adminSecret && providedSecret !== adminSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    await initializeSchema()
    const sql = await getSql()
    if (!sql) {
      return NextResponse.json(
        { success: false, error: 'Postgres is required for curve backfill' },
        { status: 500 }
      )
    }

    const coinsResult = await sql`
      SELECT id, symbol, tx_hash, token_address, curve_address
      FROM coins
      WHERE token_address IS NULL
         OR token_address = ''
         OR curve_address IS NULL
         OR curve_address = ''
    `
    const coins = Array.isArray(coinsResult) ? coinsResult : (coinsResult as any).rows || []

    if (!coins.length) {
      return NextResponse.json({ success: true, checked: 0, updated: 0 })
    }

    const updates: Array<{ id: string; tokenAddress: string; curveAddress: string }> = []

    for (const coin of coins) {
      const resolved = await resolveCoinAddresses({
        id: coin.id,
        symbol: coin.symbol,
        txHash: coin.tx_hash,
      })

      if (resolved?.tokenAddress && resolved?.curveAddress) {
        await updateCoinAddresses(coin.id, resolved.tokenAddress, resolved.curveAddress)
        updates.push({
          id: coin.id,
          tokenAddress: resolved.tokenAddress,
          curveAddress: resolved.curveAddress,
        })
      }
    }

    return NextResponse.json({
      success: true,
      checked: coins.length,
      updated: updates.length,
      updates,
    })
  } catch (error: any) {
    console.error('Backfill failed:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to backfill curves' },
      { status: 500 }
    )
  }
}
