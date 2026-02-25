import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'
import { resolveCoinAddresses, updateCoinAddresses as saveCurveAddresses } from '../../../../lib/curveResolver'
import { getSql, initializeSchema } from '../../../../lib/postgresManager'

const RPC_URL =
  process.env.NEXT_PUBLIC_EVM_RPC ||
  process.env.RPC_URL ||
  'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'

async function getFromDB(id: string) {
  try {
    await initializeSchema()
    const sql = await getSql()
    if (!sql) return null

    const normalizedId = id.toLowerCase().startsWith('0x') ? id.toLowerCase() : id
    const result = await sql`
      SELECT *
      FROM coins
      WHERE id = ${id}
         OR LOWER(token_address) = LOWER(${normalizedId})
         OR LOWER(symbol) = LOWER(${id})
      LIMIT 1
    `
    const rows = Array.isArray(result) ? result : (result as any).rows || []
    const token = rows[0]
    if (!token) return null

    return {
      id: token.id,
      address: token.token_address,
      curveAddress: token.curve_address,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals || 18,
      supply: token.supply,
      description: token.description,
      imageHash: token.image_hash,
      creator: token.creator,
      createdAt: token.created_at,
      txHash: token.tx_hash,
      telegramUrl: token.telegram_url,
      xUrl: token.x_url,
      discordUrl: token.discord_url,
      websiteUrl: token.website_url,
      source: 'database',
    }
  } catch (error) {
    console.error('Database lookup error:', error)
    return null
  }
}

async function getOnChain(id: string) {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const code = await provider.getCode(id)
    if (code === '0x' || code === '0x0') return null

    const baseAbi = [
      'function name() view returns (string)',
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
    ]

    const optionalAbi = [
      'function creator() view returns (address)',
      'function createdAt() view returns (uint256)',
      'function description() view returns (string)',
      'function imageRootHash() view returns (bytes32)',
      'function metadataRootHash() view returns (bytes32)',
    ]

    const contract = new ethers.Contract(id, [...baseAbi, ...optionalAbi], provider)

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
    } catch {}

    try {
      symbol = await contract.symbol()
    } catch {
      symbol = name.substring(0, 10).toUpperCase().replace(/[^A-Z0-9]/g, '') || 'TOKEN'
    }

    try {
      decimals = Number(await contract.decimals())
    } catch {
      decimals = 18
    }

    try {
      totalSupply = await contract.totalSupply()
    } catch {
      totalSupply = ethers.parseEther('0')
    }

    try {
      creator = await contract.creator()
    } catch {}

    try {
      const ca = await contract.createdAt()
      createdAt = Number(ca) * 1000
    } catch {}

    try {
      description = await contract.description()
    } catch {}

    try {
      imageHash = await contract.imageRootHash()
    } catch {}

    return {
      address: id,
      name,
      symbol,
      decimals,
      supply: ethers.formatUnits(totalSupply, decimals),
      description: description || `${name} (${symbol}) - On-chain token`,
      creator: creator || null,
      createdAt: createdAt ? new Date(createdAt).toISOString() : new Date().toISOString(),
      imageHash: imageHash || null,
      source: 'blockchain',
    }
  } catch (error: any) {
    console.error('On-chain lookup error:', error?.message || error)
    return null
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  try {
    let normalizedId = id
    if (/^0x[a-fA-F0-9]{40}$/i.test(id)) {
      try {
        normalizedId = ethers.getAddress(id)
      } catch {
        normalizedId = id.toLowerCase()
      }
    }

    const dbResult = await getFromDB(normalizedId)
    if (dbResult) {
      const patchedResult = await maybeBackfillAddresses(dbResult)
      return NextResponse.json({ found: true, data: patchedResult })
    }

    if (/^0x[a-fA-F0-9]{40}$/i.test(normalizedId)) {
      const chainData = await getOnChain(normalizedId)
      if (chainData) {
        return NextResponse.json({ found: true, data: chainData })
      }
    }

    return NextResponse.json(
      {
        found: false,
        message: 'Token not found in database or on blockchain',
        address: normalizedId,
      },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('Token lookup error:', error)
    return NextResponse.json(
      {
        found: false,
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
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
        curveAddress: resolved.curveAddress,
      }
    }
  } catch (error) {
    console.warn('Curve backfill failed for', token?.id, error)
  }

  return token
}
