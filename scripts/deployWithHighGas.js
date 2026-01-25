/**
 * Deploy PolPUMP with aggressive gas settings
 * Handles pending transactions by replacing them with higher gas
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying PolPUMP to Polygon Mainnet (High Gas Version)...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MATIC");

  // Get current nonce (pending transactions count as used nonces)
  const pendingNonce = await deployer.getNonce("pending");
  const latestNonce = await deployer.getNonce("latest");
  console.log("🔢 Latest nonce:", latestNonce);
  console.log("🔢 Pending nonce:", pendingNonce);

  if (pendingNonce > latestNonce) {
    console.log("⚠️  There are", pendingNonce - latestNonce, "pending transactions");
    console.log("   Will use nonce", latestNonce, "to replace pending tx\n");
  }

  // Get very high gas price
  const feeData = await deployer.provider.getFeeData();
  const baseGasPrice = feeData.gasPrice;
  const highGasPrice = baseGasPrice * 150n / 100n; // 50% higher than current
  console.log("⛽ Current gas price:", ethers.formatUnits(baseGasPrice, "gwei"), "Gwei");
  console.log("⛽ Using gas price:", ethers.formatUnits(highGasPrice, "gwei"), "Gwei (50% buffer)\n");

  const deployConfig = {
    treasury: deployer.address,
    defaultFeeBps: 50,
  };

  const deployedContracts = {};

  try {
    // Deploy Factory with explicit nonce
    console.log("1️⃣ Deploying Factory Contract...");
    const Factory = await ethers.getContractFactory("Factory");
    
    const deployTx = await Factory.getDeployTransaction(
      deployConfig.treasury,
      deployConfig.defaultFeeBps
    );
    
    // Send with explicit gas settings
    const tx = await deployer.sendTransaction({
      ...deployTx,
      gasPrice: highGasPrice,
      gasLimit: 3000000n,
      nonce: latestNonce,
    });
    
    console.log("   📤 TX Hash:", tx.hash);
    console.log("   ⏳ Waiting for confirmation...");
    
    const receipt = await tx.wait(2); // Wait for 2 confirmations
    
    if (receipt.status === 1) {
      console.log("   ✅ Factory deployed at:", receipt.contractAddress);
      deployedContracts.FACTORY_ADDRESS = receipt.contractAddress;
    } else {
      throw new Error("Transaction failed");
    }

    // Deploy Enhanced Factory
    console.log("\n2️⃣ Deploying Enhanced Factory...");
    try {
      const EnhancedFactory = await ethers.getContractFactory("EnhancedFactory");
      const enhancedTx = await EnhancedFactory.deploy(
        deployConfig.treasury,
        deployConfig.defaultFeeBps,
        { gasPrice: highGasPrice }
      );
      console.log("   📤 TX Hash:", enhancedTx.deploymentTransaction().hash);
      await enhancedTx.waitForDeployment();
      
      const enhancedAddress = await enhancedTx.getAddress();
      console.log("   ✅ Enhanced Factory deployed at:", enhancedAddress);
      deployedContracts.ENHANCED_FACTORY_ADDRESS = enhancedAddress;
    } catch (err) {
      console.log("   ⚠️  Skipped:", err.message);
    }

    // Deploy PumpFun Factory
    console.log("\n3️⃣ Deploying PumpFun Factory...");
    try {
      const PumpFunFactory = await ethers.getContractFactory("PumpFunFactory");
      const pumpTx = await PumpFunFactory.deploy(
        deployConfig.treasury,
        ethers.parseEther("0.0001"),
        ethers.parseEther("0.0000001"),
        { gasPrice: highGasPrice }
      );
      console.log("   📤 TX Hash:", pumpTx.deploymentTransaction().hash);
      await pumpTx.waitForDeployment();
      
      const pumpAddress = await pumpTx.getAddress();
      console.log("   ✅ PumpFun Factory deployed at:", pumpAddress);
      deployedContracts.PUMPFUN_FACTORY_ADDRESS = pumpAddress;
    } catch (err) {
      console.log("   ⚠️  Skipped:", err.message);
    }

    deployedContracts.TREASURY_ADDRESS = deployConfig.treasury;

    // Save results
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
    console.log("✅ DEPLOYMENT COMPLETE!");
    console.log("=".repeat(60));
    Object.entries(deployedContracts).forEach(([name, addr]) => {
      console.log(`NEXT_PUBLIC_${name}=${addr}`);
    });
    console.log("=".repeat(60));

    const finalBalance = await deployer.provider.getBalance(deployer.address);
    console.log("\n💰 Gas spent:", ethers.formatEther(balance - finalBalance), "MATIC");
    console.log("💰 Remaining:", ethers.formatEther(finalBalance), "MATIC");

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



