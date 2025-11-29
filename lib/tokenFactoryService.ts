import { ethers } from 'ethers'
import { ogStorageSDK } from './0gStorageSDK'

// TokenFactory ABI
const TOKEN_FACTORY_ABI = [
  'function createToken(string name, string symbol, string metadataURI, uint256 basePrice, uint256 stepSize, uint256 stepQty, uint256 curveCap, uint256 feeBps) external payable returns (address tokenAddr, address curveAddr)',
  'function createTokenWithDefaults(string name, string symbol, string metadataURI) external payable returns (address tokenAddr, address curveAddr)',
  'function getAllTokens() external view returns (address[])',
  'function getCurveForToken(address token) external view returns (address)',
  'function getTokenMetadata(address token) external view returns (string)',
  'function getTokenInfo(address token) external view returns (address curve, string metadataURI, bool exists)',
  'event TokenCreated(address indexed token, address indexed creator, string metadataURI, uint256 initialPrice)'
]

export interface TokenCreationParams {
  name: string
  symbol: string
  description: string
  imageFile?: File
  basePrice?: string
  stepSize?: string
  stepQty?: string
  curveCap?: string
  feeBps?: string
  useDefaults?: boolean
}

export interface TokenCreationResult {
  success: boolean
  tokenAddress?: string
  curveAddress?: string
  metadataURI?: string
  txHash?: string
  error?: string
}

export interface TokenInfo {
  tokenAddress: string
  curveAddress?: string
  creator: string
  metadataURI: string
  initialPrice: string
  name?: string
  symbol?: string
  totalSupply?: string
  createdAt: Date
  tradingMode: 'curve' | 'graduated' | 'unknown'
}

class TokenFactoryService {
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null
  private factoryContract: ethers.Contract | null = null
  private factoryAddress: string = ''

  // Initialize the service
  async initialize(
    provider: ethers.providers.Web3Provider,
    factoryAddress: string
  ) {
    this.provider = provider
    this.signer = provider.getSigner()
    this.factoryAddress = factoryAddress

    // Initialize factory contract
    this.factoryContract = new ethers.Contract(
      factoryAddress,
      TOKEN_FACTORY_ABI,
      this.signer
    )

    // Initialize other services
    await ogStorageSDK.initialize()

    console.log('✅ TokenFactory service initialized')
    console.log(`🏭 Factory address: ${factoryAddress}`)
  }

  // Create a new token with storage integration
  async createToken(params: TokenCreationParams): Promise<TokenCreationResult> {
    try {
      console.log(`🪙 Creating token: ${params.name} (${params.symbol})`)

      // Step 1: Upload metadata to storage
      let metadataURI = ''
      if (params.imageFile) {
        console.log('📤 Uploading image to storage...')
        
        // Create metadata object
        const metadata = {
          name: params.name,
          symbol: params.symbol,
          description: params.description,
          image: params.imageFile.name, // Will be updated with actual URI
          external_url: window.location.origin,
          attributes: [
            {
              trait_type: "Network",
              value: "Polygon Amoy"
            },
            {
              trait_type: "Token Type",
              value: "Bonding Curve"
            }
          ]
        }

        // Upload metadata to storage
        const uploadResult = await ogStorageSDK.uploadData(metadata)
        metadataURI = uploadResult.rootHash
        
        console.log(`✅ Metadata uploaded: ${metadataURI}`)
      } else {
        // Create minimal metadata without image
        const metadata = {
          name: params.name,
          symbol: params.symbol,
          description: params.description,
          external_url: window.location.origin
        }
        
        const uploadResult = await ogStorageSDK.uploadData(metadata)
        metadataURI = uploadResult.rootHash
        
        console.log(`✅ Metadata uploaded: ${metadataURI}`)
      }

      // Step 2: Deploy token and curve
      console.log('🚀 Deploying token and curve...')
      
      let tx
      if (params.useDefaults) {
        // Use default curve parameters
        tx = await this.factoryContract!.createTokenWithDefaults(
          params.name,
          params.symbol,
          metadataURI
        )
      } else {
        // Use custom curve parameters
        const basePrice = params.basePrice || ethers.parseEther('0.001').toString()
        const stepSize = params.stepSize || ethers.parseEther('0.000001').toString()
        const stepQty = params.stepQty || '1000'
        const curveCap = params.curveCap || '1000000'
        const feeBps = params.feeBps || '500'

        tx = await this.factoryContract!.createToken(
          params.name,
          params.symbol,
          metadataURI,
          basePrice,
          stepSize,
          stepQty,
          curveCap,
          feeBps
        )
      }

      console.log(`⏳ Transaction sent: ${tx.hash}`)
      
      // Wait for transaction confirmation
      const receipt = await tx.wait()
      console.log(`✅ Transaction confirmed in block ${receipt.blockNumber}`)

      // Step 3: Parse events to get addresses
      const tokenCreatedEvent = receipt.events?.find(
        (event: any) => event.event === 'TokenCreated'
      )

      if (!tokenCreatedEvent) {
        throw new Error('TokenCreated event not found in transaction')
      }

      const { token: tokenAddress, curve: curveAddress } = tokenCreatedEvent.args

      console.log(`✅ Token deployed: ${tokenAddress}`)
      console.log(`📈 Curve deployed: ${curveAddress}`)

      // Step 4: Store token info locally
      const tokenInfo: TokenInfo = {
        tokenAddress,
        curveAddress,
        creator: await this.signer!.getAddress(),
        metadataURI,
        initialPrice: tokenCreatedEvent.args.initialPrice.toString(),
        name: params.name,
        symbol: params.symbol,
        createdAt: new Date(),
        tradingMode: 'curve'
      }

      // Save to local storage
      await ogStorageSDK.saveCoinToLocal({
        id: tokenAddress,
        name: params.name,
        symbol: params.symbol,
        supply: params.curveCap || '1000000',
        description: params.description,
        imageUrl: metadataURI,
        metadataUrl: metadataURI,
        createdAt: tokenInfo.createdAt.toISOString(),
        creator: tokenInfo.creator
      })

      return {
        success: true,
        tokenAddress,
        curveAddress,
        metadataURI,
        txHash: tx.hash
      }

    } catch (error: any) {
      console.error('❌ Token creation failed:', error)
      return {
        success: false,
        error: error.message || 'Failed to create token'
      }
    }
  }

  // Get all tokens created by this factory
  async getAllTokens(): Promise<string[]> {
    if (!this.factoryContract) {
      throw new Error('Service not initialized')
    }

    try {
      const tokens = await this.factoryContract.getAllTokens()
      return tokens.map((token: string) => token.toLowerCase())
    } catch (error) {
      console.error('Error getting all tokens:', error)
      return []
    }
  }

  // Get token info
  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    if (!this.factoryContract) {
      throw new Error('Service not initialized')
    }

    try {
      const info = await this.factoryContract.getTokenInfo(tokenAddress)
      
      if (!info.exists) {
        return null
      }

      // Get additional info from curve if available
      let tradingMode: 'curve' | 'graduated' | 'unknown' = 'unknown'
      if (info.curve) {
        try {
          const curveContract = new ethers.Contract(info.curve, [
            'function graduated() external view returns (bool)'
          ], this.provider!)
          
          const isGraduated = await curveContract.graduated()
          tradingMode = isGraduated ? 'graduated' : 'curve'
        } catch (error) {
          console.warn('Could not determine trading mode:', error)
        }
      }

      return {
        tokenAddress: tokenAddress.toLowerCase(),
        curveAddress: info.curve.toLowerCase(),
        creator: '', // Would need to track this separately
        metadataURI: info.metadataURI,
        initialPrice: '0', // Would need to track this separately
        createdAt: new Date(), // Would need to track this separately
        tradingMode
      }
    } catch (error) {
      console.error('Error getting token info:', error)
      return null
    }
  }

  // Get curve address for a token
  async getCurveForToken(tokenAddress: string): Promise<string | null> {
    if (!this.factoryContract) {
      throw new Error('Service not initialized')
    }

    try {
      const curveAddress = await this.factoryContract.getCurveForToken(tokenAddress)
      return curveAddress === ethers.ZeroAddress ? null : curveAddress.toLowerCase()
    } catch (error) {
      console.error('Error getting curve for token:', error)
      return null
    }
  }

  // Get metadata URI for a token
  async getTokenMetadata(tokenAddress: string): Promise<string | null> {
    if (!this.factoryContract) {
      throw new Error('Service not initialized')
    }

    try {
      const metadataURI = await this.factoryContract.getTokenMetadata(tokenAddress)
      return metadataURI || null
    } catch (error) {
      console.error('Error getting token metadata:', error)
      return null
    }
  }

  // Listen for new token creation events
  async listenForTokenCreation(callback: (tokenInfo: TokenInfo) => void) {
    if (!this.factoryContract) {
      throw new Error('Service not initialized')
    }

    this.factoryContract.on('TokenCreated', async (
      token: string,
      creator: string,
      metadataURI: string,
      initialPrice: ethers.BigNumber,
      event: any
    ) => {
      console.log(`🪙 New token created: ${token}`)
      
      const tokenInfo: TokenInfo = {
        tokenAddress: token.toLowerCase(),
        creator: creator.toLowerCase(),
        metadataURI,
        initialPrice: initialPrice.toString(),
        createdAt: new Date(),
        tradingMode: 'curve'
      }

      callback(tokenInfo)
    })

    console.log('👂 Listening for TokenCreated events...')
  }

  // Get recommended token parameters
  getRecommendedTokenParams(
    name: string,
    symbol: string,
    marketCap?: number
  ): TokenCreationParams {
    // Calculate recommended supply based on market cap
    const recommendedSupply = marketCap ? 
      Math.floor(marketCap / 0.001).toString() : // Assuming 0.001 MATIC starting price
      '1000000' // Default 1M tokens

    return {
      name,
      symbol,
      description: `${name} token on Polygon Amoy testnet`,
      useDefaults: true,
      curveCap: recommendedSupply
    }
  }

  // Validate token parameters
  validateTokenParams(params: TokenCreationParams): { valid: boolean; errors: string[] } {
    const errors = []

    if (!params.name || params.name.length < 1) {
      errors.push('Token name is required')
    }

    if (!params.symbol || params.symbol.length < 1) {
      errors.push('Token symbol is required')
    }

    if (!params.description || params.description.length < 1) {
      errors.push('Token description is required')
    }

    if (params.symbol && params.symbol.length > 10) {
      errors.push('Token symbol must be 10 characters or less')
    }

    if (params.name && params.name.length > 50) {
      errors.push('Token name must be 50 characters or less')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Get service status
  getStatus(): { initialized: boolean; factoryAddress: string } {
    return {
      initialized: !!this.factoryContract,
      factoryAddress: this.factoryAddress
    }
  }
}

// Export singleton instance
export const tokenFactoryService = new TokenFactoryService()
