/**
 * Check all deployed contracts and verify which ones remain
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("📊 PolPUMP Deployment Status Report\n");
  console.log("=".repeat(70));
  
  const provider = new ethers.JsonRpcProvider("https://polygon-mainnet.infura.io/v3/2a16fc884a10441eae11c29cd9b9aa5f");
  
  // Load deployment file
  const deploymentFile = path.join(__dirname, "..", "deployments", "polygon-mainnet-deployment.json");
  let deployedContracts = {};
  
  if (fs.existsSync(deploymentFile)) {
    const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
    deployedContracts = deployment.contracts || {};
  }

  // Expected contracts from codebase
  const expectedContracts = {
    "Factory": "FACTORY_ADDRESS",
    "Enhanced Factory": "ENHANCED_FACTORY_ADDRESS",
    "PumpFun Factory": "PUMPFUN_FACTORY_ADDRESS",
    "WETH": "WETH_ADDRESS",
    "UniswapV2Factory": "UNISWAP_FACTORY_ADDRESS",
    "UniswapV2Router": "ROUTER_ADDRESS",
    "Auto Trading Factory": "AUTO_TRADING_FACTORY_ADDRESS",
    "Game Bank": "GAME_BANK_ADDRESS",
    "Game Registry": "GAME_REGISTRY_ADDRESS",
    "Token Marketplace": "TOKEN_MARKETPLACE_ADDRESS",
    "Treasury": "TREASURY_ADDRESS",
  };

  console.log("\n✅ DEPLOYED CONTRACTS:\n");
  let deployedCount = 0;
  let verifiedCount = 0;
  
  for (const [name, key] of Object.entries(expectedContracts)) {
    const address = deployedContracts[key];
    if (address) {
      deployedCount++;
      try {
        const code = await provider.getCode(address);
        if (code !== "0x" && code.length > 2) {
          verifiedCount++;
          console.log(`   ✅ ${name.padEnd(25)} ${address} (${code.length} bytes)`);
        } else {
          console.log(`   ⚠️  ${name.padEnd(25)} ${address} (NO CODE)`);
        }
      } catch (e) {
        console.log(`   ⚠️  ${name.padEnd(25)} ${address} (CHECK FAILED)`);
      }
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log(`📊 SUMMARY:`);
  console.log(`   ✅ Deployed: ${deployedCount} contracts`);
  console.log(`   ✅ Verified on-chain: ${verifiedCount} contracts`);
  console.log(`   ⏳ Remaining: ${Object.keys(expectedContracts).length - deployedCount} contracts`);
  console.log("=".repeat(70));

  // Check which contracts are missing
  const missing = [];
  for (const [name, key] of Object.entries(expectedContracts)) {
    if (!deployedContracts[key]) {
      missing.push(name);
    }
  }

  if (missing.length > 0) {
    console.log("\n⏳ REMAINING CONTRACTS TO DEPLOY:\n");
    missing.forEach((name, index) => {
      console.log(`   ${index + 1}. ${name}`);
    });
  } else {
    console.log("\n🎉 ALL CONTRACTS DEPLOYED!");
  }

  console.log("\n" + "=".repeat(70));
}

main().catch(console.error);







