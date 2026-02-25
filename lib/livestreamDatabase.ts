/**
 * Livestream database operations backed by PostgreSQL.
 * Keeps livestream state and token -> creator lookups in a single source of truth.
 */

import { buildLivestreamUrls } from './livestreamHelpers'
import { getSql, initializeSchema } from './postgresManager'

export interface LivestreamRecord {
  tokenAddress: string
  creatorAddress: string
  streamKey: string
  ingestBaseUrl: string
  playbackBaseUrl: string
  status: 'offline' | 'live'
  updatedAt: number
}

function mapLivestreamRow(row: any): LivestreamRecord {
  return {
    tokenAddress: row.token_address,
    creatorAddress: row.creator_address,
    streamKey: row.stream_key,
    ingestBaseUrl: row.ingest_base_url,
    playbackBaseUrl: row.playback_base_url,
    status: row.status === 'live' ? 'live' : 'offline',
    updatedAt: Number(row.updated_at || Date.now()),
  }
}

function toRows(result: any): any[] {
  return Array.isArray(result) ? result : result?.rows || []
}

async function requireSqlClient() {
  await initializeSchema()
  const sql = await getSql()
  if (!sql) {
    throw new Error('Postgres not available for livestream operations')
  }
  return sql
}

/**
 * Get livestream record for a token.
 */
export async function getLivestream(tokenAddress: string): Promise<LivestreamRecord | null> {
  const sql = await requireSqlClient()
  const normalized = tokenAddress.toLowerCase()
  const result = await sql`
    SELECT *
    FROM livestreams
    WHERE LOWER(token_address) = LOWER(${normalized})
    LIMIT 1
  `
  const rows = toRows(result)
  if (rows.length === 0) {
    return null
  }
  return mapLivestreamRow(rows[0])
}

/**
 * Create or update livestream record.
 *
 * @param tokenAddress - Token contract address
 * @param creatorAddress - Creator wallet address
 * @param status - 'live' or 'offline'
 * @param streamKey - Optional stream key (if not provided, uses existing/default)
 * @param ingestBaseUrl - Optional RTMP base URL (if not provided, uses existing/default)
 * @param playbackBaseUrl - Optional HLS base URL (if not provided, uses existing/default)
 */
export async function upsertLivestream(
  tokenAddress: string,
  creatorAddress: string,
  status: 'offline' | 'live',
  streamKey?: string,
  ingestBaseUrl?: string,
  playbackBaseUrl?: string
): Promise<LivestreamRecord> {
  const sql = await requireSqlClient()
  const normalizedToken = tokenAddress.toLowerCase()
  const normalizedCreator = creatorAddress.toLowerCase()
  const now = Date.now()

  const existing = await getLivestream(normalizedToken)
  const defaults = buildLivestreamUrls(normalizedToken)

  const finalStreamKey = streamKey || existing?.streamKey || defaults.streamKey
  const finalIngestBaseUrl = ingestBaseUrl || existing?.ingestBaseUrl || defaults.ingestBaseUrl
  const finalPlaybackBaseUrl =
    playbackBaseUrl || existing?.playbackBaseUrl || defaults.playbackBaseUrl

  const result = await sql`
    INSERT INTO livestreams (
      token_address,
      creator_address,
      stream_key,
      ingest_base_url,
      playback_base_url,
      status,
      updated_at
    )
    VALUES (
      ${normalizedToken},
      ${normalizedCreator},
      ${finalStreamKey},
      ${finalIngestBaseUrl},
      ${finalPlaybackBaseUrl},
      ${status},
      ${now}
    )
    ON CONFLICT (token_address)
    DO UPDATE SET
      creator_address = EXCLUDED.creator_address,
      stream_key = EXCLUDED.stream_key,
      ingest_base_url = EXCLUDED.ingest_base_url,
      playback_base_url = EXCLUDED.playback_base_url,
      status = EXCLUDED.status,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `

  const rows = toRows(result)
  if (rows.length === 0) {
    throw new Error('Failed to upsert livestream record')
  }
  return mapLivestreamRow(rows[0])
}

/**
 * Get token creator from database or on-chain fallback.
 */
export async function getTokenCreator(tokenAddress: string): Promise<string | null> {
  const sql = await requireSqlClient()
  const normalized = tokenAddress.toLowerCase()

  const coin = await sql`
    SELECT creator
    FROM coins
    WHERE LOWER(token_address) = LOWER(${normalized})
    LIMIT 1
  `
  const coinRows = toRows(coin)
  if (coinRows[0]?.creator) {
    return coinRows[0].creator
  }

  // If not in database, try on-chain lookup.
  try {
    const { ethers } = await import('ethers')
    const rpcUrl =
      process.env.NEXT_PUBLIC_EVM_RPC ||
      process.env.RPC_URL ||
      'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    const optionalAbi = ['function creator() view returns (address)']
    const contract = new ethers.Contract(tokenAddress, optionalAbi, provider)

    try {
      const creator = await contract.creator()
      if (creator && creator !== ethers.ZeroAddress) {
        return creator.toLowerCase()
      }
    } catch {
      // creator() function not available.
    }
  } catch (e) {
    console.warn('Failed to get creator on-chain:', e)
  }

  return null
}
