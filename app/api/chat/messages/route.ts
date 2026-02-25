/**
 * Chat API Routes
 * Handles role-based chat messages.
 *
 * Room types:
 * - global (open to authenticated users)
 * - creator:<creatorWallet> (creator + follower-only room)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '../../../../lib/roleMiddleware'
import { getDb } from '../../../../lib/postgresManager'
import { ethers } from 'ethers'

type DbConnection = Awaited<ReturnType<typeof getDb>>

let chatSchemaReady = false
let chatSchemaInitPromise: Promise<void> | null = null

function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase()
}

function clampLimit(limitRaw: string | null, fallback = 50, max = 200): number {
  const parsed = parseInt(limitRaw || `${fallback}`, 10)
  if (Number.isNaN(parsed) || parsed <= 0) return fallback
  return Math.min(parsed, max)
}

function normalizeRoomId(input?: string | null): string {
  const roomId = (input || 'global').trim()
  if (!roomId) return 'global'
  return roomId.slice(0, 120)
}

function parseCreatorRoom(roomId: string): string | null {
  if (!roomId.startsWith('creator:')) return null
  const wallet = roomId.slice('creator:'.length).trim()
  if (!wallet || !ethers.isAddress(wallet)) return null
  return normalizeWallet(wallet)
}

async function ensureChatSchema(db: DbConnection): Promise<void> {
  if (db.type !== 'pg' || !db.pool) return
  if (chatSchemaReady) return

  if (chatSchemaInitPromise) {
    await chatSchemaInitPromise
    return
  }

  chatSchemaInitPromise = (async () => {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGSERIAL PRIMARY KEY,
        sender_wallet VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('TRADER','CREATOR')),
        room_id VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        token_symbol VARCHAR(100),
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `)

    await db.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
      ON chat_messages(room_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
      ON chat_messages(sender_wallet);
    `)

    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS creator_followers (
        creator_wallet VARCHAR(255) NOT NULL,
        follower_wallet VARCHAR(255) NOT NULL,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        PRIMARY KEY (creator_wallet, follower_wallet)
      )
    `)

    await db.pool.query(`
      UPDATE creator_followers
      SET
        creator_wallet = LOWER(creator_wallet),
        follower_wallet = LOWER(follower_wallet)
      WHERE
        creator_wallet <> LOWER(creator_wallet) OR
        follower_wallet <> LOWER(follower_wallet)
    `)

    await db.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_followers_single_creator_per_wallet
      ON creator_followers(follower_wallet)
    `)

    chatSchemaReady = true
  })()

  try {
    await chatSchemaInitPromise
  } finally {
    chatSchemaInitPromise = null
  }
}

async function authorizeCreatorRoom(
  db: DbConnection,
  roomId: string,
  requesterWallet: string,
  requesterRole: 'TRADER' | 'CREATOR'
): Promise<{ ok: true; creatorWallet: string } | { ok: false; response: NextResponse }> {
  const creatorWallet = parseCreatorRoom(roomId)
  if (!creatorWallet) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Invalid creator chat room id format' },
        { status: 400 }
      ),
    }
  }

  const requester = normalizeWallet(requesterWallet)

  // Creator can always access their own room.
  if (requesterRole === 'CREATOR' && requester === creatorWallet) {
    return { ok: true, creatorWallet }
  }

  if (db.type !== 'pg' || !db.pool) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Creator chat requires PostgreSQL' },
        { status: 503 }
      ),
    }
  }

  const followCheck = await db.pool.query(
    `SELECT 1
     FROM creator_followers
     WHERE creator_wallet = $1 AND follower_wallet = $2
     LIMIT 1`,
    [creatorWallet, requester]
  )

  if (followCheck.rowCount && followCheck.rowCount > 0) {
    return { ok: true, creatorWallet }
  }

  return {
    ok: false,
    response: NextResponse.json(
      {
        success: false,
        error: 'Follow this creator to access their community chat',
      },
      { status: 403 }
    ),
  }
}

async function authorizeRoom(
  db: DbConnection,
  roomId: string,
  requesterWallet: string,
  requesterRole: 'TRADER' | 'CREATOR'
): Promise<{ ok: true; normalizedRoomId: string } | { ok: false; response: NextResponse }> {
  if (!roomId.startsWith('creator:')) {
    return { ok: true, normalizedRoomId: roomId }
  }

  const authResult = await authorizeCreatorRoom(db, roomId, requesterWallet, requesterRole)
  if (!authResult.ok) {
    return authResult
  }

  return {
    ok: true,
    normalizedRoomId: `creator:${authResult.creatorWallet}`,
  }
}

// GET /api/chat/messages - Get chat messages
export const GET = withAuth(async (request: NextRequest, user) => {
  try {
    const { searchParams } = request.nextUrl
    const roomId = normalizeRoomId(searchParams.get('roomId'))
    const limit = clampLimit(searchParams.get('limit'))
    const before = searchParams.get('before')
    const beforeTs = before ? Number(before) : null

    const db = await getDb()
    await ensureChatSchema(db)

    const roomAuth = await authorizeRoom(
      db,
      roomId,
      normalizeWallet(user.wallet),
      user.role
    )
    if (!roomAuth.ok) {
      return roomAuth.response
    }

    let messages: any[] = []

    if (db.type === 'pg' && db.pool) {
      let result
      if (beforeTs && Number.isFinite(beforeTs) && beforeTs > 0) {
        result = await db.pool.query(
          `SELECT * FROM chat_messages 
           WHERE room_id = $1 AND created_at < $2
           ORDER BY created_at DESC 
           LIMIT $3`,
          [roomAuth.normalizedRoomId, Math.floor(beforeTs), limit]
        )
      } else {
        result = await db.pool.query(
          `SELECT * FROM chat_messages 
           WHERE room_id = $1 
           ORDER BY created_at DESC 
           LIMIT $2`,
          [roomAuth.normalizedRoomId, limit]
        )
      }
      messages = result.rows.reverse() // Reverse to show oldest first
    } else {
      return NextResponse.json(
        { success: false, error: 'Chat requires PostgreSQL' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      roomId: roomAuth.normalizedRoomId,
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
    const roomId = normalizeRoomId(body?.roomId)
    const message = typeof body?.message === 'string' ? body.message : ''
    const tokenSymbol = typeof body?.tokenSymbol === 'string' ? body.tokenSymbol : null

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    const trimmedMessage = message.trim()
    if (trimmedMessage.length > 800) {
      return NextResponse.json(
        { success: false, error: 'Message is too long (max 800 chars)' },
        { status: 400 }
      )
    }

    const db = await getDb()
    await ensureChatSchema(db)

    const roomAuth = await authorizeRoom(
      db,
      roomId,
      normalizeWallet(user.wallet),
      user.role
    )
    if (!roomAuth.ok) {
      return roomAuth.response
    }

    let insertedMessage: any

    if (db.type === 'pg' && db.pool) {
      const result = await db.pool.query(
        `INSERT INTO chat_messages (sender_wallet, role, room_id, message, token_symbol, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          normalizeWallet(user.wallet),
          user.role,
          roomAuth.normalizedRoomId,
          trimmedMessage,
          tokenSymbol || null,
          Date.now(),
        ]
      )
      insertedMessage = result.rows[0]
    } else {
      return NextResponse.json(
        { success: false, error: 'Chat requires PostgreSQL' },
        { status: 503 }
      )
    }

    return NextResponse.json({
      success: true,
      roomId: roomAuth.normalizedRoomId,
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










