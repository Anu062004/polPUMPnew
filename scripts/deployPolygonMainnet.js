/**
 * Deploy PolPUMP contracts to Polygon Mainnet
 * 
 * Usage:
 * npx hardhat run scripts/deployPolygonMainnet.js --network polygon
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying PolPUMP to Polygon Mainnet...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "MATIC");
  
  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Low balance! Make sure you have enough MATIC for gas fees.");
  }

  // Deployment configuration
  const deployConfig = {
    treasury: deployer.address, // Treasury receives fees
    defaultFeeBps: 50, // 0.5% fee
    basePrice: ethers.parseEther("0.0001"), // 0.0001 MATIC per token
    priceIncrement: ethers.parseEther("0.0000001"), // Linear increment
  };

  console.log("🔧 Deployment configuration:", deployConfig);

  const deployedContracts = {};

  try {
    // 1. Deploy Factory Contract
    console.log("\n1️⃣ Deploying Factory Contract...");
    const FactoryContract = await ethers.getContractFactory("Factory");
    const factory = await FactoryContract.deploy(
      deployConfig.treasury,
      deployConfig.defaultFeeBps
    );
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    deployedContracts.FACTORY_ADDRESS = factoryAddress;
    console.log("✅ Factory deployed at:", factoryAddress);

    // 2. Deploy Enhanced Factory (if exists)
    try {
      console.log("\n2️⃣ Deploying Enhanced Factory...");
      const EnhancedFactoryContract = await ethers.getContractFactory("EnhancedFactory");
      const enhancedFactory = await EnhancedFactoryContract.deploy(
        deployConfig.treasury,
        deployConfig.defaultFeeBps
      );
      await enhancedFactory.waitForDeployment();
      
      const enhancedFactoryAddress = await enhancedFactory.getAddress();
      deployedContracts.ENHANCED_FACTORY_ADDRESS = enhancedFactoryAddress;
      console.log("✅ Enhanced Factory deployed at:", enhancedFactoryAddress);
    } catch (error) {
      console.log("⚠️  Enhanced Factory not found, skipping...");
    }

    // 3. Deploy DEX Contracts (UniswapV2 fork)
    console.log("\n3️⃣ Deploying DEX Contracts...");
    
    // Deploy WETH (Wrapped MATIC)
    try {
      const WETHContract = await ethers.getContractFactory("WETH");
      const weth = await WETHContract.deploy();
      await weth.waitForDeployment();
      
      const wethAddress = await weth.getAddress();
      deployedContracts.WETH_ADDRESS = wethAddress;
      console.log("✅ WETH deployed at:", wethAddress);
      
      // Deploy UniswapV2Factory
      const UniswapFactoryContract = await ethers.getContractFactory("UniswapV2Factory");
      const uniswapFactory = await UniswapFactoryContract.deploy(deployer.address);
      await uniswapFactory.waitForDeployment();
      
      const uniswapFactoryAddress = await uniswapFactory.getAddress();
      deployedContracts.UNISWAP_FACTORY_ADDRESS = uniswapFactoryAddress;
      console.log("✅ UniswapV2Factory deployed at:", uniswapFactoryAddress);
      
      // Deploy UniswapV2Router
      const RouterContract = await ethers.getContractFactory("UniswapV2Router02");
      const router = await RouterContract.deploy(uniswapFactoryAddress, wethAddress);
      await router.waitForDeployment();
      
      const routerAddress = await router.getAddress();
      deployedContracts.ROUTER_ADDRESS = routerAddress;
      console.log("✅ UniswapV2Router deployed at:", routerAddress);
      
    } catch (error) {
      console.log("⚠️  DEX contracts not found, skipping...");
      console.log("💡 You may need to deploy DEX contracts separately or use existing ones");
    }

    // 4. Deploy Auto Trading Factory (if exists)
    try {
      console.log("\n4️⃣ Deploying Auto Trading Factory...");
      const AutoTradingFactoryContract = await ethers.getContractFactory("AutoTradingFactory");
      const autoTradingFactory = await AutoTradingFactoryContract.deploy();
      await autoTradingFactory.waitForDeployment();
      
      const autoTradingFactoryAddress = await autoTradingFactory.getAddress();
      deployedContracts.AUTO_TRADING_FACTORY_ADDRESS = autoTradingFactoryAddress;
      console.log("✅ Auto Trading Factory deployed at:", autoTradingFactoryAddress);
    } catch (error) {
      console.log("⚠️  Auto Trading Factory not found, skipping...");
    }

    // 5. Deploy PumpFun Factory (if exists)
    try {
      console.log("\n5️⃣ Deploying PumpFun Factory...");
      const PumpFunFactoryContract = await ethers.getContractFactory("PumpFunFactory");
      const pumpFunFactory = await PumpFunFactoryContract.deploy(
        deployConfig.treasury,
        deployConfig.basePrice,
        deployConfig.priceIncrement
      );
      await pumpFunFactory.waitForDeployment();
      
      const pumpFunFactoryAddress = await pumpFunFactory.getAddress();
      deployedContracts.PUMPFUN_FACTORY_ADDRESS = pumpFunFactoryAddress;
      console.log("✅ PumpFun Factory deployed at:", pumpFunFactoryAddress);
    } catch (error) {
      console.log("⚠️  PumpFun Factory not found, skipping...");
    }

    // Add treasury address
    deployedContracts.TREASURY_ADDRESS = deployConfig.treasury;

    // Save deployment info
    const deploymentInfo = {
      network: "polygon-mainnet",
      chainId: 137,
      deployer: deployer.address,
      deployedAt: new Date().toISOString(),
      contracts: deployedContracts,
      gasUsed: "TBD", // Will be calculated if needed
    };

    // Save to JSON file
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, "polygon-mainnet-deployment.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    // Generate .env file content
    console.log("\n📋 DEPLOYMENT SUMMARY");
    console.log("=" .repeat(50));
    console.log("Network: Polygon Mainnet (137)");
    console.log("Deployer:", deployer.address);
    console.log("Treasury:", deployConfig.treasury);
    console.log("\n📄 Contract Addresses:");
    
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`${name}: ${address}`);
    });

    console.log("\n🔧 Environment Variables for .env:");
    console.log("=" .repeat(50));
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`NEXT_PUBLIC_${name}=${address}`);
    });

    console.log("\n✅ Deployment completed successfully!");
    console.log(`📁 Deployment info saved to: ${deploymentFile}`);
    
    console.log("\n🔍 Next Steps:");
    console.log("1. Update your .env file with the contract addresses above");
    console.log("2. Verify contracts on PolygonScan:");
    console.log("   npx hardhat verify --network polygon <CONTRACT_ADDRESS>");
    console.log("3. Update frontend configuration");
    console.log("4. Test the deployment");

  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });



