/**
 * Role Assignment Service
 * Determines user role based on ERC-20 token balance
 * 
 * Role Rules:
 * - If wallet holds ≥ CREATOR_MIN_TOKEN_BALANCE → CREATOR
 * - Else → TRADER
 */

import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from './contract-config'

export type Role = 'TRADER' | 'CREATOR'

// Configuration: Minimum token balance required to be a CREATOR
// This should be set via environment variable or contract config
// For now, using a default value (can be overridden)
export const CREATOR_MIN_TOKEN_BALANCE = process.env.CREATOR_MIN_TOKEN_BALANCE 
  ? BigInt(process.env.CREATOR_MIN_TOKEN_BALANCE)
  : BigInt('1000000000000000000') // Default: 1 token (assuming 18 decimals)

// The ERC-20 token address used for role gating
// This should be set via environment variable
export const ROLE_TOKEN_ADDRESS = process.env.ROLE_TOKEN_ADDRESS || ''

// Standard ERC-20 ABI for balanceOf
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
] as const

/**
 * Get ERC-20 token balance for an address
 */
async function getTokenBalance(
  provider: ethers.Provider,
  tokenAddress: string,
  walletAddress: string
): Promise<bigint> {
  try {
    const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const balance = await tokenContract.balanceOf(walletAddress)
    return balance
  } catch (error: any) {
    console.error('Error fetching token balance:', error)
    throw new Error(`Failed to fetch token balance: ${error.message}`)
  }
}

/**
 * Determine user role based on token balance
 * @param walletAddress The wallet address to check
 * @param provider Optional ethers provider (will create one if not provided)
 * @returns User role: 'CREATOR' or 'TRADER'
 */
export async function assignRole(
  walletAddress: string,
  provider?: ethers.Provider
): Promise<Role> {
  // If no role token is configured, default to TRADER
  if (!ROLE_TOKEN_ADDRESS || !ethers.isAddress(ROLE_TOKEN_ADDRESS)) {
    console.warn('⚠️ ROLE_TOKEN_ADDRESS not configured. Defaulting to TRADER role.')
    return 'TRADER'
  }

  try {
    // Create provider if not provided
    const rpcProvider = provider || new ethers.JsonRpcProvider(CONTRACT_CONFIG.RPC_URL)

    // Get token balance
    const balance = await getTokenBalance(
      rpcProvider,
      ROLE_TOKEN_ADDRESS,
      walletAddress
    )

    // Compare balance with minimum threshold
    if (balance >= CREATOR_MIN_TOKEN_BALANCE) {
      return 'CREATOR'
    }

    return 'TRADER'
  } catch (error: any) {
    console.error('Error assigning role:', error)
    // On error, default to TRADER (more restrictive)
    return 'TRADER'
  }
}

/**
 * Check if a wallet has CREATOR role
 */
export async function isCreator(
  walletAddress: string,
  provider?: ethers.Provider
): Promise<boolean> {
  const role = await assignRole(walletAddress, provider)
  return role === 'CREATOR'
}

/**
 * Revalidate role (useful for periodic checks during long sessions)
 */
export async function revalidateRole(
  walletAddress: string,
  currentRole: Role,
  provider?: ethers.Provider
): Promise<{ role: Role; changed: boolean }> {
  const newRole = await assignRole(walletAddress, provider)
  return {
    role: newRole,
    changed: newRole !== currentRole,
  }
}






