/**
 * Verify deployed contracts on PolygonScan
 * 
 * Usage:
 * npx hardhat run scripts/verifyContracts.js --network polygon
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Verifying contracts on PolygonScan...");

  // Load deployment info
  const deploymentFile = path.join(__dirname, "..", "deployments", "polygon-mainnet-deployment.json");
  
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found. Please deploy contracts first.");
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contracts = deploymentInfo.contracts;

  console.log("📋 Contracts to verify:");
  Object.entries(contracts).forEach(([name, address]) => {
    console.log(`  ${name}: ${address}`);
  });

  try {
    // Verify Factory Contract
    if (contracts.FACTORY_ADDRESS) {
      console.log("\n1️⃣ Verifying Factory Contract...");
      try {
        await hre.run("verify:verify", {
          address: contracts.FACTORY_ADDRESS,
          constructorArguments: [
            contracts.TREASURY_ADDRESS,
            50 // defaultFeeBps
          ],
        });
        console.log("✅ Factory verified");
      } catch (error) {
        console.log("⚠️  Factory verification failed:", error.message);
      }
    }

    // Verify Enhanced Factory
    if (contracts.ENHANCED_FACTORY_ADDRESS) {
      console.log("\n2️⃣ Verifying Enhanced Factory...");
      try {
        await hre.run("verify:verify", {
          address: contracts.ENHANCED_FACTORY_ADDRESS,
          constructorArguments: [
            contracts.TREASURY_ADDRESS,
            50 // defaultFeeBps
          ],
        });
        console.log("✅ Enhanced Factory verified");
      } catch (error) {
        console.log("⚠️  Enhanced Factory verification failed:", error.message);
      }
    }

    // Verify WETH
    if (contracts.WETH_ADDRESS) {
      console.log("\n3️⃣ Verifying WETH...");
      try {
        await hre.run("verify:verify", {
          address: contracts.WETH_ADDRESS,
          constructorArguments: [],
        });
        console.log("✅ WETH verified");
      } catch (error) {
        console.log("⚠️  WETH verification failed:", error.message);
      }
    }

    // Verify UniswapV2Factory
    if (contracts.UNISWAP_FACTORY_ADDRESS) {
      console.log("\n4️⃣ Verifying UniswapV2Factory...");
      try {
        await hre.run("verify:verify", {
          address: contracts.UNISWAP_FACTORY_ADDRESS,
          constructorArguments: [deploymentInfo.deployer],
        });
        console.log("✅ UniswapV2Factory verified");
      } catch (error) {
        console.log("⚠️  UniswapV2Factory verification failed:", error.message);
      }
    }

    // Verify UniswapV2Router
    if (contracts.ROUTER_ADDRESS) {
      console.log("\n5️⃣ Verifying UniswapV2Router...");
      try {
        await hre.run("verify:verify", {
          address: contracts.ROUTER_ADDRESS,
          constructorArguments: [
            contracts.UNISWAP_FACTORY_ADDRESS,
            contracts.WETH_ADDRESS
          ],
        });
        console.log("✅ UniswapV2Router verified");
      } catch (error) {
        console.log("⚠️  UniswapV2Router verification failed:", error.message);
      }
    }

    // Verify Auto Trading Factory
    if (contracts.AUTO_TRADING_FACTORY_ADDRESS) {
      console.log("\n6️⃣ Verifying Auto Trading Factory...");
      try {
        await hre.run("verify:verify", {
          address: contracts.AUTO_TRADING_FACTORY_ADDRESS,
          constructorArguments: [],
        });
        console.log("✅ Auto Trading Factory verified");
      } catch (error) {
        console.log("⚠️  Auto Trading Factory verification failed:", error.message);
      }
    }

    // Verify PumpFun Factory
    if (contracts.PUMPFUN_FACTORY_ADDRESS) {
      console.log("\n7️⃣ Verifying PumpFun Factory...");
      try {
        await hre.run("verify:verify", {
          address: contracts.PUMPFUN_FACTORY_ADDRESS,
          constructorArguments: [
            contracts.TREASURY_ADDRESS,
            ethers.parseEther("0.0001"), // basePrice
            ethers.parseEther("0.0000001") // priceIncrement
          ],
        });
        console.log("✅ PumpFun Factory verified");
      } catch (error) {
        console.log("⚠️  PumpFun Factory verification failed:", error.message);
      }
    }

    console.log("\n✅ Contract verification completed!");
    console.log("🔗 Check contracts on PolygonScan:");
    Object.entries(contracts).forEach(([name, address]) => {
      console.log(`  ${name}: https://polygonscan.com/address/${address}`);
    });

  } catch (error) {
    console.error("❌ Verification failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });






