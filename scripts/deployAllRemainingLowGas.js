/**
 * Deploy ALL remaining PolPUMP contracts at lowest gas price
 * Deploys: DEX contracts + Optional contracts
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying ALL Remaining Contracts (Low Gas Mode)...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MATIC");

  // Use minimum gas price (current price without buffer)
  const feeData = await deployer.provider.getFeeData();
  const minGasPrice = feeData.gasPrice; // No buffer for lowest cost
  console.log("⛽ Using minimum gas price:", ethers.formatUnits(minGasPrice, "gwei"), "Gwei\n");

  const deployConfig = {
    treasury: deployer.address,
    defaultFeeBps: 50,
  };

  const deployedContracts = {
    FACTORY_ADDRESS: "0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69", // Already deployed
    ENHANCED_FACTORY_ADDRESS: "0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76", // Already deployed
    PUMPFUN_FACTORY_ADDRESS: "0xa214AE0b2C9A3062208c82faCA879e766558dc15", // Already deployed
    TREASURY_ADDRESS: deployer.address,
  };

  const deploymentOptions = {
    gasPrice: minGasPrice,
  };

  try {
    // ============================================
    // CRITICAL DEX CONTRACTS
    // ============================================
    console.log("=".repeat(60));
    console.log("🔴 CRITICAL: Deploying DEX Contracts");
    console.log("=".repeat(60));

    // 1. Deploy WETH (Wrapped MATIC)
    console.log("\n1️⃣ Deploying WETH (Wrapped MATIC)...");
    try {
      const WETH = await ethers.getContractFactory("WETH9");
      const weth = await WETH.deploy(deploymentOptions);
      console.log("   📤 TX:", weth.deploymentTransaction().hash);
      console.log("   ⏳ Waiting...");
      await weth.waitForDeployment();
      const wethAddress = await weth.getAddress();
      deployedContracts.WETH_ADDRESS = wethAddress;
      console.log("   ✅ WETH:", wethAddress);
    } catch (error) {
      console.log("   ⚠️  WETH deployment failed:", error.message);
    }

    // 2. Deploy UniswapV2Factory
    console.log("\n2️⃣ Deploying UniswapV2Factory...");
    try {
      const UniswapFactory = await ethers.getContractFactory("UniswapV2Factory");
      const uniswapFactory = await UniswapFactory.deploy(
        deployer.address, // feeToSetter
        deploymentOptions
      );
      console.log("   📤 TX:", uniswapFactory.deploymentTransaction().hash);
      console.log("   ⏳ Waiting...");
      await uniswapFactory.waitForDeployment();
      const uniswapFactoryAddress = await uniswapFactory.getAddress();
      deployedContracts.UNISWAP_FACTORY_ADDRESS = uniswapFactoryAddress;
      console.log("   ✅ UniswapV2Factory:", uniswapFactoryAddress);
    } catch (error) {
      console.log("   ⚠️  UniswapV2Factory deployment failed:", error.message);
    }

    // 3. Deploy UniswapV2Router02
    console.log("\n3️⃣ Deploying UniswapV2Router02...");
    try {
      if (!deployedContracts.UNISWAP_FACTORY_ADDRESS || !deployedContracts.WETH_ADDRESS) {
        throw new Error("Factory and WETH must be deployed first");
      }
      const Router = await ethers.getContractFactory("UniswapV2Router02");
      const router = await Router.deploy(
        deployedContracts.UNISWAP_FACTORY_ADDRESS,
        deployedContracts.WETH_ADDRESS,
        deploymentOptions
      );
      console.log("   📤 TX:", router.deploymentTransaction().hash);
      console.log("   ⏳ Waiting...");
      await router.waitForDeployment();
      const routerAddress = await router.getAddress();
      deployedContracts.ROUTER_ADDRESS = routerAddress;
      console.log("   ✅ UniswapV2Router:", routerAddress);
    } catch (error) {
      console.log("   ⚠️  Router deployment failed:", error.message);
    }

    // ============================================
    // OPTIONAL CONTRACTS
    // ============================================
    console.log("\n" + "=".repeat(60));
    console.log("🟡 OPTIONAL: Deploying Additional Contracts");
    console.log("=".repeat(60));

    // 4. Deploy AutoTradingFactory
    console.log("\n4️⃣ Deploying AutoTradingFactory...");
    try {
      const AutoTradingFactory = await ethers.getContractFactory("AutoTradingFactory");
      const autoTrading = await AutoTradingFactory.deploy(deploymentOptions);
      console.log("   📤 TX:", autoTrading.deploymentTransaction().hash);
      console.log("   ⏳ Waiting...");
      await autoTrading.waitForDeployment();
      const autoTradingAddress = await autoTrading.getAddress();
      deployedContracts.AUTO_TRADING_FACTORY_ADDRESS = autoTradingAddress;
      console.log("   ✅ AutoTradingFactory:", autoTradingAddress);
    } catch (error) {
      console.log("   ⚠️  AutoTradingFactory failed:", error.message);
    }

    // 5. Deploy GameBank
    console.log("\n5️⃣ Deploying GameBank...");
    try {
      const GameBank = await ethers.getContractFactory("GameBank");
      const gameBank = await GameBank.deploy(deploymentOptions);
      console.log("   📤 TX:", gameBank.deploymentTransaction().hash);
      console.log("   ⏳ Waiting...");
      await gameBank.waitForDeployment();
      const gameBankAddress = await gameBank.getAddress();
      deployedContracts.GAME_BANK_ADDRESS = gameBankAddress;
      console.log("   ✅ GameBank:", gameBankAddress);
    } catch (error) {
      console.log("   ⚠️  GameBank failed:", error.message);
    }

    // 6. Deploy GameRegistry
    console.log("\n6️⃣ Deploying GameRegistry...");
    try {
      const GameRegistry = await ethers.getContractFactory("GameRegistry");
      const gameRegistry = await GameRegistry.deploy(deploymentOptions);
      console.log("   📤 TX:", gameRegistry.deploymentTransaction().hash);
      console.log("   ⏳ Waiting...");
      await gameRegistry.waitForDeployment();
      const gameRegistryAddress = await gameRegistry.getAddress();
      deployedContracts.GAME_REGISTRY_ADDRESS = gameRegistryAddress;
      console.log("   ✅ GameRegistry:", gameRegistryAddress);
    } catch (error) {
      console.log("   ⚠️  GameRegistry failed:", error.message);
    }

    // 7. Deploy TokenMarketplace
    console.log("\n7️⃣ Deploying TokenMarketplace...");
    try {
      const TokenMarketplace = await ethers.getContractFactory("TokenMarketplace");
      const marketplace = await TokenMarketplace.deploy(deploymentOptions);
      console.log("   📤 TX:", marketplace.deploymentTransaction().hash);
      console.log("   ⏳ Waiting...");
      await marketplace.waitForDeployment();
      const marketplaceAddress = await marketplace.getAddress();
      deployedContracts.TOKEN_MARKETPLACE_ADDRESS = marketplaceAddress;
      console.log("   ✅ TokenMarketplace:", marketplaceAddress);
    } catch (error) {
      console.log("   ⚠️  TokenMarketplace failed:", error.message);
    }

    // Save deployment
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deployment = {
      network: "polygon-mainnet",
      chainId: 137,
      deployer: deployer.address,
      timestamp: new Date().toISOString(),
      gasPrice: ethers.formatUnits(minGasPrice, "gwei") + " Gwei",
      contracts: deployedContracts,
    };

    fs.writeFileSync(
      path.join(deploymentsDir, "polygon-mainnet-deployment.json"),
      JSON.stringify(deployment, null, 2)
    );

    // Print summary
    console.log("\n" + "=".repeat(65));
    console.log("🎉 DEPLOYMENT COMPLETE!");
    console.log("=".repeat(65));
    console.log("\n📋 ALL CONTRACT ADDRESSES:\n");
    Object.entries(deployedContracts).forEach(([name, addr]) => {
      if (addr) {
        console.log(`NEXT_PUBLIC_${name}=${addr}`);
      }
    });
    console.log("\n" + "=".repeat(65));

    const finalBalance = await deployer.provider.getBalance(deployer.address);
    const gasUsed = balance - finalBalance;
    console.log("\n💰 Total gas used:", ethers.formatEther(gasUsed), "MATIC");
    console.log("💰 Remaining balance:", ethers.formatEther(finalBalance), "MATIC");
    console.log("⛽ Gas price used:", ethers.formatUnits(minGasPrice, "gwei"), "Gwei");
    console.log("=".repeat(65));

    // Count deployed
    const deployedCount = Object.values(deployedContracts).filter(addr => addr && addr !== deployer.address).length;
    console.log(`\n✅ Successfully deployed ${deployedCount} contracts!`);

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.transaction) {
      console.error("TX:", error.transaction.hash);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);

