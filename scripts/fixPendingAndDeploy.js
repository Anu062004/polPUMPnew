/**
 * Fix pending transactions and deploy remaining contracts
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔧 Fixing Pending Transactions and Deploying...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MATIC");

  // Check nonce status
  const latestNonce = await deployer.getNonce("latest");
  const pendingNonce = await deployer.getNonce("pending");
  console.log("🔢 Latest confirmed nonce:", latestNonce);
  console.log("🔢 Next pending nonce:", pendingNonce);

  // Get high gas price
  const feeData = await deployer.provider.getFeeData();
  const highGasPrice = feeData.gasPrice * 200n / 100n; // 100% higher for replacement
  console.log("⛽ Gas price (2x):", ethers.formatUnits(highGasPrice, "gwei"), "Gwei\n");

  // If there are pending transactions, we need to replace them
  if (pendingNonce > latestNonce) {
    console.log("⚠️  Found", pendingNonce - latestNonce, "pending transactions");
    console.log("   Will replace starting from nonce", latestNonce);
    console.log("");
  }

  const deployConfig = {
    treasury: deployer.address,
    defaultFeeBps: 50,
  };

  const deployedContracts = {
    TREASURY_ADDRESS: deployer.address,
  };

  let currentNonce = latestNonce;

  try {
    // 1. Deploy Factory (or replace pending tx at nonce 0)
    console.log("1️⃣ Deploying Factory Contract (nonce:", currentNonce, ")...");
    const Factory = await ethers.getContractFactory("Factory");
    const factoryTx = await Factory.getDeployTransaction(
      deployConfig.treasury,
      deployConfig.defaultFeeBps
    );
    
    const tx1 = await deployer.sendTransaction({
      ...factoryTx,
      gasPrice: highGasPrice,
      gasLimit: 3000000n,
      nonce: currentNonce,
    });
    console.log("   📤 TX:", tx1.hash);
    console.log("   ⏳ Waiting...");
    const receipt1 = await tx1.wait(1);
    console.log("   ✅ Factory:", receipt1.contractAddress);
    deployedContracts.FACTORY_ADDRESS = receipt1.contractAddress;
    currentNonce++;

    // 2. Deploy Enhanced Factory
    console.log("\n2️⃣ Deploying Enhanced Factory (nonce:", currentNonce, ")...");
    const EnhancedFactory = await ethers.getContractFactory("EnhancedFactory");
    const feeSplit = { platformFeeBps: 30, creatorFeeBps: 10, burnFeeBps: 5, lpFeeBps: 5 };
    
    const enhancedTx = await EnhancedFactory.getDeployTransaction(
      deployConfig.treasury,
      deployConfig.defaultFeeBps,
      feeSplit
    );
    
    const tx2 = await deployer.sendTransaction({
      ...enhancedTx,
      gasPrice: highGasPrice,
      gasLimit: 5000000n,
      nonce: currentNonce,
    });
    console.log("   📤 TX:", tx2.hash);
    console.log("   ⏳ Waiting...");
    const receipt2 = await tx2.wait(1);
    console.log("   ✅ Enhanced Factory:", receipt2.contractAddress);
    deployedContracts.ENHANCED_FACTORY_ADDRESS = receipt2.contractAddress;
    currentNonce++;

    // 3. Deploy PumpFun Factory
    console.log("\n3️⃣ Deploying PumpFun Factory (nonce:", currentNonce, ")...");
    const PumpFunFactory = await ethers.getContractFactory("PumpFunFactory");
    
    const pumpTx = await PumpFunFactory.getDeployTransaction(
      deployConfig.treasury,
      deployConfig.defaultFeeBps,
      ethers.parseEther("0.0001"),
      ethers.parseEther("0.0000001"),
      100n,
      false
    );
    
    const tx3 = await deployer.sendTransaction({
      ...pumpTx,
      gasPrice: highGasPrice,
      gasLimit: 5000000n,
      nonce: currentNonce,
    });
    console.log("   📤 TX:", tx3.hash);
    console.log("   ⏳ Waiting...");
    const receipt3 = await tx3.wait(1);
    console.log("   ✅ PumpFun Factory:", receipt3.contractAddress);
    deployedContracts.PUMPFUN_FACTORY_ADDRESS = receipt3.contractAddress;

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

    // Summary
    console.log("\n" + "=".repeat(65));
    console.log("🎉 ALL CONTRACTS DEPLOYED SUCCESSFULLY!");
    console.log("=".repeat(65));
    console.log("\n📋 Add these to your .env file:\n");
    Object.entries(deployedContracts).forEach(([name, addr]) => {
      console.log(`NEXT_PUBLIC_${name}=${addr}`);
    });
    console.log("\n" + "=".repeat(65));

    const finalBalance = await deployer.provider.getBalance(deployer.address);
    console.log("💰 Total gas used:", ethers.formatEther(balance - finalBalance), "MATIC");
    console.log("💰 Remaining balance:", ethers.formatEther(finalBalance), "MATIC");
    console.log("=".repeat(65));

  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);







