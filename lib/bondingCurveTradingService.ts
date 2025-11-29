import { ethers } from 'ethers'

// BondingCurveAMM ABI
const BONDING_CURVE_ABI = [
  // View functions
  'function getCurrentPrice() external view returns (uint256)',
  'function getCurrentStep() external view returns (uint256)',
  'function getCurveStats() external view returns (uint256 currentStep, uint256 currentPrice, uint256 tokensSold, uint256 nativeReserve, bool isGraduated, uint256 remainingTokens)',
  'function quoteBuy(uint256 qty) external view returns (uint256)',
  'function quoteSell(uint256 qty) external view returns (uint256)',
  
  // State variables
  'function tokensSoldOnCurve() external view returns (uint256)',
  'function nativeReserve() external view returns (uint256)',
  'function graduated() external view returns (bool)',
  'function basePrice() external view returns (uint256)',
  'function stepSize() external view returns (uint256)',
  'function stepQty() external view returns (uint256)',
  'function curveCap() external view returns (uint256)',
  'function feeBps() external view returns (uint256)',
  
  // Trading functions
  'function buy(uint256 qty, uint256 maxCost) external payable',
  'function sell(uint256 qty, uint256 minReturn) external',
  
  // Events
  'event Buy(address indexed buyer, uint256 ogIn, uint256 tokensOut, uint256 virtualPrice)',
  'event Sell(address indexed seller, uint256 tokensIn, uint256 ogOut, uint256 virtualPrice)',
  'event PriceUpdated(uint256 virtualPrice, uint256 supply, uint256 ogReserve)',
  'event StepAdvanced(uint256 newStep, uint256 newPrice)',
  'event Graduated(uint256 tokensSoldOnCurve, uint256 nativeReserve, uint256 timestamp)'
]

// ProjectToken ABI
const PROJECT_TOKEN_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)'
]

export interface CurveStats {
  currentStep: number
  currentPrice: string
  tokensSold: string
  nativeReserve: string
  isGraduated: boolean
  remainingTokens: string
}

export interface TradingQuote {
  inputAmount: string
  outputAmount: string
  price: string
  slippage: string
  fee: string
}

export interface TradingResult {
  success: boolean
  txHash?: string
  error?: string
  details?: {
    inputAmount: string
    outputAmount: string
    price: string
    step: number
  }
}

export interface CurveInfo {
  address: string
  basePrice: string
  stepSize: string
  stepQty: string
  curveCap: string
  feeBps: number
  currentPrice: string
  currentStep: number
  tokensSold: string
  nativeReserve: string
  isGraduated: boolean
  remainingTokens: string
}

class BondingCurveTradingService {
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null
  
  // Initialize the service
  async initialize(provider: ethers.providers.Web3Provider) {
    this.provider = provider
    this.signer = provider.getSigner()
    console.log('✅ BondingCurveTrading service initialized')
  }

  // Get comprehensive curve information
  async getCurveInfo(curveAddress: string): Promise<CurveInfo | null> {
    if (!this.provider) {
      throw new Error('Service not initialized')
    }

    try {
      const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      
      // Get all curve data in parallel
      const [
        basePrice,
        stepSize,
        stepQty,
        curveCap,
        feeBps,
        currentPrice,
        currentStep,
        tokensSold,
        nativeReserve,
        isGraduated,
        remainingTokens
      ] = await Promise.all([
        curveContract.basePrice(),
        curveContract.stepSize(),
        curveContract.stepQty(),
        curveContract.curveCap(),
        curveContract.feeBps(),
        curveContract.getCurrentPrice(),
        curveContract.getCurrentStep(),
        curveContract.tokensSoldOnCurve(),
        curveContract.nativeReserve(),
        curveContract.graduated(),
        curveContract.curveCap().then((cap: ethers.BigNumber) => cap.sub(tokensSold))
      ])

      return {
        address: curveAddress,
        basePrice: ethers.formatEther(basePrice),
        stepSize: ethers.formatEther(stepSize),
        stepQty: stepQty.toString(),
        curveCap: curveCap.toString(),
        feeBps: feeBps.toNumber(),
        currentPrice: ethers.formatEther(currentPrice),
        currentStep: currentStep.toNumber(),
        tokensSold: tokensSold.toString(),
        nativeReserve: ethers.formatEther(nativeReserve),
        isGraduated,
        remainingTokens: remainingTokens.toString()
      }
    } catch (error) {
      console.error('Error getting curve info:', error)
      return null
    }
  }

  // Get current curve statistics
  async getCurveStats(curveAddress: string): Promise<CurveStats | null> {
    if (!this.provider) {
      throw new Error('Service not initialized')
    }

    try {
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
    const stats = await curveContract.getCurveStats()
    
    return {
      currentStep: stats.currentStep.toNumber(),
        currentPrice: ethers.formatEther(stats.currentPrice),
        tokensSold: stats.tokensSold.toString(),
        nativeReserve: ethers.formatEther(stats.nativeReserve),
      isGraduated: stats.isGraduated,
        remainingTokens: stats.remainingTokens.toString()
      }
    } catch (error) {
      console.error('Error getting curve stats:', error)
      return null
    }
  }

  // Get quote for buying tokens
  async getBuyQuote(curveAddress: string, tokenAmount: string): Promise<TradingQuote | null> {
    if (!this.provider) {
      throw new Error('Service not initialized')
    }

    try {
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      
      // Convert token amount to wei
      const tokenAmountWei = ethers.parseEther(tokenAmount)
    
      // Get quote
      const costWei = await curveContract.quoteBuy(tokenAmountWei)
    const currentPrice = await curveContract.getCurrentPrice()
      
      // Calculate fee
      const feeBps = await curveContract.feeBps()
      const feeAmount = costWei.mul(feeBps).div(10000)
      
      // Calculate slippage (price impact)
      const totalCost = costWei.add(feeAmount)
      const avgPrice = totalCost.mul(ethers.parseEther('1')).div(tokenAmountWei)
      const slippage = avgPrice.sub(currentPrice).mul(10000).div(currentPrice)
    
    return {
        inputAmount: ethers.formatEther(totalCost),
        outputAmount: tokenAmount,
        price: ethers.formatEther(currentPrice),
        slippage: slippage.toString(),
        fee: ethers.formatEther(feeAmount)
      }
    } catch (error) {
      console.error('Error getting buy quote:', error)
      return null
    }
  }

  // Get quote for selling tokens
  async getSellQuote(curveAddress: string, tokenAmount: string): Promise<TradingQuote | null> {
    if (!this.provider) {
      throw new Error('Service not initialized')
    }

    try {
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
      
      // Convert token amount to wei
      const tokenAmountWei = ethers.parseEther(tokenAmount)
      
      // Get quote
      const returnWei = await curveContract.quoteSell(tokenAmountWei)
      const currentPrice = await curveContract.getCurrentPrice()
      
      // Calculate fee
      const feeBps = await curveContract.feeBps()
      const feeAmount = returnWei.mul(feeBps).div(10000)
      
      // Calculate slippage (price impact)
      const netReturn = returnWei.sub(feeAmount)
      const avgPrice = netReturn.mul(ethers.parseEther('1')).div(tokenAmountWei)
      const slippage = currentPrice.sub(avgPrice).mul(10000).div(currentPrice)
      
      return {
        inputAmount: tokenAmount,
        outputAmount: ethers.formatEther(netReturn),
        price: ethers.formatEther(currentPrice),
        slippage: slippage.toString(),
        fee: ethers.formatEther(feeAmount)
      }
    } catch (error) {
      console.error('Error getting sell quote:', error)
      return null
    }
  }

  // Buy tokens on the curve
  async buyTokens(
    curveAddress: string,
    tokenAmount: string,
    maxCost: string,
    slippageTolerance: number = 0.05 // 5% default
  ): Promise<TradingResult> {
    if (!this.signer) {
      throw new Error('Service not initialized')
    }

    try {
      const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
      
      // Convert amounts to wei
      const tokenAmountWei = ethers.parseEther(tokenAmount)
      const maxCostWei = ethers.parseEther(maxCost)
      
      // Get current quote to calculate slippage
      const quote = await this.getBuyQuote(curveAddress, tokenAmount)
      if (!quote) {
        throw new Error('Failed to get buy quote')
      }
      
      // Check if slippage is within tolerance
      const slippagePercent = parseFloat(quote.slippage) / 100
      if (slippagePercent > slippageTolerance) {
        throw new Error(`Slippage too high: ${slippagePercent.toFixed(2)}% > ${(slippageTolerance * 100).toFixed(2)}%`)
      }
      
      // Execute buy transaction
      const tx = await curveContract.buy(tokenAmountWei, maxCostWei, {
        value: maxCostWei
      })
      
      console.log(`🔄 Buy transaction sent: ${tx.hash}`)
      
      // Wait for confirmation
      const receipt = await tx.wait()
      console.log(`✅ Buy transaction confirmed in block ${receipt.blockNumber}`)
      
      // Parse events to get details
      const buyEvent = receipt.events?.find((event: any) => event.event === 'Buy')
      let details
      
      if (buyEvent) {
        details = {
          inputAmount: ethers.formatEther(buyEvent.args.ogIn),
          outputAmount: buyEvent.args.tokensOut.toString(),
          price: ethers.formatEther(buyEvent.args.virtualPrice),
          step: 0 // Would need to get from StepAdvanced event
        }
      }
      
      return {
        success: true,
        txHash: tx.hash,
        details
      }
      
    } catch (error: any) {
      console.error('❌ Buy transaction failed:', error)
      return {
        success: false,
        error: error.message || 'Buy transaction failed'
      }
    }
  }
  
  // Sell tokens on the curve
  async sellTokens(
    curveAddress: string,
    tokenAmount: string,
    minReturn: string,
    slippageTolerance: number = 0.05 // 5% default
  ): Promise<TradingResult> {
    if (!this.signer) {
      throw new Error('Service not initialized')
    }
    
    try {
      const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.signer)
      
      // Convert amounts to wei
      const tokenAmountWei = ethers.parseEther(tokenAmount)
      const minReturnWei = ethers.parseEther(minReturn)
      
      // Get current quote to calculate slippage
      const quote = await this.getSellQuote(curveAddress, tokenAmount)
      if (!quote) {
        throw new Error('Failed to get sell quote')
      }
      
      // Check if slippage is within tolerance
      const slippagePercent = parseFloat(quote.slippage) / 100
      if (slippagePercent > slippageTolerance) {
        throw new Error(`Slippage too high: ${slippagePercent.toFixed(2)}% > ${(slippageTolerance * 100).toFixed(2)}%`)
      }
      
      // Execute sell transaction
      const tx = await curveContract.sell(tokenAmountWei, minReturnWei)
      
      console.log(`🔄 Sell transaction sent: ${tx.hash}`)
      
      // Wait for confirmation
      const receipt = await tx.wait()
      console.log(`✅ Sell transaction confirmed in block ${receipt.blockNumber}`)
      
      // Parse events to get details
      const sellEvent = receipt.events?.find((event: any) => event.event === 'Sell')
      let details
      
      if (sellEvent) {
        details = {
          inputAmount: sellEvent.args.tokensIn.toString(),
          outputAmount: ethers.formatEther(sellEvent.args.ogOut),
          price: ethers.formatEther(sellEvent.args.virtualPrice),
          step: 0 // Would need to get from StepAdvanced event
        }
      }
      
      return {
        success: true,
        txHash: tx.hash,
        details
      }
      
    } catch (error: any) {
      console.error('❌ Sell transaction failed:', error)
      return {
        success: false,
        error: error.message || 'Sell transaction failed'
      }
    }
  }
  
  // Get token balance for a user
  async getTokenBalance(tokenAddress: string, userAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Service not initialized')
    }

    try {
      const tokenContract = new ethers.Contract(tokenAddress, PROJECT_TOKEN_ABI, this.provider)
      const balance = await tokenContract.balanceOf(userAddress)
      return ethers.formatEther(balance)
    } catch (error) {
      console.error('Error getting token balance:', error)
      return '0'
    }
  }

  // Get native token balance for a user
  async getNativeBalance(userAddress: string): Promise<string> {
    if (!this.provider) {
      throw new Error('Service not initialized')
    }

    try {
      const balance = await this.provider.getBalance(userAddress)
      return ethers.formatEther(balance)
    } catch (error) {
      console.error('Error getting native balance:', error)
      return '0'
    }
  }

  // Listen for curve events
  async listenForCurveEvents(
    curveAddress: string,
    callbacks: {
      onBuy?: (buyer: string, ogIn: string, tokensOut: string, price: string) => void
      onSell?: (seller: string, tokensIn: string, ogOut: string, price: string) => void
      onPriceUpdate?: (price: string, supply: string, ogReserve: string) => void
      onStepAdvance?: (step: number, price: string) => void
      onGraduation?: (tokensSold: string, ogReserve: string, timestamp: number) => void
    }
  ) {
    if (!this.provider) {
      throw new Error('Service not initialized')
    }
    
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
    
    // Set up event listeners
    if (callbacks.onBuy) {
      curveContract.on('Buy', (buyer: string, ogIn: ethers.BigNumber, tokensOut: ethers.BigNumber, price: ethers.BigNumber) => {
        callbacks.onBuy!(
          buyer,
          ethers.formatEther(ogIn),
          tokensOut.toString(),
          ethers.formatEther(price)
        )
      })
    }
    
    if (callbacks.onSell) {
      curveContract.on('Sell', (seller: string, tokensIn: ethers.BigNumber, ogOut: ethers.BigNumber, price: ethers.BigNumber) => {
        callbacks.onSell!(
          seller,
          tokensIn.toString(),
          ethers.formatEther(ogOut),
          ethers.formatEther(price)
        )
      })
    }
    
    if (callbacks.onPriceUpdate) {
      curveContract.on('PriceUpdated', (price: ethers.BigNumber, supply: ethers.BigNumber, ogReserve: ethers.BigNumber) => {
        callbacks.onPriceUpdate!(
          ethers.formatEther(price),
          supply.toString(),
          ethers.formatEther(ogReserve)
        )
      })
    }
    
    if (callbacks.onStepAdvance) {
      curveContract.on('StepAdvanced', (step: ethers.BigNumber, price: ethers.BigNumber) => {
        callbacks.onStepAdvance!(step.toNumber(), ethers.formatEther(price))
      })
    }
    
    if (callbacks.onGraduation) {
      curveContract.on('Graduated', (tokensSold: ethers.BigNumber, ogReserve: ethers.BigNumber, timestamp: ethers.BigNumber) => {
        callbacks.onGraduation!(
          tokensSold.toString(),
          ethers.formatEther(ogReserve),
          timestamp.toNumber()
        )
      })
    }
    
    console.log(`👂 Listening for curve events on ${curveAddress}...`)
  }

  // Stop listening for events
  async stopListening(curveAddress: string) {
    if (!this.provider) {
      return
    }
    
    const curveContract = new ethers.Contract(curveAddress, BONDING_CURVE_ABI, this.provider)
    curveContract.removeAllListeners()
    console.log(`🔇 Stopped listening for curve events on ${curveAddress}`)
  }

  // Get service status
  getStatus(): { initialized: boolean } {
    return {
      initialized: !!this.signer
    }
  }
}

// Export singleton instance
export const bondingCurveTradingService = new BondingCurveTradingService()
