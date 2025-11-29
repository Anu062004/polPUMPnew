import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { resolveCoinAddresses, updateCoinAddresses as saveCurveAddresses } from '../../../../lib/curveResolver'

const RPC_URL = process.env.NEXT_PUBLIC_EVM_RPC || process.env.RPC_URL || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'

// Helper function to get database path (handles serverless environments)
function getDbPath() {
  const isServerless = process.env.VERCEL === '1' || 
                      process.env.AWS_LAMBDA_FUNCTION_NAME || 
                      process.env.NEXT_RUNTIME === 'nodejs'
  
  if (isServerless) {
    return '/tmp/data/coins.db'
  }
  return path.join(process.cwd(), 'data', 'coins.db')
}

const DB_PATH = getDbPath()

// Get token from database
async function getFromDB(id: string) {
  try {
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    })

    // Normalize the search ID (handle case-insensitive address matching)
    const normalizedId = id.toLowerCase().startsWith('0x') ? id.toLowerCase() : id

    // Try to find by ID, token address (case-insensitive), or symbol
    const token = await db.get(
      `SELECT * FROM coins 
       WHERE id = ? 
          OR LOWER(tokenAddress) = LOWER(?)
          OR LOWER(symbol) = LOWER(?)
       LIMIT 1`,
      [id, normalizedId, id]
    )

    await db.close()

    if (token) {
      console.log('✅ Found token in database:', token.name)
      return {
        id: token.id,
        address: token.tokenAddress,
        curveAddress: token.curveAddress,
        name: token.name,
        symbol: token.symbol,
        decimals: 18, // Default for ERC20
        supply: token.supply,
        description: token.description,
        imageHash: token.imageHash,
        creator: token.creator,
        createdAt: token.createdAt,
        txHash: token.txHash,
        telegramUrl: token.telegramUrl,
        xUrl: token.xUrl,
        discordUrl: token.discordUrl,
        websiteUrl: token.websiteUrl,
        source: 'database'
      }
    }

    return null
  } catch (error) {
    console.error('Database lookup error:', error)
    return null
  }
}

// Get token from blockchain
async function getOnChain(id: string) {
  try {
    console.log('🔗 Attempting on-chain lookup for:', id)
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    
    // Check if address is a contract
    const code = await provider.getCode(id)
    if (code === '0x' || code === '0x0') {
      console.log('❌ Address is not a contract')
      return null
    }
    
    const baseAbi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)'
    ]
    
    // Optional metadata functions (for OGToken contracts)
    const optionalAbi = [
      'function creator() view returns (address)',
      'function createdAt() view returns (uint256)',
      'function description() view returns (string)',
      'function imageRootHash() view returns (bytes32)',
      'function metadataRootHash() view returns (bytes32)'
    ]
    
    const contract = new ethers.Contract(id, [...baseAbi, ...optionalAbi], provider)
    
    // Try to get basic ERC20 info with individual error handling
    let name = 'Unknown Token'
    let symbol = 'UNKNOWN'
    let decimals = 18
    let totalSupply = ethers.parseEther('0')
    let creator: string | null = null
    let createdAt: number | null = null
    let description: string | null = null
    let imageHash: string | null = null
    
    try {
      name = await contract.name()
    } catch (e: any) {
      console.warn('Failed to get name:', e.message)
    }
    
    try {
      symbol = await contract.symbol()
    } catch (e: any) {
      console.warn('Failed to get symbol:', e.message)
      // If symbol fails, try to derive from name
      symbol = name.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TOKEN'
    }
    
    try {
      decimals = Number(await contract.decimals())
    } catch (e: any) {
      console.warn('Failed to get decimals, using default 18:', e.message)
      decimals = 18
    }
    
    try {
      totalSupply = await contract.totalSupply()
    } catch (e: any) {
      console.warn('Failed to get totalSupply:', e.message)
      totalSupply = ethers.parseEther('0')
    }
    
    // Try optional metadata functions
    try {
      creator = await contract.creator()
    } catch (e: any) {
      // Not available, that's okay
    }
    
    try {
      const ca = await contract.createdAt()
      createdAt = Number(ca) * 1000 // Convert to milliseconds
    } catch (e: any) {
      // Not available, that's okay
    }
    
    try {
      description = await contract.description()
    } catch (e: any) {
      // Not available, that's okay
    }
    
    try {
      const ih = await contract.imageRootHash()
      imageHash = ih
    } catch (e: any) {
      // Not available, that's okay
    }

    console.log('✅ Found token on-chain:', name)
    
    return {
      address: id,
      name,
      symbol,
      decimals: Number(decimals),
      supply: ethers.formatUnits(totalSupply, decimals),
      description: description || `${name} (${symbol}) - On-chain token`,
      creator: creator || null,
      createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
      imageHash: imageHash || null,
      source: 'blockchain'
    }
  } catch (error: any) {
    console.error('On-chain lookup error:', error.message)
    // Don't return null immediately - try to get at least basic info
    // Check if it's a network error vs contract error
    if (error.message?.includes('network') || error.message?.includes('timeout')) {
      console.error('Network error during on-chain lookup')
    }
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  console.log('🔍 Token lookup request for:', id)

  try {
    // Normalize address if it's an Ethereum address (lowercase for consistency)
    let normalizedId = id
    if (/^0x[a-fA-F0-9]{40}$/i.test(id)) {
      // Normalize to checksum format if possible, otherwise lowercase
      try {
        normalizedId = ethers.getAddress(id)
      } catch {
        normalizedId = id.toLowerCase()
      }
    }

    // First, try database lookup
    const dbResult = await getFromDB(normalizedId)
    if (dbResult) {
      const patchedResult = await maybeBackfillAddresses(dbResult)
      return NextResponse.json({ 
        found: true, 
        data: patchedResult 
      })
    }

    // If it looks like an Ethereum address, try on-chain lookup
    if (/^0x[a-fA-F0-9]{40}$/i.test(normalizedId)) {
      console.log('🔗 Attempting on-chain lookup for address:', normalizedId)
      const chainData = await getOnChain(normalizedId)
      if (chainData) {
        // If we found it on-chain but not in DB, we can optionally save it
        // For now, just return it
        return NextResponse.json({ 
          found: true, 
          data: chainData 
        })
      } else {
        console.log('❌ On-chain lookup failed for:', normalizedId)
      }
    }

    // Token not found anywhere
    console.log('❌ Token not found:', normalizedId)
    return NextResponse.json(
      { 
        found: false, 
        message: 'Token not found in database or on blockchain',
        address: normalizedId
      },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('❌ Token lookup error:', error)
    return NextResponse.json(
      { 
        found: false, 
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

async function maybeBackfillAddresses(token: any) {
  if (token?.address && token?.curveAddress) {
    return token
  }

  const resolved = await resolveCoinAddresses({
    id: token.id,
    name: token.name,
    symbol: token.symbol,
    txHash: token.txHash,
  })

  try {
    if (resolved?.tokenAddress && resolved?.curveAddress) {
      await saveCurveAddresses(token.id, resolved.tokenAddress, resolved.curveAddress)
      return {
        ...token,
        address: resolved.tokenAddress,
        curveAddress: resolved.curveAddress
      }
    }
  } catch (error) {
    console.warn('Curve backfill failed for', token?.id, error)
  }

  return token
}

async function updateCoinAddresses(id: string, tokenAddress: string, curveAddress: string) {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  })

  await db.run(
    'UPDATE coins SET tokenAddress = ?, curveAddress = ? WHERE id = ?',
    [tokenAddress, curveAddress, id]
  )

  await db.close()
}
