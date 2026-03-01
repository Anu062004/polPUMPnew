/**
 * Authentication utilities for wallet signature verification
 * Ensures gaming endpoints verify user ownership of wallet addresses
 */

import { ethers } from 'ethers'

export interface SignatureVerification {
  isValid: boolean
  recoveredAddress?: string
  error?: string
}

const consumedNonceWindow = new Map<string, number>()

function parseLineValue(message: string, label: string): string | null {
  const regex = new RegExp(`${label}:\\s*([^\\n]+)`, 'i')
  const match = message.match(regex)
  return match?.[1]?.trim() || null
}

function markNonceAsConsumed(
  message: string,
  normalizedAddress: string,
  maxAgeMs: number
): SignatureVerification | null {
  const nonce = parseLineValue(message, 'Nonce')
  if (!nonce) {
    return {
      isValid: false,
      error: 'Message missing nonce',
    }
  }

  const actionLine = String(message.split('\n')[0] || '').trim().toLowerCase()
  const key = `${normalizedAddress}:${actionLine}:${nonce}`
  const now = Date.now()
  const existingConsumedAt = consumedNonceWindow.get(key)

  if (existingConsumedAt && now - existingConsumedAt <= maxAgeMs) {
    return {
      isValid: false,
      error: 'Signature nonce has already been used',
    }
  }

  consumedNonceWindow.set(key, now)

  // Lightweight cleanup.
  if (consumedNonceWindow.size > 2000) {
    for (const [entryKey, consumedAt] of consumedNonceWindow.entries()) {
      if (now - consumedAt > maxAgeMs) {
        consumedNonceWindow.delete(entryKey)
      }
    }
  }

  return null
}

/**
 * Verify a wallet signature
 * @param message The original message that was signed
 * @param signature The signature to verify
 * @param expectedAddress The address that should have signed
 * @returns Verification result
 */
export function verifyWalletSignature(
  message: string,
  signature: string,
  expectedAddress: string
): SignatureVerification {
  try {
    if (!message || !signature || !expectedAddress) {
      return {
        isValid: false,
        error: 'Missing required fields: message, signature, or address'
      }
    }

    if (!ethers.isAddress(expectedAddress)) {
      return {
        isValid: false,
        error: 'Invalid address format'
      }
    }

    if (!signature.startsWith('0x') || signature.length !== 132) {
      return {
        isValid: false,
        error: 'Invalid signature format'
      }
    }

    // Recover the address from the signature
    const recoveredAddress = ethers.verifyMessage(message, signature)
    
    // Normalize addresses for comparison (lowercase)
    const normalizedRecovered = recoveredAddress.toLowerCase()
    const normalizedExpected = expectedAddress.toLowerCase()

    if (normalizedRecovered !== normalizedExpected) {
      return {
        isValid: false,
        recoveredAddress,
        error: 'Signature does not match expected address'
      }
    }

    return {
      isValid: true,
      recoveredAddress
    }
  } catch (error: any) {
    return {
      isValid: false,
      error: error.message || 'Signature verification failed'
    }
  }
}

/**
 * Generate a message for the user to sign
 * Includes timestamp and nonce to prevent replay attacks
 */
export function generateSignMessage(
  userAddress: string,
  action: string,
  nonce: string | number,
  timestamp: number = Date.now()
): string {
  return `Sign this message to ${action}\n\nAddress: ${userAddress}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nThis signature will not cost any gas.`
}

/**
 * Verify signature with timestamp to prevent replay attacks
 * Messages older than maxAgeMs are rejected
 */
export function verifySignatureWithTimestamp(
  message: string,
  signature: string,
  expectedAddress: string,
  maxAgeMs: number = 5 * 60 * 1000 // 5 minutes default
): SignatureVerification {
  const result = verifyWalletSignature(message, signature, expectedAddress)
  
  if (!result.isValid) {
    return result
  }

  // Extract timestamp from message
  const timestampMatch = message.match(/Timestamp: (\d+)/)
  if (!timestampMatch) {
    return {
      isValid: false,
      error: 'Message missing timestamp'
    }
  }

  const timestamp = parseInt(timestampMatch[1], 10)
  const age = Date.now() - timestamp

  if (age > maxAgeMs) {
    return {
      isValid: false,
      error: `Message expired (age: ${Math.floor(age / 1000)}s, max: ${Math.floor(maxAgeMs / 1000)}s)`
    }
  }

  if (age < 0) {
    return {
      isValid: false,
      error: 'Message timestamp is in the future'
    }
  }

  const nonceCheck = markNonceAsConsumed(message, expectedAddress.toLowerCase(), maxAgeMs)
  if (nonceCheck) {
    return nonceCheck
  }

  return result
}




