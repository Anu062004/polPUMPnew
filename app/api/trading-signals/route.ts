/**
 * Trading Signals API
 * CREATOR-only endpoint for posting buy/sell signals
 * TRADER endpoint for viewing signals
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, withCreatorAuth } from '../../../../lib/roleMiddleware'
import { getDb } from '../../../../lib/postgresManager'
import { ethers } from 'ethers'

// GET /api/trading-signals - Get trading signals (all users)
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = request.nextUrl
    const creatorWallet = searchParams.get('creator')
    const tokenAddress = searchParams.get('token')
    const limit = parseInt(searchParams.get('limit') || '50')

    const db = await getDb()
    let signals: any[] = []

    if (db.type === 'pg') {
      let query = 'SELECT * FROM trading_signals WHERE 1=1'
      const params: any[] = []
      let paramCount = 1

      if (creatorWallet) {
        query += ` AND creator_wallet = $${paramCount}`
        params.push(creatorWallet.toLowerCase())
        paramCount++
      }

      if (tokenAddress) {
        query += ` AND token_address = $${paramCount}`
        params.push(tokenAddress.toLowerCase())
        paramCount++
      }

      query += ` ORDER BY created_at DESC LIMIT $${paramCount}`
      params.push(limit)

      const result = await db.pool.query(query, params)
      signals = result.rows
    } else if (db.type === 'vercel') {
      const { sql } = db
      if (creatorWallet && tokenAddress) {
        signals = await sql`
          SELECT * FROM trading_signals 
          WHERE creator_wallet = ${creatorWallet.toLowerCase()} 
            AND token_address = ${tokenAddress.toLowerCase()}
          ORDER BY created_at DESC 
          LIMIT ${limit}
        `
      } else if (creatorWallet) {
        signals = await sql`
          SELECT * FROM trading_signals 
          WHERE creator_wallet = ${creatorWallet.toLowerCase()}
          ORDER BY created_at DESC 
          LIMIT ${limit}
        `
      } else if (tokenAddress) {
        signals = await sql`
          SELECT * FROM trading_signals 
          WHERE token_address = ${tokenAddress.toLowerCase()}
          ORDER BY created_at DESC 
          LIMIT ${limit}
        `
      } else {
        signals = await sql`
          SELECT * FROM trading_signals 
          ORDER BY created_at DESC 
          LIMIT ${limit}
        `
      }
    }

    return NextResponse.json({
      success: true,
      signals,
    })
  } catch (error: any) {
    console.error('Error fetching signals:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch signals' },
      { status: 500 }
    )
  }
})

// POST /api/trading-signals - Post a trading signal (CREATOR only)
export const POST = withCreatorAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { tokenAddress, signalType, priceTarget, message } = body

    // Validate input
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    if (!signalType || !['BUY', 'SELL'].includes(signalType.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'Signal type must be BUY or SELL' },
        { status: 400 }
      )
    }

    const db = await getDb()
    let insertedSignal: any

    if (db.type === 'pg') {
      const result = await db.pool.query(
        `INSERT INTO trading_signals (creator_wallet, token_address, signal_type, price_target, message, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          user.wallet,
          tokenAddress.toLowerCase(),
          signalType.toUpperCase(),
          priceTarget || null,
          message || null,
          Date.now(),
        ]
      )
      insertedSignal = result.rows[0]
    } else if (db.type === 'vercel') {
      const { sql } = db
      const result = await sql`
        INSERT INTO trading_signals (creator_wallet, token_address, signal_type, price_target, message, created_at)
        VALUES (${user.wallet}, ${tokenAddress.toLowerCase()}, ${signalType.toUpperCase()}, ${priceTarget || null}, ${message || null}, ${Date.now()})
        RETURNING *
      `
      insertedSignal = result[0]
    }

    return NextResponse.json({
      success: true,
      signal: insertedSignal,
    })
  } catch (error: any) {
    console.error('Error posting signal:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to post signal' },
      { status: 500 }
    )
  }
})






