/**
 * Chat API Routes
 * Handles role-based chat messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/roleMiddleware'
import { getDb } from '../../../../lib/postgresManager'

// GET /api/chat/messages - Get chat messages
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = request.nextUrl
    const roomId = searchParams.get('roomId') || 'global'
    const limit = parseInt(searchParams.get('limit') || '50')

    const db = await getDb()
    let messages: any[] = []

    if (db.type === 'pg') {
      const result = await db.pool.query(
        `SELECT * FROM chat_messages 
         WHERE room_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2`,
        [roomId, limit]
      )
      messages = result.rows.reverse() // Reverse to show oldest first
    } else if (db.type === 'vercel') {
      const { sql } = db
      const result = await sql`
        SELECT * FROM chat_messages 
        WHERE room_id = ${roomId}
        ORDER BY created_at DESC 
        LIMIT ${limit}
      `
      messages = result.reverse()
    }

    return NextResponse.json({
      success: true,
      messages,
    })
  } catch (error: any) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    )
  }
})

// POST /api/chat/messages - Send a chat message
export const POST = withAuth(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { roomId = 'global', message, tokenSymbol } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    const db = await getDb()
    let insertedMessage: any

    if (db.type === 'pg') {
      const result = await db.pool.query(
        `INSERT INTO chat_messages (sender_wallet, role, room_id, message, token_symbol, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          user.wallet,
          user.role,
          roomId,
          message.trim(),
          tokenSymbol || null,
          Date.now(),
        ]
      )
      insertedMessage = result.rows[0]
    } else if (db.type === 'vercel') {
      const { sql } = db
      const result = await sql`
        INSERT INTO chat_messages (sender_wallet, role, room_id, message, token_symbol, created_at)
        VALUES (${user.wallet}, ${user.role}, ${roomId}, ${message.trim()}, ${tokenSymbol || null}, ${Date.now()})
        RETURNING *
      `
      insertedMessage = result[0]
    }

    return NextResponse.json({
      success: true,
      message: insertedMessage,
    })
  } catch (error: any) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send message' },
      { status: 500 }
    )
  }
})






