import { NextRequest, NextResponse } from 'next/server'
import { databaseManager } from '../../../../../lib/databaseManager'
import { ethers } from 'ethers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userAddress, wager, choice } = body // choice: 'heads' or 'tails'

    if (!userAddress || !wager) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await databaseManager.initialize()
    const db = await databaseManager.getConnection()

    // Get a recent block for randomness
    const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    
    let blockNumber: number | null = null
    let blockHash: string | null = null
    
    try {
      const block = await provider.getBlock('latest')
      blockNumber = block?.number || null
      blockHash = block?.hash || null
    } catch (e) {
      console.warn('Failed to get block for randomness:', e)
    }

    // Generate outcome (heads = 0, tails = 1)
    // Use block hash if available, otherwise random
    let outcome: 'heads' | 'tails'
    if (blockHash) {
      // Use last bit of block hash
      const lastByte = parseInt(blockHash.slice(-2), 16)
      outcome = lastByte % 2 === 0 ? 'heads' : 'tails'
    } else {
      outcome = Math.random() < 0.5 ? 'heads' : 'tails'
    }

    const userWon = choice === outcome

    // Record the game
    const seedHash = blockHash || ethers.id(`${userAddress}-${Date.now()}`)
    const seedReveal = blockHash || seedHash

    await db.run(
      `INSERT INTO gaming_coinflip 
       (userAddress, wager, outcome, seedHash, seedReveal, blockNumber, blockHash, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userAddress.toLowerCase(),
        wager,
        userWon ? 'win' : 'lose',
        seedHash,
        seedReveal,
        blockNumber,
        blockHash,
        Date.now(),
      ]
    )

    await db.close()

    return NextResponse.json({
      success: true,
      outcome,
      userChoice: choice,
      won: userWon,
      blockNumber,
      blockHash,
    })
  } catch (error: any) {
    console.error('Error playing coinflip:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to play coinflip' },
      { status: 500 }
    )
  }
}

