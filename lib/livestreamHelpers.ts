/**
 * Livestream URL construction helpers
 * Centralized logic for building RTMP ingest and HLS playback URLs
 */

export interface LivestreamUrls {
  ingestBaseUrl: string
  playbackBaseUrl: string
  streamKey: string
  ingestUrl: string // Full RTMP URL for OBS
  playbackUrl: string // Full HLS URL for playback
}

/**
 * Generate stream key for a token
 * Format: tokenAddress-randomSecret (e.g., "0x123...abc-def456")
 * 
 * Note: This is a legacy format. New streams use format: tokenAddress-randomSecret
 * generated in the API route with crypto.randomBytes()
 */
export function generateStreamKey(tokenAddress: string): string {
  if (!tokenAddress || !tokenAddress.startsWith('0x')) {
    throw new Error('Invalid token address')
  }
  // Legacy format for backward compatibility
  return `token_${tokenAddress.toLowerCase()}`
}

/**
 * Build all livestream URLs for a token
 */
export function buildLivestreamUrls(tokenAddress: string): LivestreamUrls {
  const streamKey = generateStreamKey(tokenAddress)
  
  // Get base URLs from environment
  // These should be set in your .env.local file:
  // LIVE_INGEST_BASE_URL=rtmp://your-stream-server.com/live
  // NEXT_PUBLIC_LIVE_PLAYBACK_BASE_URL=https://your-stream-server.com/hls
  const ingestBaseUrl = process.env.LIVE_INGEST_BASE_URL || process.env.NEXT_PUBLIC_LIVE_INGEST_BASE_URL || 'rtmp://localhost/live'
  const playbackBaseUrl = process.env.NEXT_PUBLIC_LIVE_PLAYBACK_BASE_URL || 'http://localhost/hls'
  
  // Remove trailing slashes
  const cleanIngestBase = ingestBaseUrl.replace(/\/$/, '')
  const cleanPlaybackBase = playbackBaseUrl.replace(/\/$/, '')
  
  // Construct full URLs
  const ingestUrl = `${cleanIngestBase}/${streamKey}`
  const playbackUrl = `${cleanPlaybackBase}/${streamKey}.m3u8`
  
  return {
    ingestBaseUrl: cleanIngestBase,
    playbackBaseUrl: cleanPlaybackBase,
    streamKey,
    ingestUrl,
    playbackUrl,
  }
}

