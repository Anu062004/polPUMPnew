import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

export async function GET(request: NextRequest) {
  try {
    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

    // Get recent battles
    const battles = await db.all(`
      SELECT 
        id,
        leftCoinId,
        rightCoinId,
        leftScore,
        rightScore,
        winnerCoinId,
        judge,
        createdAt
      FROM gaming_meme_royale
      ORDER BY createdAt DESC
      LIMIT 20
    `)

    // Enrich with coin details
    const enrichedBattles = await Promise.all(
      battles.map(async (battle: any) => {
        const [leftCoin, rightCoin, winnerCoin] = await Promise.all([
          db.get('SELECT * FROM coins WHERE id = ? OR tokenAddress = ?', [battle.leftCoinId, battle.leftCoinId]),
          db.get('SELECT * FROM coins WHERE id = ? OR tokenAddress = ?', [battle.rightCoinId, battle.rightCoinId]),
          battle.winnerCoinId
            ? db.get('SELECT * FROM coins WHERE id = ? OR tokenAddress = ?', [battle.winnerCoinId, battle.winnerCoinId])
            : null,
        ])

        return {
          id: battle.id,
          leftCoin: leftCoin || { id: battle.leftCoinId, name: 'Unknown', symbol: 'UNK' },
          rightCoin: rightCoin || { id: battle.rightCoinId, name: 'Unknown', symbol: 'UNK' },
          leftScore: battle.leftScore,
          rightScore: battle.rightScore,
          winnerCoinId: battle.winnerCoinId,
          winnerCoin: winnerCoin || null,
          judge: battle.judge,
          createdAt: battle.createdAt,
        }
      })
    )

    await db.close()

    return NextResponse.json({
      success: true,
      battles: enrichedBattles,
    })
  } catch (error: any) {
    console.error('Error fetching battles:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch battles' },
      { status: 500 }
    )
  }
}

