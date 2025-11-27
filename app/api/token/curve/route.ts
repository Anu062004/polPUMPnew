import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { CONTRACT_CONFIG } from '../../../../lib/contract-config'

// Minimal ABIs
const FACTORY_ABI = [
  'function tokenToCurve(address token) external view returns (address)',
  'event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens)'
]

// MemeToken ABI – used to discover the bonding curve from the token itself
// Any MemeToken created by our factories has a `minter` which is the bonding curve.
const MEME_TOKEN_ABI = ['function minter() external view returns (address)']

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tokenAddress = searchParams.get('tokenAddress')

    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      return NextResponse.json(
        { success: false, error: 'Invalid token address' },
        { status: 400 }
      )
    }

    const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                   'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const factoryAddress = CONTRACT_CONFIG.FACTORY_ADDRESS

    // 1) Fast path: ask the token itself for its bonding curve (minter)
    try {
      const token = new ethers.Contract(tokenAddress, MEME_TOKEN_ABI, provider)
      const minter = await token.minter()
      if (minter && minter !== ethers.ZeroAddress) {
        // Optionally verify this looks like a BondingCurve by checking for `seeded()`
        try {
          const curveProbe = new ethers.Contract(
            minter,
            ['function seeded() view returns (bool)'],
            provider
          )
          await curveProbe.seeded()
        } catch {
          // If the call fails we still return the address; frontend can handle errors on use.
        }

        return NextResponse.json({
          success: true,
          tokenAddress: tokenAddress.toLowerCase(),
          curveAddress: minter.toLowerCase(),
        })
      }
    } catch (e) {
      console.log('Token minter lookup failed, falling back to factory logs...', e)
    }

    // 2) Fallback: ask EnhancedFactory mapping (if present)
    try {
      const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider)
      const curveAddress = await factory.tokenToCurve(tokenAddress)

      if (curveAddress && curveAddress !== ethers.ZeroAddress) {
        return NextResponse.json({
          success: true,
          tokenAddress: tokenAddress.toLowerCase(),
          curveAddress: curveAddress.toLowerCase(),
        })
      }
    } catch (e) {
      // Factory might not have this function (simple Factory), continue to event search
      console.log('Factory mapping not available, searching events...')
    }

    // 3) Last resort: search PairCreated events from the factory
    const factory = new ethers.Contract(factoryAddress, FACTORY_ABI, provider)
    const iface = new ethers.Interface(FACTORY_ABI)
    const topic0 = iface.getEvent('PairCreated').topicHash
    
    // Search recent blocks (last 50k blocks ~7 days on Polygon)
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 50000)
    
    const logs = await provider.getLogs({
      fromBlock,
      toBlock: currentBlock,
      address: factoryAddress,
      topics: [topic0],
    })

    // Find the event for this token
    for (const log of logs) {
      try {
        const parsed = iface.parseLog(log)
        if (parsed && parsed.name === 'PairCreated') {
          const eventToken = parsed.args[0].toLowerCase()
          const eventCurve = parsed.args[1]
          
          if (eventToken === tokenAddress.toLowerCase()) {
            return NextResponse.json({
              success: true,
              tokenAddress: tokenAddress.toLowerCase(),
              curveAddress: eventCurve.toLowerCase(),
            })
          }
        }
      } catch (e) {
        // Skip invalid logs
        continue
      }
    }

    // Not found
    return NextResponse.json({
      success: false,
      error: 'Curve address not found for this token',
    }, { status: 404 })

  } catch (error: any) {
    console.error('Error resolving curve address:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to resolve curve address' },
      { status: 500 }
    )
  }
}

