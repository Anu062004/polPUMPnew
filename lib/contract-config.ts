/**
 * Centralized contract configuration for POL Pump on Polygon Amoy
 * Update these addresses after deploying contracts to Polygon Amoy testnet
 */

export const CONTRACT_CONFIG = {
  // Factory contract for creating token + bonding curve pairs
  // Deploy using: scripts/deployAppFactoryPolygonAmoy.js
  // Deployed: 2025-11-06 to Polygon Amoy
  FACTORY_ADDRESS: process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x0Bd71a034D5602014206B965677E83C6484561F2',
  
  // Treasury address (receives trading fees)
  // Same as deployer address: 0x2dC274ABC0df37647CEd9212e751524708a68996
  TREASURY_ADDRESS: process.env.NEXT_PUBLIC_TREASURY_ADDRESS || '0x2dC274ABC0df37647CEd9212e751524708a68996',
  
  // Default fee in basis points (50 = 0.5%)
  DEFAULT_FEE_BPS: 50,
  
  // DEX Contracts (UniswapV2 fork for legacy trading)
  // Deployed: 2025-11-06 to Polygon Amoy
  UNISWAP_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_UNISWAP_FACTORY_ADDRESS || '0x1Aa3fCC63f08103b20d8F34BaD6aE59dc6B10e45',
  ROUTER_ADDRESS: process.env.NEXT_PUBLIC_ROUTER_ADDRESS || '0xcC33bc5336A2D99515A916A52664ecdb761e79c5',
  WETH_ADDRESS: process.env.NEXT_PUBLIC_WETH_ADDRESS || '0x0D94Dec8cE5792A86E4b95aF2E516c0A70042Aa1',
  
  // Auto Trading Factory (optional, for automatic pool creation)
  AUTO_TRADING_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_AUTO_TRADING_FACTORY_ADDRESS || '0xA01CD368F39956ce09e538ed731D685b60Ea68eb',
  
  // PumpFun Factory (pump.fun-style bonding curve)
  PUMPFUN_FACTORY_ADDRESS: process.env.NEXT_PUBLIC_PUMPFUN_FACTORY_ADDRESS || '',
  
  // Default bonding curve parameters
  DEFAULT_BASE_PRICE: process.env.NEXT_PUBLIC_DEFAULT_BASE_PRICE || '0.0001', // 0.0001 MATIC per token
  DEFAULT_PRICE_INCREMENT: process.env.NEXT_PUBLIC_DEFAULT_PRICE_INCREMENT || '0.0000001', // Linear increment
  DEFAULT_GROWTH_RATE_BPS: process.env.NEXT_PUBLIC_DEFAULT_GROWTH_RATE_BPS || '100', // 1% for exponential
  DEFAULT_USE_EXPONENTIAL: process.env.NEXT_PUBLIC_DEFAULT_USE_EXPONENTIAL === 'true' || false,
  DEFAULT_MAX_SUPPLY: process.env.NEXT_PUBLIC_DEFAULT_MAX_SUPPLY || '1000000', // 1M tokens max
  
  // Network configuration
  NETWORK: 'polygon-amoy-testnet',
  CHAIN_ID: 80002,
  RPC_URL: process.env.NEXT_PUBLIC_EVM_RPC || process.env.POLYGON_AMOY_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f',
  
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

