import { getDb } from './postgresManager'

export interface CreatorTokenLinkInput {
  creatorWallet: string
  tokenAddress: string
  coinId?: string | null
}

function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase()
}

let creatorSchemaReady = false
let creatorSchemaInitPromise: Promise<void> | null = null

async function ensureCreatorSchema(db: any): Promise<void> {
  if (creatorSchemaReady) return

  if (creatorSchemaInitPromise) {
    await creatorSchemaInitPromise
    return
  }

  creatorSchemaInitPromise = (async () => {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        wallet VARCHAR(255) PRIMARY KEY,
        role VARCHAR(20) NOT NULL DEFAULT 'TRADER' CHECK (role IN ('TRADER','CREATOR')),
        last_role_check BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `)

    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS creators (
        wallet VARCHAR(255) PRIMARY KEY,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `)

    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS creator_tokens (
        token_address VARCHAR(255) PRIMARY KEY,
        creator_wallet VARCHAR(255) NOT NULL,
        coin_id VARCHAR(255),
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
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
      CREATE INDEX IF NOT EXISTS idx_creators_wallet ON creators(wallet);
      CREATE INDEX IF NOT EXISTS idx_creator_tokens_creator ON creator_tokens(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_creator_tokens_coin_id ON creator_tokens(coin_id);
      CREATE INDEX IF NOT EXISTS idx_followers_creator ON creator_followers(creator_wallet);
      CREATE INDEX IF NOT EXISTS idx_followers_follower ON creator_followers(follower_wallet);
    `)

    // Backfill creators from existing CREATOR-role users.
    await db.pool.query(`
      INSERT INTO creators (wallet, created_at, updated_at)
      SELECT LOWER(wallet), created_at, updated_at
      FROM users
      WHERE role = 'CREATOR'
      ON CONFLICT (wallet)
      DO UPDATE SET updated_at = GREATEST(creators.updated_at, EXCLUDED.updated_at)
    `)

    // Backfill creators and creator-token links from existing coin rows when coins table exists.
    try {
      await db.pool.query(`
        INSERT INTO creators (wallet, created_at, updated_at)
        SELECT
          LOWER(creator),
          COALESCE(created_at, EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
          EXTRACT(EPOCH FROM NOW()) * 1000
        FROM coins
        WHERE creator IS NOT NULL AND creator <> ''
        ON CONFLICT (wallet)
        DO UPDATE SET updated_at = GREATEST(creators.updated_at, EXCLUDED.updated_at)
      `)

      await db.pool.query(`
        INSERT INTO creator_tokens (token_address, creator_wallet, coin_id, created_at, updated_at)
        SELECT
          LOWER(token_address),
          LOWER(creator),
          id,
          COALESCE(created_at, EXTRACT(EPOCH FROM NOW()) * 1000)::BIGINT,
          EXTRACT(EPOCH FROM NOW()) * 1000
        FROM coins
        WHERE token_address IS NOT NULL
          AND token_address <> ''
          AND creator IS NOT NULL
          AND creator <> ''
        ON CONFLICT (token_address)
        DO UPDATE SET
          creator_wallet = EXCLUDED.creator_wallet,
          coin_id = COALESCE(EXCLUDED.coin_id, creator_tokens.coin_id),
          updated_at = EXCLUDED.updated_at
      `)
    } catch {
      // coins table may not exist yet in some environments; ignore non-blocking backfill.
    }

    // Normalize and dedupe legacy creator rows case-insensitively.
    await db.pool.query(`
      WITH ranked AS (
        SELECT
          ctid,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(wallet)
            ORDER BY updated_at DESC, created_at DESC, wallet ASC
          ) AS rn
        FROM creators
      )
      DELETE FROM creators
      WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
    `)

    await db.pool.query(`
      UPDATE creators
      SET wallet = LOWER(wallet)
      WHERE wallet <> LOWER(wallet)
    `)

    // Normalize and dedupe legacy token association rows.
    await db.pool.query(`
      WITH ranked AS (
        SELECT
          ctid,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(token_address)
            ORDER BY updated_at DESC, created_at DESC, token_address ASC
          ) AS rn
        FROM creator_tokens
      )
      DELETE FROM creator_tokens
      WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
    `)

    await db.pool.query(`
      UPDATE creator_tokens
      SET
        token_address = LOWER(token_address),
        creator_wallet = LOWER(creator_wallet)
      WHERE
        token_address <> LOWER(token_address) OR
        creator_wallet <> LOWER(creator_wallet)
    `)

    // Remove duplicate creator-follower pairs regardless of case.
    await db.pool.query(`
      WITH ranked AS (
        SELECT
          ctid,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(creator_wallet), LOWER(follower_wallet)
            ORDER BY created_at DESC, creator_wallet ASC
          ) AS rn
        FROM creator_followers
      )
      DELETE FROM creator_followers
      WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
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

    // Keep only one followed creator per follower wallet (most recent row wins).
    await db.pool.query(`
      WITH ranked AS (
        SELECT
          ctid,
          ROW_NUMBER() OVER (
            PARTITION BY LOWER(follower_wallet)
            ORDER BY created_at DESC, creator_wallet ASC
          ) AS rn
        FROM creator_followers
      )
      DELETE FROM creator_followers
      WHERE ctid IN (SELECT ctid FROM ranked WHERE rn > 1)
    `)

    await db.pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_followers_single_creator_per_wallet
      ON creator_followers(follower_wallet)
    `)
    creatorSchemaReady = true
  })()

  try {
    await creatorSchemaInitPromise
  } finally {
    creatorSchemaInitPromise = null
  }
}

async function ensureCreatorTables() {
  const db = await getDb()

  if (db.type === 'pg' && db.pool) {
    await ensureCreatorSchema(db)
  }

  return db
}

export async function upsertCreatorWallet(wallet: string): Promise<void> {
  if (!wallet) return

  const db = await ensureCreatorTables()
  if (db.type !== 'pg' || !db.pool) return

  const normalized = normalizeWallet(wallet)
  const now = Date.now()

  await db.pool.query(
    `INSERT INTO creators (wallet, created_at, updated_at)
     VALUES ($1, $2, $2)
     ON CONFLICT (wallet)
     DO UPDATE SET updated_at = EXCLUDED.updated_at`,
    [normalized, now]
  )
}

export async function linkCreatorToken(input: CreatorTokenLinkInput): Promise<void> {
  const db = await ensureCreatorTables()
  if (db.type !== 'pg' || !db.pool) return

  const creatorWallet = normalizeWallet(input.creatorWallet)
  const tokenAddress = normalizeWallet(input.tokenAddress)
  const coinId = input.coinId || null
  const now = Date.now()

  await upsertCreatorWallet(creatorWallet)

  await db.pool.query(
    `INSERT INTO creator_tokens (token_address, creator_wallet, coin_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (token_address)
     DO UPDATE SET
       creator_wallet = EXCLUDED.creator_wallet,
       coin_id = COALESCE(EXCLUDED.coin_id, creator_tokens.coin_id),
       updated_at = EXCLUDED.updated_at`,
    [tokenAddress, creatorWallet, coinId, now]
  )
}

export async function followCreator(
  followerWallet: string,
  creatorWallet: string
): Promise<{ creatorWallet: string; followerWallet: string; createdAt: number }> {
  const db = await ensureCreatorTables()
  if (db.type !== 'pg' || !db.pool) {
    throw new Error('Creator follow is only available with PostgreSQL')
  }

  const follower = normalizeWallet(followerWallet)
  const creator = normalizeWallet(creatorWallet)
  const now = Date.now()

  if (follower === creator) {
    throw new Error('You cannot follow your own wallet')
  }

  const creatorEligibility = await db.pool.query(
    `SELECT
       EXISTS(SELECT 1 FROM creators WHERE wallet = $1) AS has_creator_profile,
       EXISTS(SELECT 1 FROM creator_tokens WHERE creator_wallet = $1) AS has_creator_tokens,
       EXISTS(SELECT 1 FROM users WHERE wallet = $1 AND role = 'CREATOR') AS has_creator_role`,
    [creator]
  )
  const eligibility = creatorEligibility.rows?.[0] || {}
  const isEligibleCreator =
    eligibility.has_creator_profile ||
    eligibility.has_creator_tokens ||
    eligibility.has_creator_role

  // If indexing is stale, do not hard-fail the follow action.
  // Ensure the wallet can still be followed and appears in creator lists.
  if (!isEligibleCreator) {
    console.warn(`Following unindexed creator wallet: ${creator}`)
  }
  await upsertCreatorWallet(creator)

  // Keep one-follow-per-wallet behavior even if a follower_wallet unique index
  // is missing or not yet created in some environments.
  const client = await db.pool.connect()
  let result
  try {
    await client.query('BEGIN')

    await client.query(
      `DELETE FROM creator_followers
       WHERE follower_wallet = $1
         AND creator_wallet <> $2`,
      [follower, creator]
    )

    result = await client.query(
      `INSERT INTO creator_followers (creator_wallet, follower_wallet, created_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (creator_wallet, follower_wallet)
       DO UPDATE SET created_at = EXCLUDED.created_at
       RETURNING creator_wallet, follower_wallet, created_at`,
      [creator, follower, now]
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  return {
    creatorWallet: result.rows[0].creator_wallet,
    followerWallet: result.rows[0].follower_wallet,
    createdAt: Number(result.rows[0].created_at),
  }
}

export async function unfollowCreator(
  followerWallet: string
): Promise<{ removed: boolean }> {
  const db = await ensureCreatorTables()
  if (db.type !== 'pg' || !db.pool) {
    throw new Error('Creator follow is only available with PostgreSQL')
  }

  const follower = normalizeWallet(followerWallet)
  const result = await db.pool.query(
    `DELETE FROM creator_followers
     WHERE follower_wallet = $1`,
    [follower]
  )

  return { removed: (result.rowCount || 0) > 0 }
}

export async function getFollowedCreator(
  followerWallet: string
): Promise<{ creatorWallet: string; followedAt: number } | null> {
  const db = await ensureCreatorTables()
  if (db.type !== 'pg' || !db.pool) return null

  const follower = normalizeWallet(followerWallet)
  const result = await db.pool.query(
    `SELECT creator_wallet, created_at
     FROM creator_followers
     WHERE follower_wallet = $1
     LIMIT 1`,
    [follower]
  )

  if (result.rows.length === 0) return null
  return {
    creatorWallet: result.rows[0].creator_wallet,
    followedAt: Number(result.rows[0].created_at),
  }
}

export async function getCreatorFollowerCount(creatorWallet: string): Promise<number> {
  const db = await ensureCreatorTables()
  if (db.type !== 'pg' || !db.pool) return 0

  const creator = normalizeWallet(creatorWallet)
  const result = await db.pool.query(
    `SELECT COUNT(*) AS total
     FROM creator_followers
     WHERE creator_wallet = $1`,
    [creator]
  )

  return Number(result.rows[0]?.total || 0)
}
