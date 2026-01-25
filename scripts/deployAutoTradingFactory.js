/**
 * Deploy AutoTradingFactory with correct constructor
 */

const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deployer:", deployer.address);
  
  const feeData = await deployer.provider.getFeeData();
  const minGasPrice = feeData.gasPrice;
  console.log("⛽ Gas price:", ethers.formatUnits(minGasPrice, "gwei"), "Gwei\n");

  try {
    console.log("📤 Deploying AutoTradingFactory...");
    const AutoTradingFactory = await ethers.getContractFactory("AutoTradingFactory");
    
    // Load deployed DEX addresses
    const deploymentsFile = require("../deployments/polygon-mainnet-deployment.json");
    const contracts = deploymentsFile.contracts;
    
    if (!contracts.UNISWAP_FACTORY_ADDRESS || !contracts.ROUTER_ADDRESS || !contracts.WETH_ADDRESS) {
      throw new Error("DEX contracts must be deployed first");
    }
    
    const deployTx = await AutoTradingFactory.getDeployTransaction(
      contracts.UNISWAP_FACTORY_ADDRESS,
      contracts.ROUTER_ADDRESS,
      contracts.WETH_ADDRESS,
      deployer.address // feeRecipient
    );
    
    const tx = await deployer.sendTransaction({
      ...deployTx,
      gasPrice: minGasPrice,
    });
    
    console.log("   TX:", tx.hash);
    console.log("   ⏳ Waiting...");
    const receipt = await tx.wait(1);
    
    const address = receipt.contractAddress;
    console.log("   ✅ AutoTradingFactory:", address);
    console.log("\nNEXT_PUBLIC_AUTO_TRADING_FACTORY_ADDRESS=" + address);

  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);

