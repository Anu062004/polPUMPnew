/**
 * Database utility for PostgreSQL
 * Provides a unified interface for database operations
 */

import { sql } from '@vercel/postgres'
import { Pool } from 'pg'
import { initializeSchema } from './postgresManager'

// Check if using Vercel Postgres
const isVercelPostgres = !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL)

// Standard pg Pool for local development
let pool: Pool | null = null

/**
 * Get database connection
 */
async function getDb() {
  if (isVercelPostgres) {
    return { type: 'vercel' as const, sql }
  }

  if (!pool) {
    const connectionString = process.env.DATABASE_URL || 
                             process.env.POSTGRES_URL ||
                             'postgresql://localhost:5432/polpump'
    
    pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }

  return { type: 'pg' as const, pool }
}

/**
 * Execute a query and return rows
 * Note: For Vercel Postgres, use getSql() template tag directly for better type safety
 */
export async function query<T = any>(text: string, params?: any[]): Promise<T[]> {
  const db = await getDb()
  
  if (db.type === 'vercel') {
    // @vercel/postgres doesn't support parameterized queries directly
    // We need to use a workaround or use template literals
    // For now, we'll use the underlying pg client if available
    throw new Error('For Vercel Postgres, use getSql() template tag. Example: await sql`SELECT * FROM coins`')
  } else {
    const result = await db.pool.query(text, params || [])
    return result.rows as T[]
  }
}

/**
 * Execute a query and return a single row
 */
export async function queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(text, params)
  return rows[0] || null
}

/**
 * Execute an INSERT/UPDATE/DELETE query
 */
export async function execute(text: string, params?: any[]): Promise<{ rowCount: number }> {
  const db = await getDb()
  
  if (db.type === 'vercel') {
    throw new Error('For Vercel Postgres, use getSql() template tag. Example: await sql`INSERT INTO coins ...`')
  } else {
    const result = await db.pool.query(text, params || [])
    return { rowCount: result.rowCount || 0 }
  }
}

/**
 * Get the sql template tag for Vercel Postgres
 */
export function getSql() {
  return sql
}

/**
 * Initialize database schema
 */
export async function initSchema() {
  return await initializeSchema()
}

/**
 * Close database connection
 */
export async function close() {
  if (pool) {
    await pool.end()
    pool = null
  }
}

