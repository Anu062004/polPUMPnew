/**
 * Centralized contract configuration for POL Pump
 * Supports both Polygon Mainnet and Amoy Testnet
 * Update these addresses after deploying contracts
 */

// Determine network based on environment
const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'polygon'

export const CONTRACT_CONFIG = {
  // Factory contract for creating token + bonding curve pairs
  // Deployed: 2026-01-24 to Polygon Mainnet
  FACTORY_ADDRESS: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69',
  
  // Enhanced Factory with advanced features
  // Deployed: 2026-01-24 to Polygon Mainnet
  ENHANCED_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_ENHANCED_FACTORY_ADDRESS || '0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76',
  
  // Treasury address (receives trading fees)
  TREASURY_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '0x1aB7d5eCBe2c551eBfFdfA06661B77cc60dbd425',
  
  // Default fee in basis points (50 = 0.5%)
  DEFAULT_FEE_BPS: 50,
  
  // DEX Contracts (UniswapV2 fork for trading)
  // Deployed: 2026-01-24 to Polygon Mainnet
  UNISWAP_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_UNISWAP_FACTORY_ADDRESS || '0x297dcec928893bf73C8b9c22dB3Efa2143E0dE53',
  ROUTER_ADDRESS: process.env.NEXT_PUBLIC_ROUTER_ADDRESS || '0xE23469d5aFb586B8c45D669958Ced489ee9Afb09',
  WETH_ADDRESS: process.env.NEXT_PUBLIC_WETH_ADDRESS || '0xFd84545E34762943E29Ab17f98815280c4a90Cb6',
  
  // Auto Trading Factory (for automatic pool creation)
  // Deployed: 2026-01-24 to Polygon Mainnet
  AUTO_TRADING_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_AUTO_TRADING_FACTORY_ADDRESS || '0x46B7ae01b3e53ad77Df82867d24a87610B0780b4',
  
  // PumpFun Factory (pump.fun-style bonding curve)
  // Deployed: 2026-01-24 to Polygon Mainnet
  PUMPFUN_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_PUMPFUN_FACTORY_ADDRESS || '0xa214AE0b2C9A3062208c82faCA879e766558dc15',
  
  // Default bonding curve parameters
  DEFAULT_BASE_PRICE: process.env.NEXT_PUBLIC_DEFAULT_BASE_PRICE || '0.0001', // 0.0001 MATIC per token
  DEFAULT_PRICE_INCREMENT: process.env.NEXT_PUBLIC_DEFAULT_PRICE_INCREMENT || '0.0000001', // Linear increment
  DEFAULT_GROWTH_RATE_BPS: process.env.NEXT_PUBLIC_DEFAULT_GROWTH_RATE_BPS || '100', // 1% for exponential
  DEFAULT_USE_EXPONENTIAL: process.env.NEXT_PUBLIC_DEFAULT_USE_EXPONENTIAL === 'true' || false,
  DEFAULT_MAX_SUPPLY: process.env.NEXT_PUBLIC_DEFAULT_MAX_SUPPLY || '1000000', // 1M tokens max
  
  // Network configuration (dynamic based on environment)
  get NETWORK() {
    return isMainnet ? 'polygon-mainnet' : 'polygon-amoy-testnet'
  },
  get CHAIN_ID() {
    return isMainnet ? 137 : 80002
  },
  // RPC URL configuration
  get RPC_URL() {
    if (isMainnet) {
      const url = process.env.NEXT_PUBLIC_EVM_RPC || process.env.POLYGON_RPC_URL
      if (!url) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('NEXT_PUBLIC_EVM_RPC or POLYGON_RPC_URL must be set for Polygon Mainnet')
        }
        console.warn('⚠️ Mainnet RPC URL not configured, using public node.')
        return 'https://polygon-rpc.com'
      }
      return url
    } else {
      const url = process.env.NEXT_PUBLIC_EVM_RPC || 
                  process.env.POLYGON_AMOY_RPC || 
                  process.env.RPC_URL
      if (!url) {
        console.warn('⚠️ Testnet RPC URL not configured, using public node.')
        return 'https://polygon-amoy.publicnode.com'
      }
      return url
    }
  },
  
  // Contract ABIs are imported from lib/abis.ts
}

/**
 * Verify that the factory contract is deployed and accessible
 */
export async function verifyFactoryContract(provider: any): Promise<boolean> {
  try {
    const { ethers } = await import('ethers')
    const FACTORY_ABI = [
      'function treasury() view returns (address)',
      'function defaultFeeBps() view returns (uint16)'
    ]
    
    const factory = new ethers.Contract(
      CONTRACT_CONFIG.FACTORY_ADDRESS,
      FACTORY_ABI,
      provider
    )
    
    const treasury = await factory.treasury()
    const feeBps = await factory.defaultFeeBps()
    
    console.log('✅ Factory contract verified:', {
      address: CONTRACT_CONFIG.FACTORY_ADDRESS,
      treasury,
      feeBps: feeBps.toString()
    })
    
    return true
  } catch (error: any) {
    console.error('❌ Factory contract verification failed:', error.message)
    return false
  }
}

