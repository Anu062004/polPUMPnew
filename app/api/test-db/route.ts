import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { initializeSchema } from '@/lib/postgresManager'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const hasPostgresUrl = !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL)
    
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
      const result = await sql`
        SELECT COUNT(*) as count FROM coins
      `
      coinCount = parseInt(result.rows[0]?.count || '0')
      
      const coinsResult = await sql`
        SELECT id, name, symbol, token_address, created_at 
        FROM coins 
        ORDER BY created_at DESC 
        LIMIT 10
      `
      coins = coinsResult.rows
    } catch (dbError: any) {
      return NextResponse.json({
        success: false,
        error: dbError.message,
        hasPostgresUrl,
        envVars: {
          POSTGRES_URL: !!process.env.POSTGRES_URL,
          POSTGRES_PRISMA_URL: !!process.env.POSTGRES_PRISMA_URL,
          DATABASE_URL: !!process.env.DATABASE_URL,
        }
      }, { status: 500 })
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



