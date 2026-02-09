import { ethers, BrowserProvider, Contract, formatEther, parseEther, formatUnits } from 'ethers'

// ABI for the new Factory contract
const FACTORY_ABI = [
  'function treasury() view returns (address)',
  'function defaultFeeBps() view returns (uint16)',
  'function createPair(string name, string symbol, uint256 seedTokenAmount) external payable returns (address tokenAddr, address curveAddr)',
  'event PairCreated(address indexed token, address indexed curve, address indexed creator, string name, string symbol, uint256 seedOg, uint256 seedTokens)'
]

export interface CreatePairParams {
  name: string
  symbol: string
  seedTokenAmount: string // e.g., "1000000" for 1M tokens
  seedOgAmount: string // e.g., "0.5" for 0.5 MATIC
}

export interface CreatePairResult {
  success: boolean
  tokenAddress?: string
  curveAddress?: string
  txHash?: string
  error?: string
}

export class NewFactoryService {
  private provider: BrowserProvider | null = null
  private signer: any = null
  private factoryContract: Contract | null = null

  async initialize(provider: BrowserProvider, factoryAddress: string) {
    this.provider = provider
    this.signer = await provider.getSigner()
    this.factoryContract = new Contract(factoryAddress, FACTORY_ABI, this.signer)
  }

  // Resolve latest PairCreated for connected wallet within recent blocks
  async resolveLastPairForCreator(lookbackBlocks: number = 5000): Promise<{ token?: string; curve?: string } | null> {
    if (!this.provider || !this.factoryContract || !this.signer) return null
    try {
      const iface = new ethers.Interface(FACTORY_ABI)
      const topic0 = iface.getEvent("PairCreated").topicHash
      const current = await this.provider.getBlockNumber()
      const fromBlock = current > lookbackBlocks ? current - lookbackBlocks : 0
      const logs = await this.provider.getLogs({
        fromBlock,
        toBlock: current,
        address: this.factoryContract.target as string,
        topics: [topic0]
      })
      const my = (await this.signer.getAddress()).toLowerCase()
      for (let i = logs.length - 1; i >= 0; i--) {
        try {
          const parsed = iface.parseLog(logs[i])
          if (parsed.name === 'PairCreated' && String(parsed.args[2]).toLowerCase() === my) {
            return { token: parsed.args[0], curve: parsed.args[1] }
          }
        } catch { }
      }
      return null
    } catch (e) {
      console.warn('resolveLastPairForCreator failed:', (e as any)?.message || e)
      return null
    }
  }

  // Create a new token pair with bonding curve
  async createPair(params: CreatePairParams): Promise<CreatePairResult> {
    if (!this.factoryContract || !this.signer) {
      throw new Error('Service not initialized')
    }

    try {
      console.log('🚀 Creating new token pair...')
      console.log(`📝 Name: ${params.name}`)
      console.log(`🏷️ Symbol: ${params.symbol}`)
      console.log(`💰 Seed Token Amount: ${params.seedTokenAmount}`)
      console.log(`⛽ Seed MATIC Amount: ${params.seedOgAmount}`)

      // Convert amounts to wei
      const seedTokenAmountWei = parseEther(params.seedTokenAmount)
      const seedOgAmountWei = parseEther(params.seedOgAmount)

      // Get current gas price and add premium for faster confirmation
      const gasPrice = await this.provider!.getFeeData()
      const premiumGasPrice = gasPrice.gasPrice! * 120n / 100n // 20% premium
      console.log(`⛽ Gas price: ${formatUnits(gasPrice.gasPrice!, 'gwei')} Gwei`)
      console.log(`⛽ Premium gas price: ${formatUnits(premiumGasPrice, 'gwei')} Gwei`)

      // Pre-simulate to get deterministic addresses to fall back to if logs are delayed
      let predictedToken: string | undefined
      let predictedCurve: string | undefined
      try {
        // ethers v6 static call pattern
        const predicted = await (this.factoryContract as any).createPair.staticCall(
          params.name,
          params.symbol,
          seedTokenAmountWei,
          { value: seedOgAmountWei }
        )
        predictedToken = predicted[0]
        predictedCurve = predicted[1]
        console.log(`🔮 Predicted Token: ${predictedToken}`)
        console.log(`🔮 Predicted Curve: ${predictedCurve}`)
      } catch (e) {
        console.warn('Static prediction failed (non-fatal):', (e as any)?.message || e)
      }

      console.log('⏳ Sending transaction...')
      const tx = await this.factoryContract.createPair(
        params.name,
        params.symbol,
        seedTokenAmountWei,
        {
          value: seedOgAmountWei,
          gasPrice: premiumGasPrice,
          gasLimit: 2000000 // Reduced from 5M - still plenty for token deployment
        }
      )

      console.log(`⏳ Transaction sent: ${tx.hash}`)
      console.log(`⏳ Waiting for confirmation (this may take 30-60 seconds on Polygon Amoy testnet)...`)

      let receipt
      let finalTxHash = tx.hash
      try {
        receipt = await tx.wait(1) // Wait for 1 confirmation
        console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`)
      } catch (error: any) {
        if (error.code === 'TRANSACTION_REPLACED' && error.replacement) {
          console.log(`🔄 Transaction was repriced, replacement hash: ${error.replacement.hash}`)
          if (error.receipt && error.receipt.status === 1) {
            receipt = error.receipt
            finalTxHash = error.replacement.hash
            console.log(`✅ Replacement transaction succeeded in block ${receipt.blockNumber}`)
          } else {
            throw error
          }
        } else {
          throw error
        }
      }

      // Parse the PairCreated event to get addresses (directly from receipt)
      const factoryAddress = this.factoryContract!.target as string
      const pairCreatedEvent = receipt.logs.find((log: any) => {
        try {
          // Check if log is from factory contract
          if (log.address && log.address.toLowerCase() !== factoryAddress.toLowerCase()) {
            return false
          }
          const iface = new ethers.Interface(FACTORY_ABI)
          const parsed = iface.parseLog(log)
          return parsed && parsed.name === 'PairCreated'
        } catch {
          return false
        }
      })

      if (!pairCreatedEvent) {
        // Wait briefly and poll logs again in case of slow indexing
        await new Promise(r => setTimeout(r, 2000))
        try {
          const iface = new ethers.Interface(FACTORY_ABI)
          const topic0 = iface.getEvent("PairCreated").topicHash
          const block = receipt.blockNumber
          const fromBlock = block > 20 ? block - 20 : 0
          const toBlock = block + 10
          const logsRetry = await this.provider!.getLogs({
            fromBlock,
            toBlock,
            address: this.factoryContract!.target as string,
            topics: [topic0]
          })
          const parsedRetry = logsRetry
            .map(l => {
              try { return iface.parseLog(l) } catch { return null }
            })
            .filter(Boolean) as any[]

          const wallet = await this.signer.getAddress()
          const matchRetry = parsedRetry.find(p => p.name === 'PairCreated' && p.args[2].toLowerCase() === wallet.toLowerCase())
          if (matchRetry) {
            const tokenAddress = matchRetry.args[0]
            const curveAddress = matchRetry.args[1]
            return {
              success: true,
              tokenAddress,
              curveAddress,
              txHash: finalTxHash
            }
          }
        } catch { }

        // Fallback: query logs around the tx block for PairCreated from our factory
        try {
          const iface = new ethers.Interface(FACTORY_ABI)
          const topic0 = iface.getEvent("PairCreated").topicHash
          const block = receipt.blockNumber
          const fromBlock = block > 10 ? block - 10 : 0
          const toBlock = block + 5
          const logs = await this.provider!.getLogs({
            fromBlock,
            toBlock,
            address: this.factoryContract!.target as string,
            topics: [topic0]
          })
          const parsed = logs
            .map(l => {
              try { return iface.parseLog(l) } catch { return null }
            })
            .filter(Boolean) as any[]

          const wallet = await this.signer.getAddress()
          const match = parsed.find(p => p.name === 'PairCreated' && p.args[2].toLowerCase() === wallet.toLowerCase())

          if (match) {
            const tokenAddress = match.args[0]
            const curveAddress = match.args[1]
            return {
              success: true,
              tokenAddress,
              curveAddress,
              txHash: finalTxHash
            }
          }
        } catch (e) {
          // ignore and fall through to soft error
        }

        if (predictedToken && predictedCurve) {
          console.log('⚠️ Using predicted addresses due to delayed indexing')
          return {
            success: true,
            tokenAddress: predictedToken,
            curveAddress: predictedCurve,
            txHash: finalTxHash
          }
        }

        // Final fallback: resolve from recent logs for this creator
        const resolved = await this.resolveLastPairForCreator(10000)
        if (resolved?.token && resolved.curve) {
          console.log('✅ Resolved addresses from recent logs')
          return {
            success: true,
            tokenAddress: resolved.token,
            curveAddress: resolved.curve,
            txHash: finalTxHash
          }
        }

        // If we still can't find the event, wait a bit longer and try one more time
        console.log('⏳ Event not found yet, waiting 5 seconds and retrying...')
        await new Promise(r => setTimeout(r, 5000))

        const finalResolve = await this.resolveLastPairForCreator(100)
        if (finalResolve?.token && finalResolve.curve) {
          console.log('✅ Resolved addresses after additional wait')
          return {
            success: true,
            tokenAddress: finalResolve.token,
            curveAddress: finalResolve.curve,
            txHash: finalTxHash
          }
        }

        // Last resort: return success with txHash only - addresses can be resolved later
        console.warn('⚠️ Could not immediately resolve token/curve addresses, but transaction was successful')
        console.warn('⚠️ Addresses will be resolved automatically when the event is indexed')
        return {
          success: true,
          tokenAddress: undefined, // Will be resolved later via /api/resolvePair
          curveAddress: undefined, // Will be resolved later via /api/resolvePair
          txHash: finalTxHash
        }
      }

      const iface = new ethers.Interface(FACTORY_ABI)
      const parsed = iface.parseLog(pairCreatedEvent)
      const [tokenAddress, curveAddress] = parsed.args

      console.log(`✅ Token created successfully!`)
      console.log(`🪙 Token Address: ${tokenAddress}`)
      console.log(`📈 Curve Address: ${curveAddress}`)

      return {
        success: true,
        tokenAddress,
        curveAddress,
        txHash: finalTxHash
      }

    } catch (error: any) {
      console.error('❌ Failed to create token pair:', error)
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      }
    }
  }

  // Get factory info
  async getFactoryInfo(): Promise<{ treasury: string; defaultFeeBps: number } | null> {
    if (!this.factoryContract) return null

    try {
      const [treasury, defaultFeeBps] = await Promise.all([
        this.factoryContract.treasury(),
        this.factoryContract.defaultFeeBps()
      ])

      return {
        treasury,
        defaultFeeBps: Number(defaultFeeBps)
      }
    } catch (error) {
      console.error('Failed to get factory info:', error)
      return null
    }
  }
}

export const newFactoryService = new NewFactoryService()
