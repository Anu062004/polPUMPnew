import { getDb } from './postgresManager'

type ViewerRole = 'TRADER' | 'CREATOR'

const DEFAULT_STALE_WINDOW_MS = 45_000

let viewerSchemaReady = false
let viewerSchemaInitPromise: Promise<void> | null = null

function normalizeAddress(value: string): string {
  return value.toLowerCase()
}

async function ensureViewerSchema(db: Awaited<ReturnType<typeof getDb>>) {
  if (db.type !== 'pg' || !db.pool) return
  if (viewerSchemaReady) return

  if (viewerSchemaInitPromise) {
    await viewerSchemaInitPromise
    return
  }

  viewerSchemaInitPromise = (async () => {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS livestream_viewers (
        token_address VARCHAR(255) NOT NULL,
        viewer_wallet VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('TRADER','CREATOR')),
        is_creator BOOLEAN NOT NULL DEFAULT FALSE,
        joined_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        last_seen BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        PRIMARY KEY (token_address, viewer_wallet)
      )
    `)

    await db.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_livestream_viewers_token_last_seen
      ON livestream_viewers(token_address, last_seen DESC);
      CREATE INDEX IF NOT EXISTS idx_livestream_viewers_last_seen
      ON livestream_viewers(last_seen DESC);
    `)

    viewerSchemaReady = true
  })()

  try {
    await viewerSchemaInitPromise
  } finally {
    viewerSchemaInitPromise = null
  }
}

export async function touchViewerPresence(
  tokenAddress: string,
  viewerWallet: string,
  role: ViewerRole,
  isCreator: boolean
) {
  const db = await getDb()
  if (db.type !== 'pg' || !db.pool) {
    throw new Error('Viewer tracking requires PostgreSQL')
  }

  await ensureViewerSchema(db)

  const now = Date.now()
  const normalizedTokenAddress = normalizeAddress(tokenAddress)
  const normalizedViewerWallet = normalizeAddress(viewerWallet)

  await db.pool.query(
    `INSERT INTO livestream_viewers (
      token_address,
      viewer_wallet,
      role,
      is_creator,
      joined_at,
      last_seen
    )
    VALUES ($1, $2, $3, $4, $5, $5)
    ON CONFLICT (token_address, viewer_wallet)
    DO UPDATE SET
      role = EXCLUDED.role,
      is_creator = EXCLUDED.is_creator,
      last_seen = EXCLUDED.last_seen`,
    [
      normalizedTokenAddress,
      normalizedViewerWallet,
      role,
      isCreator,
      now,
    ]
  )
}

export async function removeViewerPresence(tokenAddress: string, viewerWallet: string) {
  const db = await getDb()
  if (db.type !== 'pg' || !db.pool) {
    throw new Error('Viewer tracking requires PostgreSQL')
  }

  await ensureViewerSchema(db)

  await db.pool.query(
    `DELETE FROM livestream_viewers
     WHERE token_address = $1 AND viewer_wallet = $2`,
    [normalizeAddress(tokenAddress), normalizeAddress(viewerWallet)]
  )
}

export async function getActiveViewerCount(
  tokenAddress: string,
  options?: {
    staleWindowMs?: number
    includeCreator?: boolean
  }
): Promise<number> {
  const db = await getDb()
  if (db.type !== 'pg' || !db.pool) {
    throw new Error('Viewer tracking requires PostgreSQL')
  }

  await ensureViewerSchema(db)

  const normalizedTokenAddress = normalizeAddress(tokenAddress)
  const staleWindowMs = options?.staleWindowMs ?? DEFAULT_STALE_WINDOW_MS
  const includeCreator = options?.includeCreator ?? false
  const cutoff = Date.now() - staleWindowMs

  await db.pool.query(
    `DELETE FROM livestream_viewers
     WHERE token_address = $1 AND last_seen < $2`,
    [normalizedTokenAddress, cutoff]
  )

  const countQuery = includeCreator
    ? `SELECT COUNT(*)::int AS count
       FROM livestream_viewers
       WHERE token_address = $1 AND last_seen >= $2`
    : `SELECT COUNT(*)::int AS count
       FROM livestream_viewers
       WHERE token_address = $1 AND last_seen >= $2 AND is_creator = FALSE`

  const result = await db.pool.query(countQuery, [normalizedTokenAddress, cutoff])
  return Number(result.rows[0]?.count || 0)
}

