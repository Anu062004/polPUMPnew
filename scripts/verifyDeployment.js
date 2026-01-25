/**
 * Verify deployed contracts on Polygon Mainnet
 */

const { ethers } = require("ethers");

async function main() {
  console.log("🔍 Verifying Deployed Contracts on Polygon Mainnet...\n");
  
  const provider = new ethers.JsonRpcProvider("https://polygon-mainnet.infura.io/v3/2a16fc884a10441eae11c29cd9b9aa5f");
  
  const contracts = {
    "Factory": "0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69",
    "Enhanced Factory": "0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76",
    "PumpFun Factory": "0xa214AE0b2C9A3062208c82faCA879e766558dc15",
  };

  const factoryABI = [
    "function treasury() view returns (address)",
    "function defaultFeeBps() view returns (uint16)",
  ];

  for (const [name, address] of Object.entries(contracts)) {
    console.log(`📋 ${name}: ${address}`);
    try {
      const code = await provider.getCode(address);
      if (code === "0x") {
        console.log("   ❌ No contract code found!");
      } else {
        console.log("   ✅ Contract code exists (" + code.length + " bytes)");
        
        // Try to read treasury and fees
        try {
          const contract = new ethers.Contract(address, factoryABI, provider);
          const treasury = await contract.treasury();
          const feeBps = await contract.defaultFeeBps();
          console.log("   📍 Treasury:", treasury);
          console.log("   💰 Default Fee:", feeBps.toString(), "bps (" + (Number(feeBps) / 100) + "%)");
        } catch (e) {
          // Different ABI, skip
        }
      }
    } catch (e) {
      console.log("   ❌ Error:", e.message);
    }
    console.log("");
  }

  console.log("=".repeat(65));
  console.log("📋 FINAL CONTRACT ADDRESSES FOR .env FILE:");
  console.log("=".repeat(65));
  console.log("NEXT_PUBLIC_NETWORK=polygon");
  console.log("NEXT_PUBLIC_CHAIN_ID=137");
  console.log("NEXT_PUBLIC_FACTORY_ADDRESS=0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69");
  console.log("NEXT_PUBLIC_ENHANCED_FACTORY_ADDRESS=0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76");
  console.log("NEXT_PUBLIC_PUMPFUN_FACTORY_ADDRESS=0xa214AE0b2C9A3062208c82faCA879e766558dc15");
  console.log("NEXT_PUBLIC_TREASURY_ADDRESS=0x1aB7d5eCBe2c551eBfFdfA06661B77cc60dbd425");
  console.log("=".repeat(65));
  
  console.log("\n🔗 View on PolygonScan:");
  console.log("   Factory: https://polygonscan.com/address/0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69");
  console.log("   Enhanced Factory: https://polygonscan.com/address/0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76");
  console.log("   PumpFun Factory: https://polygonscan.com/address/0xa214AE0b2C9A3062208c82faCA879e766558dc15");
}

main().catch(console.error);



