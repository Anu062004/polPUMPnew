import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

// Force dynamic rendering to prevent build-time execution
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')

    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

    const recent = await db.all(`
      SELECT 
        id,
        userAddress,
        wager,
        outcome,
        blockNumber,
        blockHash,
        createdAt
      FROM gaming_coinflip
      ORDER BY createdAt DESC
      LIMIT ?
    `, [limit])

    await db.close()

    return NextResponse.json({
      success: true,
      recent: recent.map((game: any) => ({
        id: game.id,
        userAddress: game.userAddress,
        wager: game.wager,
        outcome: game.outcome,
        won: game.outcome === 'win',
        blockNumber: game.blockNumber,
        blockHash: game.blockHash,
        createdAt: game.createdAt,
      })),
    })
  } catch (error: any) {
    console.error('Error fetching recent games:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch recent games' },
      { status: 500 }
    )
  }
}

