/**
 * Deploy remaining PolPUMP contracts to Polygon Mainnet
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying Remaining PolPUMP Contracts...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MATIC\n");

  // Get gas price with buffer
  const feeData = await deployer.provider.getFeeData();
  const gasPrice = feeData.gasPrice * 150n / 100n;
  console.log("⛽ Using gas price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei\n");

  const deployConfig = {
    treasury: deployer.address,
    defaultFeeBps: 50,
    basePrice: ethers.parseEther("0.0001"),
    priceIncrement: ethers.parseEther("0.0000001"),
    growthRateBps: 100,
    useExponential: false,
  };

  const deployedContracts = {
    FACTORY_ADDRESS: "0x086de5895811550D9118112B6477F61462fe7b34", // Already deployed
    TREASURY_ADDRESS: deployer.address,
  };

  try {
    // Deploy Enhanced Factory
    console.log("1️⃣ Deploying Enhanced Factory...");
    const EnhancedFactory = await ethers.getContractFactory("EnhancedFactory");
    
    // FeeSplit struct: platformFeeBps, creatorFeeBps, burnFeeBps, lpFeeBps
    const feeSplit = {
      platformFeeBps: 30,   // 0.3% platform
      creatorFeeBps: 10,    // 0.1% creator
      burnFeeBps: 5,        // 0.05% burn
      lpFeeBps: 5,          // 0.05% LP
    };
    
    const enhancedFactory = await EnhancedFactory.deploy(
      deployConfig.treasury,
      deployConfig.defaultFeeBps,
      feeSplit,
      { gasPrice }
    );
    
    console.log("   📤 TX:", enhancedFactory.deploymentTransaction().hash);
    console.log("   ⏳ Waiting for confirmation...");
    await enhancedFactory.waitForDeployment();
    
    const enhancedAddress = await enhancedFactory.getAddress();
    console.log("   ✅ Enhanced Factory:", enhancedAddress);
    deployedContracts.ENHANCED_FACTORY_ADDRESS = enhancedAddress;

    // Deploy PumpFun Factory
    console.log("\n2️⃣ Deploying PumpFun Factory...");
    const PumpFunFactory = await ethers.getContractFactory("PumpFunFactory");
    
    const pumpFunFactory = await PumpFunFactory.deploy(
      deployConfig.treasury,
      deployConfig.defaultFeeBps,
      deployConfig.basePrice,
      deployConfig.priceIncrement,
      deployConfig.growthRateBps,
      deployConfig.useExponential,
      { gasPrice }
    );
    
    console.log("   📤 TX:", pumpFunFactory.deploymentTransaction().hash);
    console.log("   ⏳ Waiting for confirmation...");
    await pumpFunFactory.waitForDeployment();
    
    const pumpFunAddress = await pumpFunFactory.getAddress();
    console.log("   ✅ PumpFun Factory:", pumpFunAddress);
    deployedContracts.PUMPFUN_FACTORY_ADDRESS = pumpFunAddress;

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
      contracts: deployedContracts,
    };

    fs.writeFileSync(
      path.join(deploymentsDir, "polygon-mainnet-deployment.json"),
      JSON.stringify(deployment, null, 2)
    );

    // Print summary
    console.log("\n" + "=".repeat(60));
    console.log("✅ ALL CONTRACTS DEPLOYED!");
    console.log("=".repeat(60));
    Object.entries(deployedContracts).forEach(([name, addr]) => {
      console.log(`NEXT_PUBLIC_${name}=${addr}`);
    });
    console.log("=".repeat(60));

    const finalBalance = await deployer.provider.getBalance(deployer.address);
    console.log("\n💰 Total gas spent:", ethers.formatEther(balance - finalBalance), "MATIC");
    console.log("💰 Remaining:", ethers.formatEther(finalBalance), "MATIC");

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    if (error.data) console.error("   Data:", error.data);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
