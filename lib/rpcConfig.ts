/**
 * Centralized RPC configuration
 * Removes hardcoded API keys and requires environment variables
 */

function getRpcUrl(envVar: string, fallback?: string): string {
  const url = process.env[envVar]
  if (!url) {
    if (fallback) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error(
          `Required environment variable ${envVar} is not set. ` +
          `Please configure your RPC endpoint in production.`
        )
      }
      console.warn(`⚠️ ${envVar} not set, using public fallback. Configure this for production.`)
      return fallback
    }
    throw new Error(`Required environment variable ${envVar} is not set.`)
  }
  return url
}

/**
 * Get RPC URL with priority order:
 * 1. NEXT_PUBLIC_EVM_RPC
 * 2. POLYGON_AMOY_RPC
 * 3. RPC_URL
 * 4. Fallback to public node (development only)
 */
export function getEvmRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_EVM_RPC ||
    process.env.POLYGON_AMOY_RPC ||
    process.env.RPC_URL ||
    getRpcUrl('NEXT_PUBLIC_EVM_RPC', 'https://polygon-amoy.publicnode.com')
  )
}

/**
 * Get indexer RPC URL
 */
export function getIndexerRpcUrl(): string {
  return (
    process.env.NEXT_PUBLIC_INDEXER_RPC ||
    process.env.INDEXER_RPC ||
    getEvmRpcUrl() // Fallback to main RPC
  )
}




