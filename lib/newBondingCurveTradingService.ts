import { ethers, BrowserProvider, Contract, formatEther, parseEther } from 'ethers'

// ABI for the new BondingCurve contract
const BONDING_CURVE_ABI = [
  'function token() view returns (address)',
  'function treasury() view returns (address)',
  'function feeBps() view returns (uint16)',
  'function ogReserve() view returns (uint256)',
  'function tokenReserve() view returns (uint256)',
  'function seeded() view returns (bool)',
  'function buy(uint256 minTokensOut, uint256 deadline) external payable',
  'function sell(uint256 tokensIn, uint256 minOgOut, uint256 deadline) external',
  'function setFeeBps(uint16 _feeBps) external',
  'function setTreasury(address _treasury) external',
  'event Buy(address indexed buyer, uint256 ogIn, uint256 tokensOut, uint256 priceImpact)',
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ogOut, uint256 priceImpact)',
  'event Seeded(uint256 ogReserve, uint256 tokenReserve)'
]

// ABI for the new MemeToken contract
const MEME_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function transfer(address to, uint256 amount) external returns (bool)'
]

export interface CurveInfo {
  tokenAddress: string
  curveAddress: string
  ogReserve: string
  tokenReserve: string
  currentPrice: string
  feeBps: number
  seeded: boolean
}

export interface BuyQuote {
  inputAmount: string // MATIC amount
  outputAmount: string // Token amount
  fee: string
  priceImpact: string
}

export interface SellQuote {
  inputAmount: string // Token amount
  outputAmount: string // MATIC amount
  fee: string
  priceImpact: string
}

export class NewBondingCurveTradingService {
  private provider: BrowserProvider | null = null
  private signer: any = null

  async initialize(provider: BrowserProvider) {
    this.provider = provider
    this.signer = await provider.getSigner()
  }

  // Get curve information (works with any provider, including read-only)
  async getCurveInfo(curveAddress: string, readOnlyProvider?: any): Promise<CurveInfo | null> {
    let providerToUse = readOnlyProvider || this.provider
    
    // If no provider at all, create a read-only one
    if (!providerToUse) {
      const rpcUrl = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_EVM_RPC) || 
                     'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
      providerToUse = new ethers.JsonRpcProvider(rpcUrl)
    }
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, providerToUse)
      
      console.log(`🔍 Getting curve info for: ${curveAddress}`)
      
      // First check if the contract is seeded
      let seeded = false
      try {
        seeded = await curve.seeded()
        console.log(`✅ Seeded status: ${seeded}`)
      } catch (e) {
        console.warn(`❌ Failed to get seeded status:`, e.message)
        return null // If we can't even check if it's seeded, the contract is likely invalid
      }
      
      if (!seeded) {
        console.warn(`⚠️ Bonding curve not seeded yet: ${curveAddress}`)
        return {
          tokenAddress: null,
          curveAddress,
          ogReserve: '0',
          tokenReserve: '0',
          currentPrice: '0',
          feeBps: 0,
          seeded: false
        }
      }
      
      // Get all curve data with individual error handling
      let tokenAddress = null
      let ogReserve = 0n
      let tokenReserve = 0n
      let feeBps = 0
      
      try {
        tokenAddress = await curve.token()
        console.log(`✅ Token address: ${tokenAddress}`)
      } catch (e) {
        console.warn(`❌ Failed to get token address:`, e.message)
      }
      
      try {
        ogReserve = await curve.ogReserve()
        console.log(`✅ MATIC reserve: ${ogReserve}`)
      } catch (e) {
        console.warn(`❌ Failed to get MATIC reserve:`, e.message)
      }
      
      try {
        tokenReserve = await curve.tokenReserve()
        console.log(`✅ Token reserve: ${tokenReserve}`)
      } catch (e) {
        console.warn(`❌ Failed to get token reserve:`, e.message)
      }
      
      try {
        feeBps = await curve.feeBps()
        console.log(`✅ Fee BPS: ${feeBps}`)
      } catch (e) {
        console.warn(`❌ Failed to get fee BPS:`, e.message)
      }

      // Calculate current price (MATIC per token)
      const currentPrice = ogReserve > 0n && tokenReserve > 0n 
        ? (ogReserve * parseEther('1')) / tokenReserve
        : 0n

      return {
        tokenAddress,
        curveAddress,
        ogReserve: formatEther(ogReserve),
        tokenReserve: formatEther(tokenReserve),
        currentPrice: formatEther(currentPrice),
        feeBps: Number(feeBps),
        seeded
      }
    } catch (error) {
      console.error('Error getting curve info:', error)
      return null
    }
  }

  // Get buy quote
  async getBuyQuote(curveAddress: string, maticAmount: string): Promise<BuyQuote | null> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      const ogAmountWei = parseEther(maticAmount)
      
      // Get current reserves
      const [ogReserve, tokenReserve, feeBps] = await Promise.all([
        curve.ogReserve(),
        curve.tokenReserve(),
        curve.feeBps()
      ])

      // Calculate fee
      const fee = (ogAmountWei * BigInt(feeBps)) / 10000n
      const ogInAfterFee = ogAmountWei - fee

      // Calculate tokens out using constant product formula
      const k = ogReserve * tokenReserve
      const newOgReserve = ogReserve + ogInAfterFee
      const newTokenReserve = k / newOgReserve
      const tokensOut = tokenReserve - newTokenReserve

      // Calculate price impact
      const priceImpact = (tokensOut * parseEther('1')) / ogInAfterFee

      return {
        inputAmount: maticAmount,
        outputAmount: formatEther(tokensOut),
        fee: formatEther(fee),
        priceImpact: formatEther(priceImpact)
      }
    } catch (error) {
      console.error('Error getting buy quote:', error)
      return null
    }
  }

  // Get sell quote
  async getSellQuote(curveAddress: string, tokenAmount: string): Promise<SellQuote | null> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      const tokenAmountWei = parseEther(tokenAmount)
      
      // Get current reserves
      const [ogReserve, tokenReserve, feeBps] = await Promise.all([
        curve.ogReserve(),
        curve.tokenReserve(),
        curve.feeBps()
      ])

      // Calculate MATIC out using constant product formula
      const k = ogReserve * tokenReserve
      const newTokenReserve = tokenReserve + tokenAmountWei
      const newOgReserve = k / newTokenReserve
      const ogOutBeforeFee = ogReserve - newOgReserve

      // Calculate fee
      const fee = (ogOutBeforeFee * BigInt(feeBps)) / 10000n
      const ogOut = ogOutBeforeFee - fee

      // Calculate price impact
      const priceImpact = (ogOut * parseEther('1')) / tokenAmountWei

      return {
        inputAmount: tokenAmount,
        outputAmount: formatEther(ogOut),
        fee: formatEther(fee),
        priceImpact: formatEther(priceImpact)
      }
    } catch (error) {
      console.error('Error getting sell quote:', error)
      return null
    }
  }

  // Helper to decode error messages
  private decodeError(error: any): string {
    if (error.reason) return error.reason
    if (error.data) {
      try {
        // Try to decode revert reason
        const iface = new ethers.Interface(['function Error(string)'])
        const decoded = iface.parseError(error.data)
        if (decoded) return decoded.args[0] as string
      } catch {}
      
      // Try common error selectors
      const errorSelectors: Record<string, string> = {
        '0x08c379a0': 'Error(string)',
        '0x4e487b71': 'Panic(uint256)',
      }
      
      for (const [selector, signature] of Object.entries(errorSelectors)) {
        if (error.data.startsWith(selector)) {
          try {
            const iface = new ethers.Interface([`function ${signature}`])
            const decoded = iface.parseError(error.data)
            if (decoded && signature === 'Error(string)') {
              return decoded.args[0] as string
            }
          } catch {}
        }
      }
    }
    
    // Check for common error patterns in message
    const message = error.message || ''
    if (message.includes('insufficient funds')) return 'Insufficient MATIC balance'
    if (message.includes('execution reverted')) {
      const match = message.match(/execution reverted: (.+)/)
      if (match) return match[1]
    }
    if (message.includes('user rejected')) return 'Transaction rejected by user'
    if (message.includes('deadline')) return 'Transaction deadline expired'
    if (message.includes('slippage')) return 'Slippage tolerance exceeded'
    if (message.includes('seeded')) return 'Bonding curve is not seeded yet'
    if (message.includes('Internal JSON-RPC error') || message.includes('-32603')) {
      return 'RPC node error. Please try again or switch to a different network node.'
    }
    if (message.includes('could not coalesce')) {
      return 'Network error. Please check your connection and try again.'
    }
    if (message.includes('UNKNOWN_ERROR')) {
      return 'Transaction failed. Please check your balance, gas settings, and try again.'
    }
    if (error.code === -32603) {
      return 'RPC node error. The transaction may have failed. Please check your balance and try again.'
    }
    
    return message || 'Transaction failed. Please check your balance and try again.'
  }

  // Execute buy
  async buyTokens(curveAddress: string, maticAmount: string, minTokensOut: string): Promise<{ success: boolean; txHash: string; error?: string }> {
    if (!this.signer) throw new Error('No signer available')
    
    try {
      // Validate inputs
      const maticAmountNum = parseFloat(maticAmount)
      if (isNaN(maticAmountNum) || maticAmountNum <= 0) {
        return { success: false, txHash: '', error: 'Invalid MATIC amount' }
      }
      
      // Check curve is seeded
      const curveInfo = await this.getCurveInfo(curveAddress)
      if (!curveInfo || !curveInfo.seeded) {
        return { success: false, txHash: '', error: 'Bonding curve is not seeded yet. Please wait for the token creation to complete.' }
      }
      
      // Check user balance
      const userAddress = await this.signer.getAddress()
      const balance = await this.getNativeBalance(userAddress)
      if (parseFloat(balance) < maticAmountNum) {
        return { success: false, txHash: '', error: `Insufficient MATIC balance. You have ${parseFloat(balance).toFixed(4)} MATIC, but need ${maticAmount}` }
      }
      
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
      const ogAmountWei = parseEther(maticAmount)
      const minTokensOutWei = parseEther(minTokensOut)
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 1200
      
      // Estimate gas first with retry logic
      let gasEstimate: bigint
      try {
        gasEstimate = await curve.buy.estimateGas(minTokensOutWei, deadline, { value: ogAmountWei })
        // Add 20% buffer for gas
        gasEstimate = (gasEstimate * 120n) / 100n
      } catch (estimateError: any) {
        const errorMsg = this.decodeError(estimateError)
        // If gas estimation fails, try with a default gas limit
        console.warn('Gas estimation failed, using default:', estimateError)
        gasEstimate = 300000n // Default gas limit
      }
      
      // Send transaction with explicit gas limit
      const tx = await curve.buy(minTokensOutWei, deadline, { 
        value: ogAmountWei,
        gasLimit: gasEstimate
      })
      const receipt = await tx.wait()
      
      // Record trading transaction (non-blocking)
      try {
        const userAddress = await this.signer.getAddress()
        const curveInfo = await this.getCurveInfo(curveAddress)
        if (curveInfo) {
          await this.recordTradingTransaction({
            coinId: curveInfo.tokenAddress,
            userAddress,
            txHash: receipt.transactionHash,
            blockNumber: receipt.blockNumber,
            timestamp: Math.floor(Date.now() / 1000),
            type: 'buy',
            amount: minTokensOut,
            amountMatic: parseFloat(maticAmount),
            price: parseFloat(maticAmount) / parseFloat(minTokensOut),
            volume: parseFloat(maticAmount),
            gasUsed: receipt.gasUsed?.toString() || '0',
            gasPrice: receipt.gasPrice?.toString() || '0'
          })
        }
      } catch (recordError) {
        console.warn('Failed to record trading transaction:', recordError)
      }
      
      return {
        success: true,
        txHash: receipt.transactionHash
      }
    } catch (error: any) {
      const errorMsg = this.decodeError(error)
      return {
        success: false,
        txHash: '',
        error: errorMsg
      }
    }
  }

  // Execute sell - FIXED: Now properly converts minOgOut to BigNumber
  async sellTokens(curveAddress: string, tokenAmount: string, minOgOut: string): Promise<{ success: boolean; txHash: string; error?: string }> {
    if (!this.signer) throw new Error('No signer available')
    
    try {
      // Validate inputs
      const tokenAmountNum = parseFloat(tokenAmount)
      if (isNaN(tokenAmountNum) || tokenAmountNum <= 0) {
        return { success: false, txHash: '', error: 'Invalid token amount' }
      }
      
      // Get curve info
      const curveInfo = await this.getCurveInfo(curveAddress)
      if (!curveInfo || !curveInfo.tokenAddress) {
        return { success: false, txHash: '', error: 'Could not get curve info' }
      }
      
      if (!curveInfo.seeded) {
        return { success: false, txHash: '', error: 'Bonding curve is not seeded yet' }
      }
      
      const userAddress = await this.signer.getAddress()
      
      // Check token balance
      const tokenBalance = await this.getTokenBalance(curveInfo.tokenAddress, userAddress)
      if (parseFloat(tokenBalance) < tokenAmountNum) {
        return { success: false, txHash: '', error: `Insufficient token balance. You have ${parseFloat(tokenBalance).toFixed(4)} tokens, but need ${tokenAmount}` }
      }
      
      const curve = new Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
      const tokenAmountWei = parseEther(tokenAmount)
      const minOgOutWei = parseEther(minOgOut)
      
      const token = new Contract(curveInfo.tokenAddress, MEME_TOKEN_ABI, this.signer)
      
      // Check and approve if needed
      const allowance = await token.allowance(userAddress, curveAddress)
      if (allowance < tokenAmountWei) {
        try {
          const approveTx = await token.approve(curveAddress, tokenAmountWei)
          await approveTx.wait()
        } catch (approveError: any) {
          return { success: false, txHash: '', error: `Failed to approve tokens: ${this.decodeError(approveError)}` }
        }
      }
      
      // Set deadline to 20 minutes from now
      const deadline = Math.floor(Date.now() / 1000) + 1200
      
      // Estimate gas first with retry logic
      let gasEstimate: bigint
      try {
        gasEstimate = await curve.sell.estimateGas(tokenAmountWei, minOgOutWei, deadline)
        // Add 20% buffer for gas
        gasEstimate = (gasEstimate * 120n) / 100n
      } catch (estimateError: any) {
        const errorMsg = this.decodeError(estimateError)
        // If gas estimation fails, try with a default gas limit
        console.warn('Gas estimation failed, using default:', estimateError)
        gasEstimate = 300000n // Default gas limit
      }
      
      // Send transaction with explicit gas limit
      const tx = await curve.sell(tokenAmountWei, minOgOutWei, deadline, {
        gasLimit: gasEstimate
      })
      const receipt = await tx.wait()
      
      // Record trading transaction (non-blocking)
      try {
        const userAddress = await this.signer.getAddress()
        await this.recordTradingTransaction({
          coinId: curveInfo.tokenAddress,
          userAddress,
          txHash: receipt.transactionHash,
          blockNumber: receipt.blockNumber,
          timestamp: Math.floor(Date.now() / 1000),
          type: 'sell',
          amount: tokenAmount,
          amountMatic: parseFloat(minOgOut),
          price: parseFloat(minOgOut) / parseFloat(tokenAmount),
          volume: parseFloat(minOgOut),
          gasUsed: receipt.gasUsed?.toString() || '0',
          gasPrice: receipt.gasPrice?.toString() || '0'
        })
      } catch (recordError) {
        console.warn('Failed to record trading transaction:', recordError)
      }
      
      return {
        success: true,
        txHash: receipt.transactionHash
      }
    } catch (error: any) {
      const errorMsg = this.decodeError(error)
      return {
        success: false,
        txHash: '',
        error: errorMsg
      }
    }
  }

  // Get token balance
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const token = new Contract(tokenAddress, MEME_TOKEN_ABI, this.provider)
      const balance = await token.balanceOf(userAddress)
      return formatEther(balance)
    } catch (error) {
      console.error('Error getting token balance:', error)
      return '0'
    }
  }

  // Get native balance (MATIC)
  async getNativeBalance(userAddress: string): Promise<string> {
    if (!this.provider) throw new Error('Service not initialized')
    
    try {
      const balance = await this.provider.getBalance(userAddress)
      return formatEther(balance)
    } catch (error) {
      console.error('Error getting native balance:', error)
      return '0'
    }
  }

  // Record trading transaction to backend
  private async recordTradingTransaction(transactionData: {
    coinId: string
    userAddress: string
    txHash: string
    blockNumber: number
    timestamp: number
    type: 'buy' | 'sell'
    amount: string
    amountMatic: number
    price: number
    volume: number
    gasUsed: string
    gasPrice: string
  }) {
    try {
      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

      // Best-effort: send to backend if available (does nothing if route is missing)
      try {
        await fetch(`${backendBase}/trading/record`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData)
        })
      } catch (e) {
        console.warn('Backend trading record failed (non-fatal):', (e as any)?.message || e)
      }

      // Also persist lightweight trading stats locally so the Profile page
      // can show non-zero "Trading Stats" even without a running backend/indexer.
      if (typeof window !== 'undefined') {
        try {
          const key = `trading:${transactionData.userAddress.toLowerCase()}`
          const existingRaw = window.localStorage.getItem(key)
          const existing = existingRaw ? JSON.parse(existingRaw) : {}

          const totalTrades = (existing.totalTrades || 0) + 1
          const totalVolume = (existing.totalVolume || 0) + (transactionData.amountMatic || 0)

          const tokens: string[] = Array.isArray(existing.tokens)
            ? existing.tokens
            : []
          if (!tokens.includes(transactionData.coinId.toLowerCase())) {
            tokens.push(transactionData.coinId.toLowerCase())
          }

          const localStats = {
            totalTrades,
            totalVolume,
            tokens,
            lastTradeAt: transactionData.timestamp || Math.floor(Date.now() / 1000)
          }

          window.localStorage.setItem(key, JSON.stringify(localStats))
        } catch (e) {
          console.warn('Failed to cache local trading stats (non-fatal):', (e as any)?.message || e)
        }
      }
    } catch (error) {
      console.error('Failed to record trading transaction:', error)
    }
  }
}

export const newBondingCurveTradingService = new NewBondingCurveTradingService()
