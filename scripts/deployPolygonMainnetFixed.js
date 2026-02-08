/**
 * Deploy PolPUMP contracts to Polygon Mainnet
 * Fixed version with better gas estimation and timeout handling
 * 
 * Usage:
 * npx hardhat run scripts/deployPolygonMainnetFixed.js --network polygon
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying PolPUMP to Polygon Mainnet (Fixed Version)...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);
  
  // Check balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "MATIC");
  
  if (balance < ethers.parseEther("0.5")) {
    console.error("❌ Insufficient balance! Need at least 0.5 MATIC");
    process.exit(1);
  }

  // Get current gas price and add 20% buffer for faster confirmation
  const feeData = await deployer.provider.getFeeData();
  const gasPrice = feeData.gasPrice;
  const adjustedGasPrice = gasPrice * 120n / 100n; // 20% higher
  console.log("⛽ Current gas price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei");
  console.log("⛽ Using gas price:", ethers.formatUnits(adjustedGasPrice, "gwei"), "Gwei (with 20% buffer)");

  // Deployment configuration
  const deployConfig = {
    treasury: deployer.address,
    defaultFeeBps: 50, // 0.5% fee
  };

  console.log("🔧 Deployment configuration:", deployConfig);

  const deployedContracts = {};
  const deploymentOptions = {
    gasPrice: adjustedGasPrice,
  };

  try {
    // 1. Deploy Factory Contract
    console.log("\n1️⃣ Deploying Factory Contract...");
    const FactoryContract = await ethers.getContractFactory("Factory");
    console.log("   📤 Sending transaction...");
    const factory = await FactoryContract.deploy(
      deployConfig.treasury,
      deployConfig.defaultFeeBps,
      deploymentOptions
    );
    console.log("   ⏳ Waiting for confirmation (tx:", factory.deploymentTransaction().hash, ")...");
    await factory.waitForDeployment();
    
    const factoryAddress = await factory.getAddress();
    deployedContracts.FACTORY_ADDRESS = factoryAddress;
    console.log("   ✅ Factory deployed at:", factoryAddress);

    // 2. Deploy Enhanced Factory (if exists)
    try {
      console.log("\n2️⃣ Deploying Enhanced Factory...");
      const EnhancedFactoryContract = await ethers.getContractFactory("EnhancedFactory");
      console.log("   📤 Sending transaction...");
      const enhancedFactory = await EnhancedFactoryContract.deploy(
        deployConfig.treasury,
        deployConfig.defaultFeeBps,
        deploymentOptions
      );
      console.log("   ⏳ Waiting for confirmation (tx:", enhancedFactory.deploymentTransaction().hash, ")...");
      await enhancedFactory.waitForDeployment();
      
      const enhancedFactoryAddress = await enhancedFactory.getAddress();
      deployedContracts.ENHANCED_FACTORY_ADDRESS = enhancedFactoryAddress;
      console.log("   ✅ Enhanced Factory deployed at:", enhancedFactoryAddress);
    } catch (error) {
      console.log("   ⚠️  Enhanced Factory deployment failed:", error.message);
    }

    // 3. Deploy PumpFun Factory (if exists)
    try {
      console.log("\n3️⃣ Deploying PumpFun Factory...");
      const PumpFunFactoryContract = await ethers.getContractFactory("PumpFunFactory");
      console.log("   📤 Sending transaction...");
      const pumpFunFactory = await PumpFunFactoryContract.deploy(
        deployConfig.treasury,
        ethers.parseEther("0.0001"), // basePrice
        ethers.parseEther("0.0000001"), // priceIncrement
        deploymentOptions
      );
      console.log("   ⏳ Waiting for confirmation (tx:", pumpFunFactory.deploymentTransaction().hash, ")...");
      await pumpFunFactory.waitForDeployment();
      
      const pumpFunFactoryAddress = await pumpFunFactory.getAddress();
      deployedContracts.PUMPFUN_FACTORY_ADDRESS = pumpFunFactoryAddress;
      console.log("   ✅ PumpFun Factory deployed at:", pumpFunFactoryAddress);
    } catch (error) {
      console.log("   ⚠️  PumpFun Factory deployment failed:", error.message);
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
    };

    // Save to JSON file
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, "polygon-mainnet-deployment.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("📋 DEPLOYMENT SUMMARY");
    console.log("=".repeat(60));
    console.log("Network: Polygon Mainnet (137)");
    console.log("Deployer:", deployer.address);
    console.log("Treasury:", deployConfig.treasury);
    console.log("\n📄 Contract Addresses:");
    
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`  ${name}: ${address}`);
    });

    console.log("\n🔧 Environment Variables for .env:");
    console.log("=".repeat(60));
    Object.entries(deployedContracts).forEach(([name, address]) => {
      console.log(`NEXT_PUBLIC_${name}=${address}`);
    });

    console.log("\n✅ Deployment completed successfully!");
    console.log(`📁 Deployment info saved to: ${deploymentFile}`);

    // Check remaining balance
    const remainingBalance = await deployer.provider.getBalance(deployer.address);
    const gasUsed = balance - remainingBalance;
    console.log("\n💰 Gas used:", ethers.formatEther(gasUsed), "MATIC");
    console.log("💰 Remaining balance:", ethers.formatEther(remainingBalance), "MATIC");

  } catch (error) {
    console.error("\n❌ Deployment failed:", error.message);
    if (error.transaction) {
      console.error("Transaction hash:", error.transaction.hash);
    }
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });







