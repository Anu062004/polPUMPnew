require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-chai-matchers");
require("dotenv").config();

function normalizePrivateKey(raw) {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  const withPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(withPrefix) ? withPrefix : null;
}

const DEPLOYER_PRIVATE_KEY = normalizePrivateKey(process.env.PRIVATE_KEY);
const SHARED_ACCOUNTS = DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 1337,
    },
    // Polygon Mainnet (Production)
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      chainId: 137,
      accounts: SHARED_ACCOUNTS,
      timeout: 120000, // 2 minute timeout
    },
    // Polygon Amoy Testnet (for testing)
    "polygon-amoy": {
      url:
        process.env.NEXT_PUBLIC_EVM_RPC ||
        process.env.POLYGON_AMOY_RPC ||
        "https://polygon-amoy.publicnode.com",
      chainId: 80002,
      accounts: SHARED_ACCOUNTS,
    },
    "0g-galileo": {
      url: process.env.RPC_URL || "https://evmrpc-testnet.0g.ai",
      chainId: 16602,
      accounts: SHARED_ACCOUNTS,
    },
  },
  etherscan: {
    apiKey: {
      polygon: process.env.POLYGONSCAN_API_KEY,
      polygonAmoy: process.env.POLYGONSCAN_API_KEY,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};



