import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { sql } from '@vercel/postgres'
import { initializeSchema } from '../../../../lib/postgresManager'

// ERC20 ABI for balance checking
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

// MemeToken ABI (from bonding curve system)
const MEME_TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

// Get token balance for a user
async function getTokenBalance(
  provider: ethers.JsonRpcProvider,
  tokenAddress: string,
  userAddress: string
): Promise<string> {
  try {
    const token = new ethers.Contract(tokenAddress, ERC20_ABI, provider)
    const balance = await token.balanceOf(userAddress)
    const decimals = await token.decimals().catch(() => 18) // Default to 18 if decimals() fails
    return ethers.formatUnits(balance, decimals)
  } catch (error: any) {
    console.warn(`Failed to get balance for ${tokenAddress}:`, error.message)
    return '0'
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { address: string } }
) {
  try {
    const userAddress = params.address

    if (!userAddress || !ethers.isAddress(userAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid address' },
        { status: 400 }
      )
    }

    // Get RPC provider
    const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                   process.env.POLYGON_AMOY_RPC || 
                   'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
    
    const provider = new ethers.JsonRpcProvider(rpcUrl)

    // Initialize PostgreSQL schema if needed
    await initializeSchema()
    
    // Get all coins from PostgreSQL database
    const result = await sql`
      SELECT * FROM coins 
      WHERE token_address IS NOT NULL AND token_address != ''
      ORDER BY created_at DESC
      LIMIT 100
    `
    const coins = result.rows.map((coin: any) => ({
      ...coin,
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      supply: coin.supply,
      imageHash: coin.image_hash,
      tokenAddress: coin.token_address,
      curveAddress: coin.curve_address,
      txHash: coin.tx_hash,
      creator: coin.creator,
      createdAt: coin.created_at,
      description: coin.description
    }))

    // Fetch balances for all coins in parallel (with rate limiting)
    const userHoldings: any[] = []
    const coinsWithData: any[] = []

    // Process coins in batches to avoid rate limits
    const batchSize = 10
    for (let i = 0; i < coins.length; i += batchSize) {
      const batch = coins.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (coin: any) => {
          try {
            if (!coin.tokenAddress) return

            const balance = await getTokenBalance(provider, coin.tokenAddress, userAddress)
            const hasBalance = parseFloat(balance) > 0

            const coinData = {
              id: coin.id || coin.txHash,
              name: coin.name,
              symbol: coin.symbol,
              tokenAddress: coin.tokenAddress,
              curveAddress: coin.curveAddress || null,
              imageHash: coin.imageHash,
              description: coin.description,
              createdAt: coin.createdAt,
              creator: coin.creator,
              txHash: coin.txHash,
              supply: coin.supply
            }

            coinsWithData.push(coinData)

            // Add to user holdings if they have balance
            if (hasBalance) {
              userHoldings.push({
                ...coinData,
                balance,
                hasBalance: true
              })
            }
          } catch (error: any) {
            console.warn(`Error processing coin ${coin.id}:`, error.message)
            // Still add coin without balance
            coinsWithData.push({
              id: coin.id || coin.txHash,
              name: coin.name,
              symbol: coin.symbol,
              tokenAddress: coin.tokenAddress,
              curveAddress: coin.curveAddress || null,
              imageHash: coin.imageHash,
              description: coin.description,
              createdAt: coin.createdAt,
              creator: coin.creator,
              txHash: coin.txHash,
              supply: coin.supply
            })
          }
        })
      )

      // Small delay between batches to avoid rate limits
      if (i + batchSize < coins.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    // Also try to load from storage SDK as fallback
    try {
      const { ogStorageSDK } = await import('@/lib/0gStorageSDK')
      const storedCoins = await ogStorageSDK.getAllCoins()
      
      // Merge stored coins that aren't already in database.
      // Many legacy coins were stored without an explicit tokenAddress field,
      // using `id` as the token address instead. We handle both shapes here.
      for (const coin of storedCoins) {
        const rawTokenAddress =
          (coin as any).tokenAddress ||
          (typeof coin.id === 'string' &&
            coin.id.startsWith('0x') &&
            coin.id.length === 42
              ? coin.id
              : null)

        if (!rawTokenAddress) continue

        const tokenAddress = rawTokenAddress.toLowerCase()

        const exists = coinsWithData.find(
          (c) => c.tokenAddress?.toLowerCase() === tokenAddress
        )

        if (!exists) {
          try {
            const balance = await getTokenBalance(provider, tokenAddress, userAddress)
            const hasBalance = parseFloat(balance) > 0

            const coinData = {
              id: coin.id,
              name: coin.name,
              symbol: coin.symbol,
              tokenAddress,
              curveAddress: (coin as any).curveAddress || null,
              imageHash: coin.imageRootHash || coin.imageUrl,
              description: coin.description,
              createdAt: coin.createdAt,
              creator: coin.creator,
              txHash: coin.id,
              supply: coin.supply
            }

            coinsWithData.push(coinData)

            if (hasBalance) {
              userHoldings.push({
                ...coinData,
                balance,
                hasBalance: true
              })
            }
          } catch (error) {
            // Skip if error
          }
        }
      }
    } catch (error) {
      console.log('Storage SDK fallback failed:', error)
    }

    return NextResponse.json({
      success: true,
      coins: coinsWithData,
      userHoldings: userHoldings,
      totalCoins: coinsWithData.length,
      coinsWithBalance: userHoldings.length
    })

  } catch (error: any) {
    console.error('Error fetching gaming coins:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch coins',
        coins: [],
        userHoldings: [],
        totalCoins: 0,
        coinsWithBalance: 0
      },
      { status: 500 }
    )
  }
}

