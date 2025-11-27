/**
 * Blockchain utilities for POL Pump Gaming Backend
 * 
 * Provides read-only blockchain operations for token validation and balance checking.
 * Follows the same patterns as app/api/gaming/coins/[address]/route.ts
 * 
 * All operations are non-blocking and gracefully handle RPC failures.
 */

import { ethers } from 'ethers'
import { config } from './config'

// ERC20 ABI for token queries (matches existing code)
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

// Provider cache
let provider: ethers.JsonRpcProvider | null = null

/**
 * Get or create RPC provider instance
 * Exported for use in routes that need direct provider access
 */
export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(config.blockchain.rpcUrl)
  }
  return provider
}

/**
 * Validate that an address is a valid Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address)
  } catch {
    return false
  }
}

/**
 * Validate token address format
 * Returns true if address is valid, false otherwise
 */
export function validateTokenAddress(tokenAddress: string): { valid: boolean; error?: string } {
  if (!tokenAddress || typeof tokenAddress !== 'string') {
    return { valid: false, error: 'Token address is required' }
  }

  if (!isValidAddress(tokenAddress)) {
    return { valid: false, error: 'Invalid token address format' }
  }

  return { valid: true }
}

/**
 * Get token balance for a user (read-only, non-blocking)
 * Returns '0' if RPC fails or token doesn't exist (graceful degradation)
 * 
 * Matches the pattern from app/api/gaming/coins/[address]/route.ts
 */
export async function getTokenBalance(
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  // Validate addresses
  if (!isValidAddress(tokenAddress) || !isValidAddress(userAddress)) {
    return '0'
  }

  // If on-chain validation is disabled, skip RPC call
  if (!config.blockchain.enableOnChainValidation) {
    return '0'
  }

  try {
    const provider = getProvider()
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    
    const balance = await token.balanceOf(userAddress)
    const decimals = await token.decimals().catch(() => 18) // Default to 18 if decimals() fails
    
    return ethers.formatUnits(balance, decimals)
  } catch (error: any) {
    // Non-blocking: log warning but don't throw
    console.warn(`⚠️ Failed to get balance for ${tokenAddress}:`, error.message)
    return '0'
  }
}

/**
 * Get token metadata (symbol, name, decimals) - read-only, non-blocking
 * Returns null if RPC fails (graceful degradation)
 */
export async function getTokenMetadata(
  tokenAddress: string
): Promise<{ symbol: string; name: string; decimals: number } | null> {
  // Validate address
  if (!isValidAddress(tokenAddress)) {
    return null
  }

  // If on-chain validation is disabled, skip RPC call
  if (!config.blockchain.enableOnChainValidation) {
    return null
  }

  try {
    const provider = getProvider()
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    
    const [symbol, name, decimals] = await Promise.all([
      token.symbol().catch(() => 'UNKNOWN'),
      token.name().catch(() => 'Unknown Token'),
      token.decimals().catch(() => 18)
    ])
    
    return { symbol, name, decimals }
  } catch (error: any) {
    // Non-blocking: log warning but don't throw
    console.warn(`⚠️ Failed to get token metadata for ${tokenAddress}:`, error.message)
    return null
  }
}

/**
 * Get latest block for randomness (used in Coinflip)
 * Returns null if RPC fails (graceful degradation)
 */
export async function getLatestBlock(): Promise<{ number: number; hash: string } | null> {
  if (!config.blockchain.enableOnChainValidation) {
    return null
  }

  try {
    const provider = getProvider()
    const block = await provider.getBlock('latest')
    
    if (!block || !block.hash) {
      return null
    }
    
    return {
      number: block.number,
      hash: block.hash
    }
  } catch (error: any) {
    // Non-blocking: log warning but don't throw
    console.warn('⚠️ Failed to get latest block:', error.message)
    return null
  }
}

/**
 * Test RPC connection health
 * Returns true if RPC is accessible, false otherwise
 */
export async function testRpcConnection(): Promise<boolean> {
  try {
    const provider = getProvider()
    await provider.getBlockNumber()
    return true
  } catch {
    return false
  }
}

