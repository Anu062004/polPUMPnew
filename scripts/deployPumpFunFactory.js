/**
 * Deploy PumpFun Factory
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🚀 Deploying PumpFun Factory...\n");
  
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("💰 Balance:", ethers.formatEther(balance), "MATIC");

  const feeData = await deployer.provider.getFeeData();
  const gasPrice = feeData.gasPrice * 150n / 100n;
  console.log("⛽ Gas price:", ethers.formatUnits(gasPrice, "gwei"), "Gwei\n");

  try {
    console.log("📤 Deploying PumpFun Factory...");
    const PumpFunFactory = await ethers.getContractFactory("PumpFunFactory");
    
    const pumpFun = await PumpFunFactory.deploy(
      deployer.address,      // treasury
      50,                     // defaultFeeBps (0.5%)
      ethers.parseEther("0.0001"),    // basePrice
      ethers.parseEther("0.0000001"), // priceIncrement
      100,                    // growthRateBps (1%)
      false,                  // useExponential
      { gasPrice }
    );
    
    console.log("   TX:", pumpFun.deploymentTransaction().hash);
    console.log("   ⏳ Waiting for confirmation...");
    await pumpFun.waitForDeployment();
    
    const pumpFunAddress = await pumpFun.getAddress();
    console.log("   ✅ PumpFun Factory:", pumpFunAddress);

    // Update deployment file
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    const deploymentFile = path.join(deploymentsDir, "polygon-mainnet-deployment.json");
    
    let deployment = {};
    if (fs.existsSync(deploymentFile)) {
      deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    }
    
    deployment.contracts = deployment.contracts || {};
    deployment.contracts.PUMPFUN_FACTORY_ADDRESS = pumpFunAddress;
    deployment.contracts.FACTORY_ADDRESS = "0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69";
    deployment.contracts.ENHANCED_FACTORY_ADDRESS = "0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76";
    deployment.contracts.TREASURY_ADDRESS = deployer.address;
    deployment.timestamp = new Date().toISOString();
    
    fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

    console.log("\n" + "=".repeat(65));
    console.log("🎉 ALL CONTRACTS DEPLOYED!");
    console.log("=".repeat(65));
    console.log("\nNEXT_PUBLIC_FACTORY_ADDRESS=0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69");
    console.log("NEXT_PUBLIC_ENHANCED_FACTORY_ADDRESS=0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76");
    console.log("NEXT_PUBLIC_PUMPFUN_FACTORY_ADDRESS=" + pumpFunAddress);
    console.log("NEXT_PUBLIC_TREASURY_ADDRESS=" + deployer.address);
    console.log("=".repeat(65));

    const finalBalance = await deployer.provider.getBalance(deployer.address);
    console.log("\n💰 Gas used:", ethers.formatEther(balance - finalBalance), "MATIC");
    console.log("💰 Remaining:", ethers.formatEther(finalBalance), "MATIC");

  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
