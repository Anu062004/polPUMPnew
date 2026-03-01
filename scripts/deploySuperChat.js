const { ethers } = require("hardhat");

function parseFeeBps(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2000) {
    throw new Error("SUPERCHAT_PLATFORM_FEE_BPS must be an integer from 0 to 2000");
  }
  return parsed;
}

function parseBigIntAmount(value, fallback = "0") {
  const raw = value ?? fallback;
  if (!/^\d+$/.test(raw)) {
    throw new Error("Amount values must be integer wei strings");
  }
  return BigInt(raw);
}

async function main() {
  const [deployer] = await ethers.getSigners();

  const treasury = process.env.SUPERCHAT_TREASURY || deployer.address;
  const feeBps = parseFeeBps(process.env.SUPERCHAT_PLATFORM_FEE_BPS, "500");
  const minNativeAmount = parseBigIntAmount(process.env.SUPERCHAT_MIN_NATIVE_WEI, "0");
  const allowTokensRaw = process.env.SUPERCHAT_ALLOWED_TOKENS || "";
  const allowedTokens = allowTokensRaw
    .split(",")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  if (!ethers.isAddress(treasury)) {
    throw new Error(`Invalid SUPERCHAT_TREASURY address: ${treasury}`);
  }

  console.log("Deploying SuperChat with:");
  console.log("  deployer:", deployer.address);
  console.log("  treasury:", treasury);
  console.log("  platformFeeBps:", feeBps);
  console.log("  minNativeAmountWei:", minNativeAmount.toString());

  const SuperChat = await ethers.getContractFactory("SuperChat");
  const superChat = await SuperChat.deploy(treasury, feeBps, minNativeAmount);
  await superChat.waitForDeployment();

  const superChatAddress = await superChat.getAddress();
  console.log("SuperChat deployed at:", superChatAddress);

  for (const token of allowedTokens) {
    if (!ethers.isAddress(token)) {
      throw new Error(`Invalid token in SUPERCHAT_ALLOWED_TOKENS: ${token}`);
    }
    const tx = await superChat.setAllowedPaymentToken(token, true);
    await tx.wait();
    console.log("Allowlisted payment token:", token);
  }

  console.log("");
  console.log("NEXT_PUBLIC_SUPERCHAT_ADDRESS=", superChatAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
