import crypto from 'crypto'
import { ethers } from 'ethers'
import { getDb } from './postgresManager'

export type AuthChallengePurpose = 'authenticate'

export interface AuthChallengeRecord {
  challengeId: string
  wallet: string
  purpose: AuthChallengePurpose
  nonce: string
  message: string
  createdAt: number
  expiresAt: number
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000

let challengeSchemaReady = false
let challengeSchemaInitPromise: Promise<void> | null = null

const inMemoryChallenges = new Map<string, AuthChallengeRecord & { consumedAt: number | null }>()

function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase()
}

function buildChallengeMessage(input: {
  wallet: string
  challengeId: string
  nonce: string
  issuedAt: number
  purpose: AuthChallengePurpose
  chainId?: number | null
  domain?: string | null
}): string {
  const chainIdLine = input.chainId ? `\nChain ID: ${input.chainId}` : ''
  const domainLine = input.domain ? `\nDomain: ${input.domain}` : ''

  return [
    `Sign this message to ${input.purpose}`,
    '',
    `Address: ${input.wallet}`,
    `Challenge ID: ${input.challengeId}`,
    `Nonce: ${input.nonce}`,
    `Timestamp: ${input.issuedAt}${chainIdLine}${domainLine}`,
    '',
    'This signature will not cost any gas.',
  ].join('\n')
}

async function ensureChallengeSchema(db: Awaited<ReturnType<typeof getDb>>) {
  if (db.type !== 'pg' || !db.pool) return
  if (challengeSchemaReady) return

  if (challengeSchemaInitPromise) {
    await challengeSchemaInitPromise
    return
  }

  challengeSchemaInitPromise = (async () => {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS auth_challenges (
        challenge_id VARCHAR(80) PRIMARY KEY,
        wallet VARCHAR(255) NOT NULL,
        purpose VARCHAR(40) NOT NULL,
        nonce VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL,
        consumed_at BIGINT
      )
    `)

    await db.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_challenges_wallet
      ON auth_challenges(wallet, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_auth_challenges_expires
      ON auth_challenges(expires_at);
    `)

    challengeSchemaReady = true
  })()

  try {
    await challengeSchemaInitPromise
  } finally {
    challengeSchemaInitPromise = null
  }
}

async function getDbOrNull(): Promise<Awaited<ReturnType<typeof getDb>> | null> {
  try {
    return await getDb()
  } catch (error: any) {
    console.warn(
      'Auth challenge storage: Postgres unavailable, using in-memory fallback:',
      error?.message || error
    )
    return null
  }
}

export async function createAuthChallenge(input: {
  wallet: string
  purpose?: AuthChallengePurpose
  chainId?: number | null
  domain?: string | null
}): Promise<AuthChallengeRecord> {
  if (!ethers.isAddress(input.wallet)) {
    throw new Error('Invalid wallet address')
  }

  const wallet = normalizeWallet(input.wallet)
  const purpose: AuthChallengePurpose = input.purpose || 'authenticate'
  const challengeId = crypto.randomUUID()
  const nonce = crypto.randomBytes(16).toString('hex')
  const createdAt = Date.now()
  const expiresAt = createdAt + CHALLENGE_TTL_MS
  const message = buildChallengeMessage({
    wallet,
    challengeId,
    nonce,
    issuedAt: createdAt,
    purpose,
    chainId: input.chainId ?? null,
    domain: input.domain ?? null,
  })

  const record: AuthChallengeRecord = {
    challengeId,
    wallet,
    purpose,
    nonce,
    message,
    createdAt,
    expiresAt,
  }

  // Keep a local copy as a resilient fallback when Postgres is unavailable.
  inMemoryChallenges.set(challengeId, { ...record, consumedAt: null })

  const db = await getDbOrNull()
  if (db?.type === 'pg' && db.pool) {
    try {
      await ensureChallengeSchema(db)
      await db.pool.query(
        `INSERT INTO auth_challenges (
          challenge_id, wallet, purpose, nonce, message, created_at, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [challengeId, wallet, purpose, nonce, message, createdAt, expiresAt]
      )
      return record
    } catch (error: any) {
      console.warn(
        'Auth challenge storage: Postgres write failed, using in-memory fallback:',
        error?.message || error
      )
    }
  }

  return record
}

export async function consumeAuthChallenge(input: {
  wallet: string
  challengeId: string
  purpose?: AuthChallengePurpose
}): Promise<AuthChallengeRecord> {
  if (!ethers.isAddress(input.wallet)) {
    throw new Error('Invalid wallet address')
  }
  if (!input.challengeId || typeof input.challengeId !== 'string') {
    throw new Error('Challenge id is required')
  }

  const wallet = normalizeWallet(input.wallet)
  const purpose: AuthChallengePurpose = input.purpose || 'authenticate'
  const now = Date.now()

  const db = await getDbOrNull()
  if (db?.type === 'pg' && db.pool) {
    try {
      await ensureChallengeSchema(db)

      // Cleanup expired challenges best-effort.
      await db.pool.query(
        `DELETE FROM auth_challenges
         WHERE (expires_at < $1 OR consumed_at IS NOT NULL) AND created_at < $2`,
        [now, now - (24 * 60 * 60 * 1000)]
      )

      const result = await db.pool.query(
        `UPDATE auth_challenges
         SET consumed_at = $1
         WHERE challenge_id = $2
           AND wallet = $3
           AND purpose = $4
           AND consumed_at IS NULL
           AND expires_at >= $1
         RETURNING challenge_id, wallet, purpose, nonce, message, created_at, expires_at`,
        [now, input.challengeId, wallet, purpose]
      )

      const row = result.rows[0]
      if (row) {
        inMemoryChallenges.delete(input.challengeId)
        return {
          challengeId: row.challenge_id,
          wallet: row.wallet,
          purpose: row.purpose,
          nonce: row.nonce,
          message: row.message,
          createdAt: Number(row.created_at),
          expiresAt: Number(row.expires_at),
        }
      }
    } catch (error: any) {
      console.warn(
        'Auth challenge storage: Postgres consume failed, using in-memory fallback:',
        error?.message || error
      )
    }
  }

  const inMemory = inMemoryChallenges.get(input.challengeId)
  if (!inMemory) {
    throw new Error('Invalid, expired, or already used challenge')
  }
  if (
    inMemory.wallet !== wallet ||
    inMemory.purpose !== purpose ||
    inMemory.consumedAt !== null ||
    inMemory.expiresAt < now
  ) {
    throw new Error('Invalid, expired, or already used challenge')
  }
  inMemory.consumedAt = now
  inMemoryChallenges.set(input.challengeId, inMemory)
  return {
    challengeId: inMemory.challengeId,
    wallet: inMemory.wallet,
    purpose: inMemory.purpose,
    nonce: inMemory.nonce,
    message: inMemory.message,
    createdAt: inMemory.createdAt,
    expiresAt: inMemory.expiresAt,
  }
}
