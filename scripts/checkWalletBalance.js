/**
 * Check Wallet Balance and Connectivity on Polygon Mainnet
 * This script verifies wallet access before deployment
 */

const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("🔍 Checking Wallet Connectivity on Polygon Mainnet...\n");

  // RPC URLs to try
  const rpcUrls = [
    process.env.POLYGON_RPC_URL || "https://polygon-mainnet.infura.io/v3/2a16fc884a10441eae11c29cd9b9aa5f",
    "https://polygon-rpc.com",
    "https://rpc-mainnet.matic.quiknode.pro",
    "https://polygon.llamarpc.com"
  ];

  const privateKey = process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error("❌ PRIVATE_KEY not found in environment variables");
    console.log("💡 Please set PRIVATE_KEY in your .env file");
    process.exit(1);
  }

  console.log("📋 Testing RPC endpoints...\n");

  for (const rpcUrl of rpcUrls) {
    try {
      console.log(`🔗 Testing: ${rpcUrl.substring(0, 50)}...`);
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // Check network
      const network = await provider.getNetwork();
      console.log(`   ✅ Connected to Chain ID: ${network.chainId}`);
      
      if (network.chainId !== 137n) {
        console.log(`   ⚠️  Warning: Expected Chain ID 137 (Polygon Mainnet)`);
        continue;
      }

      // Create wallet
      const wallet = new ethers.Wallet(privateKey, provider);
      console.log(`   📝 Wallet Address: ${wallet.address}`);

      // Check balance
      const balance = await provider.getBalance(wallet.address);
      const balanceInMatic = ethers.formatEther(balance);
      console.log(`   💰 Balance: ${balanceInMatic} MATIC`);

      // Check gas price
      const feeData = await provider.getFeeData();
      const gasPrice = ethers.formatUnits(feeData.gasPrice || 0, "gwei");
      console.log(`   ⛽ Current Gas Price: ${gasPrice} Gwei`);

      // Estimate deployment cost (rough estimate)
      const estimatedGas = 5000000n; // ~5M gas for all contracts
      const estimatedCost = (feeData.gasPrice || 0n) * estimatedGas;
      const estimatedCostMatic = ethers.formatEther(estimatedCost);
      console.log(`   📊 Estimated Deployment Cost: ~${estimatedCostMatic} MATIC`);

      // Check if sufficient balance
      if (balance >= estimatedCost) {
        console.log(`   ✅ Sufficient balance for deployment!`);
      } else {
        const needed = estimatedCost - balance;
        console.log(`   ❌ Insufficient balance. Need ~${ethers.formatEther(needed)} more MATIC`);
      }

      console.log("\n" + "=".repeat(60));
      console.log("📋 WALLET SUMMARY");
      console.log("=".repeat(60));
      console.log(`Network:          Polygon Mainnet (Chain ID: 137)`);
      console.log(`Wallet Address:   ${wallet.address}`);
      console.log(`Balance:          ${balanceInMatic} MATIC`);
      console.log(`Gas Price:        ${gasPrice} Gwei`);
      console.log(`Est. Deploy Cost: ~${estimatedCostMatic} MATIC`);
      console.log("=".repeat(60));

      if (parseFloat(balanceInMatic) > 0) {
        console.log("\n✅ Wallet is accessible and has funds!");
        console.log("🚀 Ready for deployment. Run: npm run deploy:polygon");
      } else {
        console.log("\n⚠️  Wallet has 0 MATIC balance");
        console.log("💡 Please fund the wallet with MATIC before deployment");
        console.log(`   Send MATIC to: ${wallet.address}`);
      }

      return; // Success, exit

    } catch (error) {
      console.log(`   ❌ Failed: ${error.message}`);
    }
  }

  console.log("\n❌ Could not connect to any RPC endpoint");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });






