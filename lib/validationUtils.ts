/**
 * Input validation utilities
 * Provides consistent validation across all API endpoints
 */

import { ethers } from 'ethers'

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Validate Ethereum address
 */
export function validateAddress(address: string): ValidationResult {
  if (!address || typeof address !== 'string') {
    return { isValid: false, error: 'Address is required' }
  }

  if (!ethers.isAddress(address)) {
    return { isValid: false, error: 'Invalid Ethereum address format' }
  }

  return { isValid: true }
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(
  value: any,
  fieldName: string = 'Amount',
  min: number = 0,
  max?: number
): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return { isValid: false, error: `${fieldName} is required` }
  }

  const num = typeof value === 'string' ? parseFloat(value) : Number(value)

  if (isNaN(num)) {
    return { isValid: false, error: `${fieldName} must be a number` }
  }

  if (num <= min) {
    return { isValid: false, error: `${fieldName} must be greater than ${min}` }
  }

  if (max !== undefined && num > max) {
    return { isValid: false, error: `${fieldName} must be less than or equal to ${max}` }
  }

  return { isValid: true }
}

/**
 * Validate integer
 */
export function validateInteger(
  value: any,
  fieldName: string = 'Value',
  min?: number,
  max?: number
): ValidationResult {
  const numResult = validatePositiveNumber(value, fieldName, min ?? 0, max)
  if (!numResult.isValid) {
    return numResult
  }

  const num = typeof value === 'string' ? parseInt(value, 10) : Number(value)
  if (!Number.isInteger(num)) {
    return { isValid: false, error: `${fieldName} must be an integer` }
  }

  return { isValid: true }
}

/**
 * Validate string (non-empty)
 */
export function validateString(
  value: any,
  fieldName: string = 'Field',
  minLength: number = 1,
  maxLength?: number
): ValidationResult {
  if (!value || typeof value !== 'string') {
    return { isValid: false, error: `${fieldName} is required` }
  }

  if (value.length < minLength) {
    return { isValid: false, error: `${fieldName} must be at least ${minLength} characters` }
  }

  if (maxLength !== undefined && value.length > maxLength) {
    return { isValid: false, error: `${fieldName} must be at most ${maxLength} characters` }
  }

  return { isValid: true }
}

/**
 * Validate transaction hash
 */
export function validateTxHash(txHash: string): ValidationResult {
  if (!txHash || typeof txHash !== 'string') {
    return { isValid: false, error: 'Transaction hash is required' }
  }

  if (!ethers.isHexString(txHash, 32)) {
    return { isValid: false, error: 'Invalid transaction hash format' }
  }

  return { isValid: true }
}

/**
 * Validate choice for coinflip (heads or tails)
 */
export function validateCoinflipChoice(choice: string): ValidationResult {
  if (!choice || typeof choice !== 'string') {
    return { isValid: false, error: 'Choice is required' }
  }

  const normalized = choice.toLowerCase()
  if (normalized !== 'heads' && normalized !== 'tails') {
    return { isValid: false, error: 'Choice must be "heads" or "tails"' }
  }

  return { isValid: true }
}

/**
 * Validate stake side for meme royale
 */
export function validateStakeSide(side: string): ValidationResult {
  if (!side || typeof side !== 'string') {
    return { isValid: false, error: 'Stake side is required' }
  }

  const normalized = side.toLowerCase()
  if (normalized !== 'left' && normalized !== 'right') {
    return { isValid: false, error: 'Stake side must be "left" or "right"' }
  }

  return { isValid: true }
}

/**
 * Validate game ID (positive integer)
 */
export function validateGameId(gameId: any): ValidationResult {
  return validateInteger(gameId, 'Game ID', 1)
}

/**
 * Validate round ID (positive integer)
 */
export function validateRoundId(roundId: any): ValidationResult {
  return validateInteger(roundId, 'Round ID', 1)
}

/**
 * Validate mines count (1-24 for 25 tile grid)
 */
export function validateMinesCount(count: any): ValidationResult {
  return validateInteger(count, 'Mines count', 1, 24)
}




