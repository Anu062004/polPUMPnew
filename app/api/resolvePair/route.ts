import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Resolve token and curve addresses from transaction hash
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { txHash, creator, factory } = body

    if (!txHash) {
      return NextResponse.json(
        { success: false, error: 'Missing txHash' },
        { status: 400 }
      )
    }

    // Try backend first if available
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const backendResponse = await fetch(`${backendBase}/resolvePair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash, creator, factory }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (backendResponse.ok) {
        const backendResult = await backendResponse.json()
        if (backendResult.success || backendResult.tokenAddress) {
          return NextResponse.json(backendResult)
        }
      }
    } catch (backendError: any) {
      console.log('Backend resolvePair not available, using direct RPC:', backendError?.message || backendError)
    }

    // Fallback: Try to resolve from RPC directly using proper ABI parsing
    try {
      const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'polygon'
      const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                     (isMainnet 
                       ? 'https://polygon-mainnet.infura.io/v3/2a16fc884a10441eae11c29cd9b9aa5f'
                       : 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f')
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      
      const receipt = await provider.getTransactionReceipt(txHash)
      if (!receipt) {
        return NextResponse.json({
          success: false,
          error: 'Transaction not found or not yet confirmed'
        })
      }

      // Factory ABI for parsing PairCreated event
      const FACTORY_ABI = [
        'event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens)'
      ]
      
      const iface = new ethers.Interface(FACTORY_ABI)
      const pairCreatedTopic = iface.getEvent('PairCreated')!.topicHash
      
      let tokenAddress: string | null = null
      let curveAddress: string | null = null

      // Look for PairCreated event in logs
      if (receipt.logs && receipt.logs.length > 0) {
        // Filter logs by factory address if provided
        const factoryAddress = factory?.toLowerCase()
        const relevantLogs = factoryAddress 
          ? receipt.logs.filter((log: any) => log.address?.toLowerCase() === factoryAddress)
          : receipt.logs
        
        for (const log of relevantLogs) {
          try {
            // Check if this log matches PairCreated event topic
            if (log.topics && log.topics[0] === pairCreatedTopic) {
              const parsed = iface.parseLog(log)
              if (parsed && parsed.name === 'PairCreated') {
                tokenAddress = parsed.args[0] // token address
                curveAddress = parsed.args[1] // curve address
                break // Found it, no need to continue
              }
            }
          } catch (e) {
            // Continue to next log if parsing fails
            continue
          }
        }
        
        // If not found, try parsing all logs as PairCreated
        if (!tokenAddress || !curveAddress) {
          for (const log of relevantLogs) {
            try {
              const parsed = iface.parseLog(log)
              if (parsed && parsed.name === 'PairCreated') {
                // Check if creator matches (if provided)
                if (!creator || parsed.args[2]?.toLowerCase() === creator.toLowerCase()) {
                  tokenAddress = parsed.args[0]
                  curveAddress = parsed.args[1]
                  break
                }
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        }
      }

      // If still not found, wait a bit and retry
      if (!tokenAddress || !curveAddress) {
        await new Promise(r => setTimeout(r, 3000))
        
        // Try querying logs directly from recent blocks
        try {
          const currentBlock = await provider.getBlockNumber()
          const fromBlock = currentBlock > 100 ? currentBlock - 100 : 0
          
          const logs = await provider.getLogs({
            fromBlock,
            toBlock: currentBlock,
            address: factory,
            topics: [pairCreatedTopic]
          })
          
          const wallet = creator?.toLowerCase()
          for (const log of logs) {
            try {
              const parsed = iface.parseLog(log)
              if (parsed && parsed.name === 'PairCreated') {
                // Match by creator if provided, otherwise take the most recent
                if (!wallet || parsed.args[2]?.toLowerCase() === wallet) {
                  tokenAddress = parsed.args[0]
                  curveAddress = parsed.args[1]
                  break
                }
              }
            } catch (e) {
              // Continue
            }
          }
        } catch (logError) {
          console.log('Log query failed:', logError)
        }
      }

      return NextResponse.json({
        success: true,
        tokenAddress: tokenAddress || null,
        curveAddress: curveAddress || null,
        txHash
      })

    } catch (rpcError: any) {
      console.error('RPC resolution failed:', rpcError)
      return NextResponse.json({
        success: false,
        error: 'Could not resolve addresses from transaction',
        tokenAddress: null,
        curveAddress: null
      })
    }

  } catch (error: any) {
    console.error('Resolve pair error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to resolve pair' 
      },
      { status: 500 }
    )
  }
}

