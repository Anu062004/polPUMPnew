/**
 * Check transaction status on Polygon
 */
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const txHash = process.argv[2] || "0xdcca319be56a0323fc3197a914a0601045b5d02ce543311a87bb0e05c32579aa";
  
  console.log("🔍 Checking transaction:", txHash);
  
  const provider = new ethers.JsonRpcProvider("https://polygon-mainnet.infura.io/v3/2a16fc884a10441eae11c29cd9b9aa5f");
  
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      console.log("❌ Transaction not found");
      return;
    }
    
    console.log("📋 Transaction found:");
    console.log("   From:", tx.from);
    console.log("   Nonce:", tx.nonce);
    
    const receipt = await provider.getTransactionReceipt(txHash);
    if (receipt) {
      console.log("   ✅ Status:", receipt.status === 1 ? "SUCCESS" : "FAILED");
      console.log("   📦 Block:", receipt.blockNumber);
      console.log("   ⛽ Gas Used:", receipt.gasUsed.toString());
      if (receipt.contractAddress) {
        console.log("   📄 Contract Deployed:", receipt.contractAddress);
      }
    } else {
      console.log("   ⏳ Status: PENDING");
    }
    
    // Check wallet balance
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      console.log("\n💰 Current wallet balance:", ethers.formatEther(balance), "MATIC");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main();



