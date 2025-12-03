import { ethers, BrowserProvider, Contract, formatEther, parseEther, parseUnits } from 'ethers'

// ABI for BondingCurvePool contract
const BONDING_CURVE_POOL_ABI = [
  'function token() view returns (address)',
  'function baseToken() view returns (address)',
  'function basePrice() view returns (uint256)',
  'function baseReserve() view returns (uint256)',
  'function soldSupply() view returns (uint256)',
  'function maxSupply() view returns (uint256)',
  'function curveActive() view returns (bool)',
  'function feeBps() view returns (uint16)',
  'function buy(uint256 baseAmountIn, uint256 minTokensOut) payable returns (uint256)',
  'function sell(uint256 tokenAmountIn, uint256 minBaseOut) returns (uint256)',
  'function getPriceForBuy(uint256 tokenAmount) view returns (uint256)',
  'function getPriceForSell(uint256 tokenAmount) view returns (uint256)',
  'function getCurveInfo() view returns (uint256 currentPrice, uint256 totalLiquidity, uint256 marketCap, bool isActive, uint256 tokensSold, uint256 maxTokens)',
  'function closeCurve()',
  'event Bought(address indexed buyer, uint256 baseAmountIn, uint256 tokensOut, uint256 newPrice, uint256 newSoldSupply)',
  'event Sold(address indexed seller, uint256 tokensIn, uint256 baseOut, uint256 newPrice, uint256 newSoldSupply)',
  'event CurveClosed(address indexed token, uint256 finalBaseReserve, uint256 finalSoldSupply)'
]

// ABI for ERC20 token
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)'
]

export interface CurveInfo {
  currentPrice: string
  totalLiquidity: string
  marketCap: string
  isActive: boolean
  tokensSold: string
  maxTokens: string
  baseReserve: string
  soldSupply: string
  feeBps: number
}

export interface BuyQuote {
  inputAmount: string // MATIC/base token amount
  outputAmount: string // Token amount
  fee: string
  pricePerToken: string
}

export interface SellQuote {
  inputAmount: string // Token amount
  outputAmount: string // MATIC/base token amount
  fee: string
  pricePerToken: string
}

export class PumpFunBondingCurveService {
  private provider: BrowserProvider | null = null
  private signer: any = null

  async initialize(provider: BrowserProvider) {
    this.provider = provider
    this.signer = await provider.getSigner()
  }

  /**
   * Get curve information
   */
  async getCurveInfo(curveAddress: string, readOnlyProvider?: any): Promise<CurveInfo | null> {
    let providerToUse = readOnlyProvider || this.provider
    
    if (!providerToUse) {
      const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                     'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
      providerToUse = new ethers.JsonRpcProvider(rpcUrl)
    }
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_POOL_ABI, providerToUse)
      
      const [info, baseReserve, soldSupply, feeBps] = await Promise.all([
        curve.getCurveInfo(),
        curve.baseReserve(),
        curve.soldSupply(),
        curve.feeBps()
      ])
      
      return {
        currentPrice: formatEther(info.currentPrice),
        totalLiquidity: formatEther(info.totalLiquidity),
        marketCap: formatEther(info.marketCap),
        isActive: info.isActive,
        tokensSold: formatEther(info.tokensSold),
        maxTokens: formatEther(info.maxTokens),
        baseReserve: formatEther(baseReserve),
        soldSupply: formatEther(soldSupply),
        feeBps: Number(feeBps)
      }
    } catch (error: any) {
      console.error('Failed to get curve info:', error)
      return null
    }
  }

  /**
   * Get buy quote (preview cost before buying)
   */
  async getBuyQuote(curveAddress: string, tokenAmount: string): Promise<BuyQuote | null> {
    if (!this.provider) {
      const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                     'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
      this.provider = new ethers.JsonRpcProvider(rpcUrl) as any
    }
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_POOL_ABI, this.provider)
      
      // Get token decimals
      const tokenAddress = await curve.token()
      const token = new Contract(tokenAddress, ERC20_ABI, this.provider)
      const decimals = await token.decimals()
      
      const tokenAmountWei = parseUnits(tokenAmount, decimals)
      const baseCostWei = await curve.getPriceForBuy(tokenAmountWei)
      
      // Get fee
      const feeBps = await curve.feeBps()
      const fee = (baseCostWei * BigInt(feeBps)) / 10000n
      const totalCost = baseCostWei + fee
      
      const pricePerToken = baseCostWei / tokenAmountWei
      
      return {
        inputAmount: formatEther(totalCost),
        outputAmount: tokenAmount,
        fee: formatEther(fee),
        pricePerToken: formatEther(pricePerToken)
      }
    } catch (error: any) {
      console.error('Failed to get buy quote:', error)
      return null
    }
  }

  /**
   * Get sell quote (preview return before selling)
   */
  async getSellQuote(curveAddress: string, tokenAmount: string): Promise<SellQuote | null> {
    if (!this.provider) {
      const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                     'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
      this.provider = new ethers.JsonRpcProvider(rpcUrl) as any
    }
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_POOL_ABI, this.provider)
      
      // Get token decimals
      const tokenAddress = await curve.token()
      const token = new Contract(tokenAddress, ERC20_ABI, this.provider)
      const decimals = await token.decimals()
      
      const tokenAmountWei = parseUnits(tokenAmount, decimals)
      const baseReturnWei = await curve.getPriceForSell(tokenAmountWei)
      
      // Get fee
      const feeBps = await curve.feeBps()
      const fee = (baseReturnWei * BigInt(feeBps)) / 10000n
      const baseOut = baseReturnWei - fee
      
      const pricePerToken = baseReturnWei / tokenAmountWei
      
      return {
        inputAmount: tokenAmount,
        outputAmount: formatEther(baseOut),
        fee: formatEther(fee),
        pricePerToken: formatEther(pricePerToken)
      }
    } catch (error: any) {
      console.error('Failed to get sell quote:', error)
      return null
    }
  }

  /**
   * Buy tokens with MATIC/base token
   */
  async buyTokens(
    curveAddress: string,
    baseAmountIn: string,
    minTokensOut: string,
    slippageTolerance: number = 0.5 // 0.5% default
  ): Promise<{ txHash: string; tokensOut: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Call initialize() first.')
    }
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_POOL_ABI, this.signer)
      
      // Get token decimals
      const tokenAddress = await curve.token()
      const token = new Contract(tokenAddress, ERC20_ABI, this.provider || this.signer)
      const decimals = await token.decimals()
      
      const baseAmountWei = parseEther(baseAmountIn)
      const minTokensWei = parseUnits(minTokensOut, decimals)
      
      // Apply slippage if minTokensOut not provided
      let finalMinTokens = minTokensWei
      if (parseFloat(minTokensOut) === 0) {
        // Get quote and apply slippage
        const quote = await this.getBuyQuote(curveAddress, '1')
        if (quote) {
          const estimatedTokens = parseFloat(baseAmountIn) / parseFloat(quote.pricePerToken)
          const slippageAdjusted = estimatedTokens * (1 - slippageTolerance / 100)
          finalMinTokens = parseUnits(slippageAdjusted.toFixed(decimals), decimals)
        }
      }
      
      // Execute buy transaction (native MATIC)
      const tx = await curve.buy(baseAmountWei, finalMinTokens, {
        value: baseAmountWei // For native MATIC
      })
      
      const receipt = await tx.wait()
      
      // Parse event to get tokensOut
      const boughtEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = curve.interface.parseLog(log)
          return parsed && parsed.name === 'Bought'
        } catch {
          return false
        }
      })
      
      let tokensOut = minTokensOut
      if (boughtEvent) {
        const parsed = curve.interface.parseLog(boughtEvent)
        if (parsed) {
          tokensOut = formatEther(parsed.args.tokensOut)
        }
      }
      
      return {
        txHash: receipt.hash,
        tokensOut
      }
    } catch (error: any) {
      console.error('Buy failed:', error)
      throw new Error(`Buy failed: ${error.message}`)
    }
  }

  /**
   * Sell tokens for MATIC/base token
   */
  async sellTokens(
    curveAddress: string,
    tokenAmountIn: string,
    minBaseOut: string,
    slippageTolerance: number = 0.5 // 0.5% default
  ): Promise<{ txHash: string; baseOut: string }> {
    if (!this.signer) {
      throw new Error('Signer not initialized. Call initialize() first.')
    }
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_POOL_ABI, this.signer)
      
      // Get token address and approve if needed
      const tokenAddress = await curve.token()
      const token = new Contract(tokenAddress, ERC20_ABI, this.signer)
      const decimals = await token.decimals()
      
      const tokenAmountWei = parseUnits(tokenAmountIn, decimals)
      
      // Check and approve allowance
      const allowance = await token.allowance(await this.signer.getAddress(), curveAddress)
      if (allowance < tokenAmountWei) {
        const approveTx = await token.approve(curveAddress, ethers.MaxUint256)
        await approveTx.wait()
      }
      
      // Calculate min base out with slippage if not provided
      let finalMinBase = parseEther(minBaseOut)
      if (parseFloat(minBaseOut) === 0) {
        const quote = await this.getSellQuote(curveAddress, tokenAmountIn)
        if (quote) {
          const slippageAdjusted = parseFloat(quote.outputAmount) * (1 - slippageTolerance / 100)
          finalMinBase = parseEther(slippageAdjusted.toFixed(18))
        }
      }
      
      // Execute sell transaction
      const tx = await curve.sell(tokenAmountWei, finalMinBase)
      const receipt = await tx.wait()
      
      // Parse event to get baseOut
      const soldEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = curve.interface.parseLog(log)
          return parsed && parsed.name === 'Sold'
        } catch {
          return false
        }
      })
      
      let baseOut = minBaseOut
      if (soldEvent) {
        const parsed = curve.interface.parseLog(soldEvent)
        if (parsed) {
          baseOut = formatEther(parsed.args.baseOut)
        }
      }
      
      return {
        txHash: receipt.hash,
        baseOut
      }
    } catch (error: any) {
      console.error('Sell failed:', error)
      throw new Error(`Sell failed: ${error.message}`)
    }
  }

  /**
   * Get current price for a specific token amount
   */
  async getPriceForBuy(curveAddress: string, tokenAmount: string): Promise<string | null> {
    if (!this.provider) {
      const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                     'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
      this.provider = new ethers.JsonRpcProvider(rpcUrl) as any
    }
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_POOL_ABI, this.provider)
      const tokenAddress = await curve.token()
      const token = new Contract(tokenAddress, ERC20_ABI, this.provider)
      const decimals = await token.decimals()
      
      const tokenAmountWei = parseUnits(tokenAmount, decimals)
      const baseCostWei = await curve.getPriceForBuy(tokenAmountWei)
      
      return formatEther(baseCostWei)
    } catch (error: any) {
      console.error('Failed to get price for buy:', error)
      return null
    }
  }

  /**
   * Get current return for selling a specific token amount
   */
  async getPriceForSell(curveAddress: string, tokenAmount: string): Promise<string | null> {
    if (!this.provider) {
      const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                     'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
      this.provider = new ethers.JsonRpcProvider(rpcUrl) as any
    }
    
    try {
      const curve = new Contract(curveAddress, BONDING_CURVE_POOL_ABI, this.provider)
      const tokenAddress = await curve.token()
      const token = new Contract(tokenAddress, ERC20_ABI, this.provider)
      const decimals = await token.decimals()
      
      const tokenAmountWei = parseUnits(tokenAmount, decimals)
      const baseReturnWei = await curve.getPriceForSell(tokenAmountWei)
      
      return formatEther(baseReturnWei)
    } catch (error: any) {
      console.error('Failed to get price for sell:', error)
      return null
    }
  }
}

// Export singleton instance
export const pumpFunBondingCurveService = new PumpFunBondingCurveService()

