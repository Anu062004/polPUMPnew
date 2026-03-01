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
import { SUPER_CHAT_ABI } from '../../../../lib/abis'

type DbConnection = Awaited<ReturnType<typeof getDb>>

let chatSchemaReady = false
let chatSchemaInitPromise: Promise<void> | null = null
type ChatMessageType = 'TEXT' | 'STICKER' | 'SUPER_CHAT'
type InMemoryChatRow = {
  id: number
  sender_wallet: string
  role: 'TRADER' | 'CREATOR'
  room_id: string
  message: string
  message_type: ChatMessageType
  sticker_id: string | null
  sticker_pack: string | null
  superchat_amount: string | null
  superchat_token: string | null
  superchat_tx_hash: string | null
  token_symbol: string | null
  created_at: number
}

const inMemoryChatRooms = new Map<string, InMemoryChatRow[]>()
let inMemoryChatMessageId = 1
const IN_MEMORY_CHAT_LIMIT = 500

const SUPER_CHAT_ADDRESS = normalizeWallet(
  process.env.NEXT_PUBLIC_SUPERCHAT_ADDRESS ||
    process.env.SUPERCHAT_ADDRESS ||
    ''
)
const SUPER_CHAT_MIN_CONFIRMATIONS = Math.max(
  1,
  Number(process.env.SUPERCHAT_MIN_CONFIRMATIONS || 1)
)
const DEFAULT_RPC_URL =
  process.env.NEXT_PUBLIC_EVM_RPC ||
  process.env.POLYGON_RPC_URL ||
  process.env.RPC_URL ||
  ''
const superChatEventInterface = new ethers.Interface(SUPER_CHAT_ABI)

function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase()
}

function normalizeMessageType(input: unknown): ChatMessageType {
  if (typeof input !== 'string') return 'TEXT'
  const normalized = input.trim().toUpperCase()
  if (normalized === 'STICKER' || normalized === 'SUPER_CHAT') {
    return normalized
  }
  return 'TEXT'
}

function normalizeOptionalText(input: unknown, maxLen: number): string | null {
  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null
  return trimmed.slice(0, maxLen)
}

function isPositiveDecimal(input: string): boolean {
  if (!/^\d+(\.\d+)?$/.test(input)) return false
  return Number(input) > 0
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

function getReadProvider(): ethers.JsonRpcProvider {
  if (!DEFAULT_RPC_URL) {
    throw new Error('RPC URL is not configured for super chat verification')
  }
  return new ethers.JsonRpcProvider(DEFAULT_RPC_URL)
}

async function getDbOrNull(): Promise<DbConnection | null> {
  try {
    return await getDb()
  } catch (error: any) {
    console.warn(
      'Chat API: PostgreSQL unavailable, using in-memory fallback:',
      error?.message || error
    )
    return null
  }
}

function getInMemoryMessages(roomId: string, limit: number, beforeTs?: number | null): InMemoryChatRow[] {
  const rows = inMemoryChatRooms.get(roomId) || []
  const filtered = Number.isFinite(beforeTs as number) && (beforeTs as number) > 0
    ? rows.filter((row) => row.created_at < Math.floor(beforeTs as number))
    : rows
  return filtered.slice(-limit)
}

function appendInMemoryMessage(row: Omit<InMemoryChatRow, 'id'>): InMemoryChatRow {
  const next: InMemoryChatRow = {
    id: inMemoryChatMessageId++,
    ...row,
  }

  const existing = inMemoryChatRooms.get(row.room_id) || []
  const updated = [...existing, next].slice(-IN_MEMORY_CHAT_LIMIT)
  inMemoryChatRooms.set(row.room_id, updated)
  return next
}

async function verifyNativeSuperChatOnChain(input: {
  txHash: string
  expectedSender: string
  expectedCreator: string
  expectedAmountWei: bigint
}): Promise<void> {
  if (!SUPER_CHAT_ADDRESS || !ethers.isAddress(SUPER_CHAT_ADDRESS)) {
    throw new Error('Super Chat contract address is not configured')
  }

  const provider = getReadProvider()
  const receipt = await provider.getTransactionReceipt(input.txHash)
  if (!receipt) {
    throw new Error('Super Chat transaction is not yet indexed')
  }
  if (receipt.status !== 1) {
    throw new Error('Super Chat transaction failed on-chain')
  }

  const confirmations = (await provider.getBlockNumber()) - receipt.blockNumber + 1
  if (confirmations < SUPER_CHAT_MIN_CONFIRMATIONS) {
    throw new Error(
      `Super Chat requires ${SUPER_CHAT_MIN_CONFIRMATIONS} confirmation(s). Current: ${confirmations}`
    )
  }

  if (normalizeWallet(receipt.to || '') !== SUPER_CHAT_ADDRESS) {
    throw new Error('Transaction is not sent to Super Chat contract')
  }
  if (normalizeWallet(receipt.from || '') !== input.expectedSender) {
    throw new Error('Super Chat sender does not match authenticated wallet')
  }

  let matchedEvent = false
  for (const log of receipt.logs) {
    if (normalizeWallet(log.address) !== SUPER_CHAT_ADDRESS) continue

    let parsed: ethers.LogDescription | null = null
    try {
      parsed = superChatEventInterface.parseLog(log)
    } catch {
      parsed = null
    }
    if (!parsed) continue

    if (parsed.name !== 'NativeSuperChatPaid') continue

    const eventSender = normalizeWallet(String(parsed.args.sender || ''))
    const eventCreator = normalizeWallet(String(parsed.args.creator || ''))
    const eventAmount = BigInt(parsed.args.grossAmount.toString())

    if (
      eventSender === input.expectedSender &&
      eventCreator === input.expectedCreator &&
      eventAmount === input.expectedAmountWei
    ) {
      matchedEvent = true
      break
    }
  }

  if (!matchedEvent) {
    throw new Error('No matching NativeSuperChatPaid event found for this user/creator/amount')
  }
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
        message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT','STICKER','SUPER_CHAT')),
        sticker_id VARCHAR(120),
        sticker_pack VARCHAR(120),
        superchat_amount VARCHAR(80),
        superchat_token VARCHAR(255),
        superchat_tx_hash VARCHAR(255),
        token_symbol VARCHAR(100),
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `)

    await db.pool.query(`
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT';
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sticker_id VARCHAR(120);
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS sticker_pack VARCHAR(120);
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS superchat_amount VARCHAR(80);
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS superchat_token VARCHAR(255);
      ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS superchat_tx_hash VARCHAR(255);
    `)

    await db.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room_created
      ON chat_messages(room_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_sender
      ON chat_messages(sender_wallet);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_superchat_tx
      ON chat_messages(superchat_tx_hash);
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
  db: DbConnection | null,
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

  if (!db || db.type !== 'pg' || !db.pool) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: 'Creator follower checks are unavailable while database is offline' },
        { status: 503 },
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
  db: DbConnection | null,
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

    const db = await getDbOrNull()
    if (db) {
      await ensureChatSchema(db)
    }

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

    if (db && db.type === 'pg' && db.pool) {
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
      messages = getInMemoryMessages(
        roomAuth.normalizedRoomId,
        limit,
        beforeTs && Number.isFinite(beforeTs) ? beforeTs : null
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
    const trimmedMessage = message.trim()
    const messageType = normalizeMessageType(body?.messageType)
    const stickerId = normalizeOptionalText(body?.stickerId, 120)
    const stickerPack = normalizeOptionalText(body?.stickerPack, 120)
    const superchatAmountRaw = normalizeOptionalText(body?.superchatAmount, 80)
    const superchatTokenRaw = normalizeOptionalText(body?.superchatToken, 255)
    const superchatTxHashRaw = normalizeOptionalText(body?.superchatTxHash, 255)
    const tokenSymbol = normalizeOptionalText(body?.tokenSymbol, 100)

    if (trimmedMessage.length > 800) {
      return NextResponse.json(
        { success: false, error: 'Message is too long (max 800 chars)' },
        { status: 400 }
      )
    }

    if (messageType === 'TEXT' && !trimmedMessage) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      )
    }

    if (messageType === 'STICKER' && !stickerId) {
      return NextResponse.json(
        { success: false, error: 'Sticker id is required for sticker messages' },
        { status: 400 }
      )
    }

    let superchatAmount: string | null = null
    let superchatToken: string | null = null
    let superchatTxHash: string | null = null
    let superchatAmountWei: bigint | null = null

    if (messageType === 'SUPER_CHAT') {
      if (!superchatAmountRaw || !isPositiveDecimal(superchatAmountRaw)) {
        return NextResponse.json(
          { success: false, error: 'Valid superchat amount is required' },
          { status: 400 }
        )
      }

      if (!superchatTxHashRaw || !ethers.isHexString(superchatTxHashRaw, 32)) {
        return NextResponse.json(
          { success: false, error: 'Valid superchat transaction hash is required' },
          { status: 400 }
        )
      }

      if ((superchatTokenRaw || 'NATIVE').toUpperCase() !== 'NATIVE') {
        return NextResponse.json(
          { success: false, error: 'Only native-token super chat is currently supported by chat API' },
          { status: 400 }
        )
      }

      try {
        superchatAmountWei = ethers.parseEther(superchatAmountRaw)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid superchat amount format' },
          { status: 400 }
        )
      }

      if (!superchatAmountWei || superchatAmountWei <= 0n) {
        return NextResponse.json(
          { success: false, error: 'Superchat amount must be greater than zero' },
          { status: 400 }
        )
      }

      superchatAmount = superchatAmountRaw
      superchatToken = 'NATIVE'
      superchatTxHash = normalizeWallet(superchatTxHashRaw)
    }

    const db = await getDbOrNull()
    if (db) {
      await ensureChatSchema(db)
    }

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

    if (db && db.type === 'pg' && db.pool) {
      if (messageType === 'SUPER_CHAT') {
        const creatorWallet = parseCreatorRoom(roomAuth.normalizedRoomId)
        if (!creatorWallet) {
          return NextResponse.json(
            { success: false, error: 'Super chat is only allowed in creator rooms' },
            { status: 400 }
          )
        }

        const existingTx = await db.pool.query(
          `SELECT 1
           FROM chat_messages
           WHERE superchat_tx_hash = $1
           LIMIT 1`,
          [superchatTxHash]
        )
        if ((existingTx.rowCount || 0) > 0) {
          return NextResponse.json(
            { success: false, error: 'This super chat transaction has already been used' },
            { status: 409 }
          )
        }

        await verifyNativeSuperChatOnChain({
          txHash: superchatTxHash || '',
          expectedSender: normalizeWallet(user.wallet),
          expectedCreator: creatorWallet,
          expectedAmountWei: superchatAmountWei || 0n,
        })

        superchatAmount = ethers.formatEther(superchatAmountWei || 0n)
      }

      const result = await db.pool.query(
        `INSERT INTO chat_messages (
           sender_wallet,
           role,
           room_id,
           message,
           message_type,
           sticker_id,
           sticker_pack,
           superchat_amount,
           superchat_token,
           superchat_tx_hash,
           token_symbol,
           created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING *`,
        [
          normalizeWallet(user.wallet),
          user.role,
          roomAuth.normalizedRoomId,
          trimmedMessage,
          messageType,
          stickerId,
          stickerPack,
          superchatAmount,
          superchatToken,
          superchatTxHash,
          tokenSymbol || null,
          Date.now(),
        ]
      )
      insertedMessage = result.rows[0]
    } else {
      if (messageType === 'SUPER_CHAT') {
        return NextResponse.json(
          { success: false, error: 'Super chat requires database and on-chain verification' },
          { status: 503 }
        )
      }

      insertedMessage = appendInMemoryMessage({
        sender_wallet: normalizeWallet(user.wallet),
        role: user.role,
        room_id: roomAuth.normalizedRoomId,
        message: trimmedMessage,
        message_type: messageType,
        sticker_id: stickerId,
        sticker_pack: stickerPack,
        superchat_amount: null,
        superchat_token: null,
        superchat_tx_hash: null,
        token_symbol: tokenSymbol || null,
        created_at: Date.now(),
      })
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










