import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { resolveCoinAddresses, updateCoinAddresses } from '../../../../lib/curveResolver'

const DB_PATH = path.join(process.cwd(), 'data', 'coins.db')

async function openDb() {
  return await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  })
}

export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const providedSecret = url.searchParams.get('secret') || ''
    const adminSecret = process.env.ADMIN_SECRET

    if (adminSecret && providedSecret !== adminSecret) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const db = await openDb()
    const coins = await db.all(
      `SELECT id, symbol, txHash, tokenAddress, curveAddress 
       FROM coins 
       WHERE tokenAddress IS NULL 
          OR tokenAddress = '' 
          OR curveAddress IS NULL 
          OR curveAddress = ''`
    )

    if (!coins.length) {
      await db.close()
      return NextResponse.json({ success: true, checked: 0, updated: 0 })
    }

    const updates: Array<{ id: string; tokenAddress: string; curveAddress: string }> = []

    for (const coin of coins) {
      const resolved = await resolveCoinAddresses({
        id: coin.id,
        symbol: coin.symbol,
        txHash: coin.txHash,
      })

      if (resolved?.tokenAddress && resolved?.curveAddress) {
        await updateCoinAddresses(coin.id, resolved.tokenAddress, resolved.curveAddress, db)
        updates.push({
          id: coin.id,
          tokenAddress: resolved.tokenAddress,
          curveAddress: resolved.curveAddress,
        })
      }
    }

    await db.close()

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


