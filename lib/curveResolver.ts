import { ethers } from 'ethers'
import path from 'path'
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { CONTRACT_CONFIG } from './contract-config'

const RPC_URL =
  process.env.NEXT_PUBLIC_EVM_RPC ||
  process.env.POLYGON_AMOY_RPC ||
  'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'

const FACTORY_ABI = [
  'event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens)',
]

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

export interface CoinLike {
  id: string
  name?: string
  symbol?: string
  txHash?: string
}

export interface ResolvedAddresses {
  tokenAddress: string
  curveAddress: string
}

export async function resolveCoinAddresses(coin: CoinLike): Promise<ResolvedAddresses | null> {
  let resolved: ResolvedAddresses | null = null

  if (coin.txHash && coin.txHash.startsWith('0x')) {
    resolved = await resolveFromTxHash(coin.txHash)
  }

  if (!resolved && (coin.symbol || coin.name)) {
    resolved = await resolveFromMetadata(coin.symbol, coin.name)
  }

  return resolved
}

export async function updateCoinAddresses(
  coinId: string,
  tokenAddress: string,
  curveAddress: string,
  db?: sqlite3.Database
) {
  let localDb = db
  if (!localDb) {
    localDb = await open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    })
  }

  await localDb.run(
    'UPDATE coins SET tokenAddress = ?, curveAddress = ? WHERE id = ?',
    [tokenAddress.toLowerCase(), curveAddress.toLowerCase(), coinId]
  )

  if (!db) {
    await localDb.close()
  }
}

export async function openCoinsDb() {
  return await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  })
}

async function resolveFromTxHash(txHash: string): Promise<ResolvedAddresses | null> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const iface = new ethers.Interface(FACTORY_ABI)
    const pairTopic = iface.getEvent('PairCreated')!.topicHash
    const factoryAddress = (CONTRACT_CONFIG.FACTORY_ADDRESS || '').toLowerCase()

    const receipt = await provider.getTransactionReceipt(txHash)
    if (!receipt) return null

    const relevantLogs = receipt.logs?.filter((log: any) => {
      if (!factoryAddress) return true
      return log.address?.toLowerCase() === factoryAddress
    })

    const parsed = parsePairLogs(relevantLogs, iface, pairTopic)
    if (parsed) return parsed

    const blockNumber = receipt.blockNumber || 0
    const fromBlock = blockNumber > 25 ? blockNumber - 25 : 0
    const toBlock = blockNumber + 25

    const logs = await provider.getLogs({
      fromBlock,
      toBlock,
      address: factoryAddress || undefined,
      topics: [pairTopic],
    })

    return parsePairLogs(logs, iface, pairTopic)
  } catch (error) {
    console.warn('resolveFromTxHash failed', error)
    return null
  }
}

async function resolveFromMetadata(symbol?: string, name?: string): Promise<ResolvedAddresses | null> {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const iface = new ethers.Interface(FACTORY_ABI)
    const pairTopic = iface.getEvent('PairCreated')!.topicHash
    const factoryAddress = (CONTRACT_CONFIG.FACTORY_ADDRESS || '').toLowerCase()
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = currentBlock > 500000 ? currentBlock - 500000 : 0

    const logs = await provider.getLogs({
      fromBlock,
      toBlock: currentBlock,
      address: factoryAddress || undefined,
      topics: [pairTopic],
    })

    if (!logs.length) return null

    const normalizedSymbol = symbol?.toLowerCase()
    const normalizedName = name?.toLowerCase()
    for (let i = logs.length - 1; i >= 0; i--) {
      try {
        const decoded = iface.parseLog(logs[i])
        if (!decoded || decoded.name !== 'PairCreated') continue
        const eventSymbol = (decoded.args[4] as string)?.toLowerCase()
        const eventName = (decoded.args[3] as string)?.toLowerCase()
        const symbolMatches = normalizedSymbol && eventSymbol === normalizedSymbol
        const nameMatches = normalizedName && eventName === normalizedName
        if (symbolMatches || nameMatches) {
          return {
            tokenAddress: decoded.args[0]?.toLowerCase(),
            curveAddress: decoded.args[1]?.toLowerCase(),
          }
        }
      } catch {
        continue
      }
    }
  } catch (error) {
    console.warn('resolveFromSymbol failed', error)
  }
  return null
}

function parsePairLogs(logs: any[] = [], iface: ethers.Interface, topic: string) {
  if (!logs?.length) return null
  for (const log of logs) {
    try {
      if (log.topics?.[0] !== topic) continue
      const decoded = iface.parseLog(log)
      if (decoded?.name === 'PairCreated') {
        return {
          tokenAddress: decoded.args[0]?.toLowerCase(),
          curveAddress: decoded.args[1]?.toLowerCase(),
        }
      }
    } catch {
      continue
    }
  }
  return null
}

