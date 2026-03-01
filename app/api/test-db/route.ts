import { NextRequest, NextResponse } from 'next/server'
import { initializeSchema, getSql, isUsingVercelPostgres } from '@/lib/postgresManager'
import { promises as fs } from 'fs'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'

export const dynamic = 'force-dynamic'

function getSqlitePath() {
  const explicitPath = String(process.env.COINS_SQLITE_PATH || '').trim()
  if (explicitPath) {
    return path.isAbsolute(explicitPath)
      ? explicitPath
      : path.join(process.cwd(), explicitPath)
  }

  const isServerless =
    process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME

  return isServerless
    ? '/tmp/data/coins.db'
    : path.join(process.cwd(), 'data', 'coins.db')
}

async function getSqliteSnapshot(limit = 10) {
  const sqlitePath = getSqlitePath()
  await fs.access(sqlitePath)

  const db = await open({
    filename: sqlitePath,
    driver: sqlite3.Database,
  })

  try {
    const countRow = await db.get<{ count: number }>('SELECT COUNT(*) as count FROM coins')
    const rows = await db.all<any[]>(
      `SELECT id, name, symbol, tokenAddress, createdAt
       FROM coins
       ORDER BY createdAt DESC
       LIMIT ?`,
      limit
    )

    return {
      sqlitePath,
      coinCount: Number(countRow?.count || 0),
      coins: rows,
    }
  } finally {
    await db.close()
  }
}

export async function GET(request: NextRequest) {
  try {
    // True only when at least one valid PostgreSQL URL is present.
    const hasPostgresUrl = isUsingVercelPostgres()
    
    // Initialize schema
    try {
      await initializeSchema()
    } catch (schemaError: any) {
      console.warn('Schema init warning:', schemaError.message)
    }
    
    // Test query
    let coinCount = 0
    let coins: any[] = []
    
    try {
      const sqlClient = await getSql()
      if (!sqlClient) {
        throw new Error('PostgreSQL client unavailable (check POSTGRES_* / DATABASE_URL)')
      }

      const result = await sqlClient`
        SELECT COUNT(*) as count FROM coins
      `
      coinCount = parseInt(result.rows[0]?.count || '0')
      
      const coinsResult = await sqlClient`
        SELECT id, name, symbol, token_address, created_at 
        FROM coins 
        ORDER BY created_at DESC 
        LIMIT 10
      `
      coins = coinsResult.rows
    } catch (dbError: any) {
      try {
        const sqlite = await getSqliteSnapshot(10)
        return NextResponse.json({
          success: true,
          mode: 'sqlite-fallback',
          error: dbError.message,
          hasPostgresUrl,
          sqlitePath: sqlite.sqlitePath,
          coinCount: sqlite.coinCount,
          coins: sqlite.coins.map((c: any) => ({
            id: c.id,
            name: c.name,
            symbol: c.symbol,
            tokenAddress: c.tokenAddress,
            createdAt: c.createdAt,
          })),
          envVars: {
            POSTGRES_URL: !!process.env.POSTGRES_URL,
            POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
            DATABASE_URL: !!process.env.DATABASE_URL,
            COINS_SQLITE_PATH: !!process.env.COINS_SQLITE_PATH,
            ENABLE_SQLITE_FALLBACK: process.env.ENABLE_SQLITE_FALLBACK || null,
          }
        })
      } catch (sqliteError: any) {
        return NextResponse.json({
          success: false,
          error: dbError.message,
          fallbackError: sqliteError?.message || 'SQLite fallback failed',
          hasPostgresUrl,
          envVars: {
            POSTGRES_URL: !!process.env.POSTGRES_URL,
            POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
            DATABASE_URL: !!process.env.DATABASE_URL,
          }
        }, { status: 500 })
      }
    }
    
    return NextResponse.json({
      success: true,
      hasPostgresUrl,
      coinCount,
      coins: coins.map(c => ({
        id: c.id,
        name: c.name,
        symbol: c.symbol,
        tokenAddress: c.token_address,
        createdAt: c.created_at
      })),
      envVars: {
        POSTGRES_URL: !!process.env.POSTGRES_URL,
        POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
        DATABASE_URL: !!process.env.DATABASE_URL,
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
