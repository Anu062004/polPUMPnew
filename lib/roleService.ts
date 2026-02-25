/**
 * Role Assignment + Role Lock Service
 *
 * Initial role can be derived from ERC-20 balance, but once assigned it is
 * persisted and locked per wallet.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from './contract-config'
import { getDb } from './postgresManager'
import { upsertCreatorWallet } from './creatorService'

export type Role = 'TRADER' | 'CREATOR'

const ROLE_LOCK_FILE = path.join(process.cwd(), 'data', 'wallet-roles.json')

function isRole(value: any): value is Role {
  return value === 'TRADER' || value === 'CREATOR'
}

function normalizeWallet(walletAddress: string): string {
  return walletAddress.toLowerCase()
}

// Configuration: minimum token balance for initial CREATOR assignment
export const CREATOR_MIN_TOKEN_BALANCE = process.env.CREATOR_MIN_TOKEN_BALANCE
  ? BigInt(process.env.CREATOR_MIN_TOKEN_BALANCE)
  : BigInt('1000000000000000000')

// ERC-20 token address used for initial role assignment
export const ROLE_TOKEN_ADDRESS = process.env.ROLE_TOKEN_ADDRESS || ''

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
] as const

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
 * Assign initial role (used only when no wallet lock exists).
 */
export async function assignRole(
  walletAddress: string,
  provider?: ethers.Provider
): Promise<Role> {
  if (!ROLE_TOKEN_ADDRESS || !ethers.isAddress(ROLE_TOKEN_ADDRESS)) {
    console.warn('ROLE_TOKEN_ADDRESS not configured. Defaulting initial role to TRADER.')
    return 'TRADER'
  }

  try {
    const rpcProvider = provider || new ethers.JsonRpcProvider(CONTRACT_CONFIG.RPC_URL)
    const balance = await getTokenBalance(
      rpcProvider,
      ROLE_TOKEN_ADDRESS,
      walletAddress
    )

    return balance >= CREATOR_MIN_TOKEN_BALANCE ? 'CREATOR' : 'TRADER'
  } catch (error: any) {
    console.error('Error assigning initial role:', error)
    return 'TRADER'
  }
}

async function ensureUsersTable() {
  const db = await getDb()

  if (db.type === 'pg') {
    await db.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        wallet VARCHAR(255) PRIMARY KEY,
        role VARCHAR(20) NOT NULL DEFAULT 'TRADER' CHECK (role IN ('TRADER','CREATOR')),
        last_role_check BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
        updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
      )
    `)
    await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet);`)
    await db.pool.query(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);`)
  }

  return db
}

async function getRoleFromDatabase(walletAddress: string): Promise<Role | null> {
  try {
    const wallet = normalizeWallet(walletAddress)
    const db = await ensureUsersTable()

    if (db.type === 'pg') {
      const result = await db.pool.query(
        'SELECT role FROM users WHERE wallet = $1 LIMIT 1',
        [wallet]
      )
      const role = result.rows?.[0]?.role
      return isRole(role) ? role : null
    }

    return null
  } catch (error: any) {
    console.warn('Failed to read locked role from database:', error?.message || error)
    return null
  }
}

async function saveRoleToDatabase(walletAddress: string, role: Role): Promise<boolean> {
  try {
    const wallet = normalizeWallet(walletAddress)
    const db = await ensureUsersTable()

    if (db.type === 'pg') {
      const now = Date.now()
      await db.pool.query(
        `INSERT INTO users (wallet, role, last_role_check, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (wallet)
         DO UPDATE SET role = users.role, last_role_check = $3, updated_at = $5`,
        [wallet, role, now, now, now]
      )
      return true
    }

    return false
  } catch (error: any) {
    console.warn('Failed to persist locked role in database:', error?.message || error)
    return false
  }
}

async function readRoleFile(): Promise<Record<string, Role>> {
  try {
    const raw = await fs.readFile(ROLE_LOCK_FILE, 'utf-8')
    const parsed = JSON.parse(raw) as Record<string, string>
    const cleaned: Record<string, Role> = {}
    for (const [wallet, role] of Object.entries(parsed)) {
      if (isRole(role)) cleaned[wallet.toLowerCase()] = role
    }
    return cleaned
  } catch {
    return {}
  }
}

async function saveRoleToFile(walletAddress: string, role: Role): Promise<boolean> {
  try {
    const wallet = normalizeWallet(walletAddress)
    const dir = path.dirname(ROLE_LOCK_FILE)
    await fs.mkdir(dir, { recursive: true })

    const roles = await readRoleFile()
    if (!roles[wallet]) {
      roles[wallet] = role
      await fs.writeFile(ROLE_LOCK_FILE, JSON.stringify(roles, null, 2), 'utf-8')
    }
    return true
  } catch (error: any) {
    console.warn('Failed to persist locked role in file fallback:', error?.message || error)
    return false
  }
}

async function getRoleFromFile(walletAddress: string): Promise<Role | null> {
  const wallet = normalizeWallet(walletAddress)
  const roles = await readRoleFile()
  const role = roles[wallet]
  return role && isRole(role) ? role : null
}

async function persistLockedRole(walletAddress: string, role: Role): Promise<boolean> {
  const dbSaved = await saveRoleToDatabase(walletAddress, role)
  const fileSaved = dbSaved ? true : await saveRoleToFile(walletAddress, role)

  if (fileSaved && role === 'CREATOR') {
    try {
      await upsertCreatorWallet(walletAddress)
    } catch (error: any) {
      console.warn('Failed to upsert creator wallet after role lock:', error?.message || error)
    }
  }

  return fileSaved
}

/**
 * Get locked role for a wallet (if already assigned).
 */
export async function getLockedRole(walletAddress: string): Promise<Role | null> {
  const dbRole = await getRoleFromDatabase(walletAddress)
  if (dbRole) return dbRole
  return getRoleFromFile(walletAddress)
}

/**
 * Get locked role, assigning and persisting one when missing.
 */
export async function getOrAssignLockedRole(
  walletAddress: string,
  provider?: ethers.Provider,
  preferredRole?: Role
): Promise<Role> {
  const existingRole = await getLockedRole(walletAddress)
  if (existingRole) {
    if (existingRole === 'CREATOR') {
      try {
        await upsertCreatorWallet(walletAddress)
      } catch {
        // Ignore non-blocking creator upsert errors.
      }
    }
    return existingRole
  }

  const initialRole =
    preferredRole && isRole(preferredRole)
      ? preferredRole
      : await assignRole(walletAddress, provider)
  await persistLockedRole(walletAddress, initialRole)
  const confirmedRole = await getLockedRole(walletAddress)
  return confirmedRole || initialRole
}

/**
 * Resolve locked role for an existing session payload. If no lock exists,
 * persist the payload role to keep wallet role stable.
 */
export async function resolveLockedRole(
  walletAddress: string,
  sessionRole: Role,
  provider?: ethers.Provider
): Promise<Role> {
  const existingRole = await getLockedRole(walletAddress)
  if (existingRole) {
    if (existingRole === 'CREATOR') {
      try {
        await upsertCreatorWallet(walletAddress)
      } catch {
        // Ignore non-blocking creator upsert errors.
      }
    }
    return existingRole
  }

  const persisted = await persistLockedRole(walletAddress, sessionRole)
  if (persisted) {
    const confirmedRole = await getLockedRole(walletAddress)
    return confirmedRole || sessionRole
  }

  // Last fallback: derive and return an initial role.
  return getOrAssignLockedRole(walletAddress, provider)
}

export async function isCreator(
  walletAddress: string,
  provider?: ethers.Provider
): Promise<boolean> {
  const role = await getOrAssignLockedRole(walletAddress, provider)
  return role === 'CREATOR'
}

/**
 * Revalidate role against wallet lock.
 */
export async function revalidateRole(
  walletAddress: string,
  currentRole: Role,
  provider?: ethers.Provider
): Promise<{ role: Role; changed: boolean }> {
  const lockedRole = await resolveLockedRole(walletAddress, currentRole, provider)
  return {
    role: lockedRole,
    changed: lockedRole !== currentRole,
  }
}
