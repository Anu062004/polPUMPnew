/**
 * Centralized configuration for POL Pump Gaming Backend
 * 
 * Environment variables are loaded via dotenv and provide sensible defaults.
 * This module centralizes all configuration to avoid duplication.
 */

import dotenv from 'dotenv'
import path from 'path'

// Load environment variables from .env file
dotenv.config()

/**
 * Get the project root directory (handles running from server/ or project root)
 */
function getProjectRoot(): string {
  const cwd = process.cwd()
  // If we're in the server directory, go up one level
  if (cwd.endsWith('server') || cwd.includes('server')) {
    return path.resolve(cwd, '..')
  }
  return cwd
}

/**
 * Application configuration
 */
export const config = {
  // Server configuration
  server: {
    // Port priority: BACKEND_PORT > PORT > 4000
    port: parseInt(
      process.env.BACKEND_PORT || 
      process.env.PORT || 
      '4000',
      10
    ),
    // CORS origin configuration
    cors: {
      // Development: allow localhost:3000
      // Production: use FRONTEND_ORIGIN env var
      // Note: NEXT_PUBLIC_BACKEND_URL is for frontend, not CORS origin
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
      credentials: true
    }
  },

  // Database configuration
  database: {
    // Project root directory
    projectRoot: getProjectRoot(),
    // Data directory (relative to project root)
    dataDir: path.join(getProjectRoot(), 'data'),
    // Database file paths
    gamingDbPath: path.join(getProjectRoot(), 'data', 'gaming.db'),
    coinsDbPath: path.join(getProjectRoot(), 'data', 'coins.db')
  },

  // Blockchain/RPC configuration
  blockchain: {
    // RPC URL priority: RPC_URL > NEXT_PUBLIC_EVM_RPC > POLYGON_AMOY_RPC > default
    rpcUrl: process.env.RPC_URL ||
            process.env.NEXT_PUBLIC_EVM_RPC ||
            process.env.POLYGON_AMOY_RPC ||
            'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f',
    
    // Chain configuration
    chainId: 80002, // Polygon Amoy testnet
    network: 'polygon-amoy-testnet',
    
    // Optional: Enable/disable on-chain validation (default: true, but graceful fallback)
    enableOnChainValidation: process.env.ENABLE_ON_CHAIN_VALIDATION !== 'false'
  },

  // Environment detection
  environment: {
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    nodeEnv: process.env.NODE_ENV || 'development'
  }
}

/**
 * Validate required configuration (called on server startup)
 */
export function validateConfig(): void {
  const errors: string[] = []

  // Validate port
  if (isNaN(config.server.port) || config.server.port < 1 || config.server.port > 65535) {
    errors.push(`Invalid port: ${config.server.port}`)
  }

  // Validate RPC URL format (basic check)
  try {
    new URL(config.blockchain.rpcUrl)
  } catch {
    errors.push(`Invalid RPC URL format: ${config.blockchain.rpcUrl}`)
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`)
  }
}

/**
 * Print configuration summary (without sensitive data)
 */
export function printConfigSummary(): void {
  console.log('📋 Configuration Summary:')
  console.log(`  Environment: ${config.environment.nodeEnv}`)
  console.log(`  Server Port: ${config.server.port}`)
  console.log(`  CORS Origin: ${config.server.cors.origin}`)
  console.log(`  Database Dir: ${config.database.dataDir}`)
  console.log(`  RPC URL: ${config.blockchain.rpcUrl.substring(0, 50)}...`)
  console.log(`  On-chain Validation: ${config.blockchain.enableOnChainValidation ? 'enabled' : 'disabled'}`)
}

