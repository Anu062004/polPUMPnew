/**
 * Deployment script for PumpFunFactory and BondingCurvePool
 * 
 * Usage (from 0gPump directory):
 *   npx hardhat run scripts/deployPumpFunFactory.js --network polygon-amoy
 * 
 * Or with environment variables:
 *   TREASURY_ADDRESS=0x... DEFAULT_FEE_BPS=50 npx hardhat run scripts/deployPumpFunFactory.js --network polygon-amoy
 * 
 * Make sure you have:
 * 1. PRIVATE_KEY in your .env file (or environment)
 * 2. Run from the 0gPump directory (where hardhat.config.js is located)
 */

const hre = require('hardhat')
const fs = require('fs')
const path = require('path')

async function main() {
  console.log('🚀 Deploying PumpFun Factory...\n')

  const [deployer] = await hre.ethers.getSigners()
  console.log('📝 Deploying with account:', deployer.address)
  console.log('💰 Account balance:', hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), 'MATIC\n')

  // Configuration
  const TREASURY_ADDRESS = process.env.TREASURY_ADDRESS || deployer.address
  const DEFAULT_FEE_BPS = parseInt(process.env.DEFAULT_FEE_BPS || '50') // 0.5%
  const DEFAULT_BASE_PRICE = hre.ethers.parseEther(process.env.DEFAULT_BASE_PRICE || '0.0001') // 0.0001 MATIC
  const DEFAULT_PRICE_INCREMENT = hre.ethers.parseEther(process.env.DEFAULT_PRICE_INCREMENT || '0.0000001') // Linear increment
  const DEFAULT_GROWTH_RATE_BPS = parseInt(process.env.DEFAULT_GROWTH_RATE_BPS || '100') // 1% for exponential
  const DEFAULT_USE_EXPONENTIAL = process.env.DEFAULT_USE_EXPONENTIAL === 'true' || false

  console.log('📋 Configuration:')
  console.log('  Treasury:', TREASURY_ADDRESS)
  console.log('  Default Fee:', DEFAULT_FEE_BPS, 'bps (', DEFAULT_FEE_BPS / 100, '%)')
  console.log('  Default Base Price:', hre.ethers.formatEther(DEFAULT_BASE_PRICE), 'MATIC')
  console.log('  Default Price Increment:', hre.ethers.formatEther(DEFAULT_PRICE_INCREMENT), 'MATIC')
  console.log('  Default Growth Rate:', DEFAULT_GROWTH_RATE_BPS, 'bps (', DEFAULT_GROWTH_RATE_BPS / 100, '%)')
  console.log('  Use Exponential:', DEFAULT_USE_EXPONENTIAL, '\n')

  // Deploy PumpFunFactory
  console.log('📦 Deploying PumpFunFactory...')
  const PumpFunFactory = await hre.ethers.getContractFactory('PumpFunFactory')
  const factory = await PumpFunFactory.deploy(
    TREASURY_ADDRESS,
    DEFAULT_FEE_BPS,
    DEFAULT_BASE_PRICE,
    DEFAULT_PRICE_INCREMENT,
    DEFAULT_GROWTH_RATE_BPS,
    DEFAULT_USE_EXPONENTIAL
  )

  await factory.waitForDeployment()
  const factoryAddress = await factory.getAddress()

  console.log('✅ PumpFunFactory deployed to:', factoryAddress)
  console.log('⏳ Waiting for confirmations...\n')

  // Wait for a few block confirmations
  await factory.deploymentTransaction()?.wait(3)

  // Verify deployment
  console.log('🔍 Verifying deployment...')
  const treasury = await factory.treasury()
  const defaultFeeBps = await factory.defaultFeeBps()
  const defaultBasePrice = await factory.defaultBasePrice()

  console.log('✅ Verification:')
  console.log('  Treasury:', treasury)
  console.log('  Default Fee:', defaultFeeBps.toString(), 'bps')
  console.log('  Default Base Price:', hre.ethers.formatEther(defaultBasePrice), 'MATIC\n')

  // Save deployment info
  const deploymentInfo = {
    network: hre.network.name,
    chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    deploymentTime: new Date().toISOString(),
    contracts: {
      PumpFunFactory: {
        address: factoryAddress,
        treasury: TREASURY_ADDRESS,
        defaultFeeBps: DEFAULT_FEE_BPS,
        defaultBasePrice: hre.ethers.formatEther(DEFAULT_BASE_PRICE),
        defaultPriceIncrement: hre.ethers.formatEther(DEFAULT_PRICE_INCREMENT),
        defaultGrowthRateBps: DEFAULT_GROWTH_RATE_BPS,
        defaultUseExponential: DEFAULT_USE_EXPONENTIAL
      }
    }
  }

  const deploymentPath = path.join(__dirname, '..', 'deployments', `pumpfun-${hre.network.name}.json`)
  const deploymentDir = path.dirname(deploymentPath)
  
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true })
  }

  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2))
  console.log('💾 Deployment info saved to:', deploymentPath)

  // Generate frontend config snippet
  const frontendConfig = `
// PumpFun Factory Configuration
// Generated: ${new Date().toISOString()}
export const PUMPFUN_CONFIG = {
  FACTORY_ADDRESS: '${factoryAddress}',
  TREASURY_ADDRESS: '${TREASURY_ADDRESS}',
  DEFAULT_FEE_BPS: ${DEFAULT_FEE_BPS},
  DEFAULT_BASE_PRICE: '${hre.ethers.formatEther(DEFAULT_BASE_PRICE)}',
  DEFAULT_PRICE_INCREMENT: '${hre.ethers.formatEther(DEFAULT_PRICE_INCREMENT)}',
  DEFAULT_GROWTH_RATE_BPS: ${DEFAULT_GROWTH_RATE_BPS},
  DEFAULT_USE_EXPONENTIAL: ${DEFAULT_USE_EXPONENTIAL},
  NETWORK: '${hre.network.name}',
  CHAIN_ID: ${(await hre.ethers.provider.getNetwork()).chainId}
}
`

  console.log('\n📋 Frontend Configuration:')
  console.log(frontendConfig)
  console.log('\n✅ Deployment complete!')
  console.log('\n💡 Next steps:')
  console.log('1. Update NEXT_PUBLIC_PUMPFUN_FACTORY_ADDRESS in your .env.local')
  console.log('2. Update lib/contract-config.ts with the factory address')
  console.log('3. Test token creation: factory.createToken(name, symbol, maxSupply)')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error)
    process.exit(1)
  })

