import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, betAmount, tokenAddress, minesCount, txHash } = body

    if (!userAddress || !betAmount || !tokenAddress || !minesCount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    try {
      await databaseManager.initialize()
    } catch (dbError: any) {
      console.error('Database initialization error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Database not available. Please try again later.' },
        { status: 503 }
      )
    }

    let db
    try {
      db = await databaseManager.getConnection()
    } catch (dbError: any) {
      console.error('Database connection error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Database connection failed. Please try again.' },
        { status: 503 }
      )
    }

    // Generate random mine positions (25 tiles, minesCount mines)
    const totalTiles = 25
    const minePositions: number[] = []
    while (minePositions.length < minesCount) {
      const pos = Math.floor(Math.random() * totalTiles)
      if (!minePositions.includes(pos)) {
        minePositions.push(pos)
      }
    }
    minePositions.sort((a, b) => a - b)

    // Ensure table exists
    try {
      await db.run(`
        CREATE TABLE IF NOT EXISTS gaming_mines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userAddress TEXT NOT NULL,
          betAmount REAL NOT NULL,
          tokenAddress TEXT NOT NULL,
          minesCount INTEGER NOT NULL,
          gridState TEXT NOT NULL,
          revealedTiles TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          currentMultiplier REAL NOT NULL DEFAULT 1.0,
          cashoutAmount REAL,
          createdAt INTEGER NOT NULL,
          completedAt INTEGER
        )
      `)
    } catch (tableError: any) {
      console.warn('Table creation warning (may already exist):', tableError.message)
    }

    // Create game session
    const result = await db.run(
      `INSERT INTO gaming_mines 
       (userAddress, betAmount, tokenAddress, minesCount, gridState, revealedTiles, status, currentMultiplier, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 1.0, ?)`,
      [
        userAddress.toLowerCase(),
        betAmount,
        tokenAddress,
        minesCount,
        JSON.stringify(Array(totalTiles).fill(null)), // Grid state
        JSON.stringify([]), // No tiles revealed yet
        Date.now(),
      ]
    )

    const gameId = (result as any).lastID

    // Store mine positions server-side (don't send to client)
    // We'll store them in gridState as a special format
    const gridState = Array(totalTiles).fill(null).map((_, i) => ({
      index: i,
      isMine: minePositions.includes(i),
      revealed: false,
    }))

    await db.run(
      'UPDATE gaming_mines SET gridState = ? WHERE id = ?',
      [JSON.stringify(gridState), gameId]
    )

    await db.close()

    return NextResponse.json({
      success: true,
      gameId,
      totalTiles,
      minesCount,
      // Don't send mine positions to client
    })
  } catch (error: any) {
    console.error('Error starting mines game:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to start game' },
      { status: 500 }
    )
  }
}

