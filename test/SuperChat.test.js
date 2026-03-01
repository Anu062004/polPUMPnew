const { expect } = require("chai");
const { ethers } = require("hardhat");

function parseEvent(receipt, contractInterface, eventName) {
  for (const log of receipt.logs) {
    try {
      const parsed = contractInterface.parseLog(log);
      if (parsed && parsed.name === eventName) {
        return parsed;
      }
    } catch {
      // Ignore unrelated logs
    }
  }
  return null;
}

describe("SuperChat", function () {
  let owner;
  let treasury;
  let creator;
  let trader;
  let other;
  let superChat;
  let paymentToken;
  let streamToken;

  const FEE_BPS = 500; // 5%
  const MIN_NATIVE = ethers.parseEther("0.001");

  beforeEach(async function () {
    [owner, treasury, creator, trader, other] = await ethers.getSigners();
    streamToken = other.address;

    const SuperChat = await ethers.getContractFactory("SuperChat");
    superChat = await SuperChat.deploy(treasury.address, FEE_BPS, MIN_NATIVE);
    await superChat.waitForDeployment();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    paymentToken = await MockERC20.deploy(
      "Mock USD",
      "mUSD",
      ethers.parseUnits("1000000", 18)
    );
    await paymentToken.waitForDeployment();

    await paymentToken.mint(trader.address, ethers.parseUnits("10000", 18));
  });

  it("sets constructor values", async function () {
    expect(await superChat.treasury()).to.equal(treasury.address);
    expect(await superChat.platformFeeBps()).to.equal(FEE_BPS);
    expect(await superChat.minNativeAmount()).to.equal(MIN_NATIVE);
  });

  it("splits native super chat payment between creator and treasury", async function () {
    await superChat.connect(creator).registerOwnStream(streamToken, creator.address, true);

    const amountIn = ethers.parseEther("1");
    const expectedPlatform = (amountIn * BigInt(FEE_BPS)) / 10000n;
    const expectedCreator = amountIn - expectedPlatform;
    const clientMessageId = ethers.hexlify(ethers.randomBytes(32));

    const creatorBefore = await ethers.provider.getBalance(creator.address);
    const treasuryBefore = await ethers.provider.getBalance(treasury.address);

    await expect(
      superChat.connect(trader).sendSuperChatNative(
        creator.address,
        streamToken,
        "ipfs://superchat-message",
        "default",
        "rocket",
        clientMessageId,
        { value: amountIn }
      )
    ).to.emit(superChat, "NativeSuperChatPaid");

    const creatorAfter = await ethers.provider.getBalance(creator.address);
    const treasuryAfter = await ethers.provider.getBalance(treasury.address);

    expect(creatorAfter - creatorBefore).to.equal(expectedCreator);
    expect(treasuryAfter - treasuryBefore).to.equal(expectedPlatform);
  });

  it("rejects duplicate client message ids from same sender", async function () {
    await superChat.connect(creator).registerOwnStream(streamToken, creator.address, true);
    const amountIn = ethers.parseEther("0.01");
    const clientMessageId = ethers.hexlify(ethers.randomBytes(32));

    await superChat.connect(trader).sendSuperChatNative(
      creator.address,
      streamToken,
      "ipfs://msg-a",
      "",
      "",
      clientMessageId,
      { value: amountIn }
    );

    await expect(
      superChat.connect(trader).sendSuperChatNative(
        creator.address,
        streamToken,
        "ipfs://msg-b",
        "",
        "",
        clientMessageId,
        { value: amountIn }
      )
    ).to.be.revertedWithCustomError(superChat, "DuplicateClientMessageId");
  });

  it("supports ERC20 super chat payments for allowlisted tokens", async function () {
    await superChat.connect(creator).registerOwnStream(streamToken, creator.address, true);
    await superChat.setAllowedPaymentToken(await paymentToken.getAddress(), true);
    await superChat.setMinTokenAmount(await paymentToken.getAddress(), ethers.parseUnits("1", 18));

    const amountIn = ethers.parseUnits("100", 18);
    const expectedPlatform = (amountIn * BigInt(FEE_BPS)) / 10000n;
    const expectedCreator = amountIn - expectedPlatform;

    await paymentToken.connect(trader).approve(await superChat.getAddress(), amountIn);

    const creatorBefore = await paymentToken.balanceOf(creator.address);
    const treasuryBefore = await paymentToken.balanceOf(treasury.address);

    await expect(
      superChat.connect(trader).sendSuperChatToken(
        creator.address,
        streamToken,
        await paymentToken.getAddress(),
        amountIn,
        "ipfs://msg-token",
        "default",
        "diamond",
        ethers.hexlify(ethers.randomBytes(32))
      )
    ).to.emit(superChat, "TokenSuperChatPaid");

    const creatorAfter = await paymentToken.balanceOf(creator.address);
    const treasuryAfter = await paymentToken.balanceOf(treasury.address);

    expect(creatorAfter - creatorBefore).to.equal(expectedCreator);
    expect(treasuryAfter - treasuryBefore).to.equal(expectedPlatform);
  });

  it("emits sticker metadata in native super chat event", async function () {
    await superChat.connect(creator).registerOwnStream(streamToken, creator.address, true);
    const clientMessageId = ethers.hexlify(ethers.randomBytes(32));

    const tx = await superChat.connect(trader).sendSuperChatNative(
      creator.address,
      streamToken,
      "ipfs://cid",
      "alpha-pack",
      "bull",
      clientMessageId,
      { value: ethers.parseEther("0.01") }
    );

    const receipt = await tx.wait();
    const parsed = parseEvent(receipt, superChat.interface, "NativeSuperChatPaid");
    expect(parsed).to.not.equal(null);
    expect(parsed.args.stickerPack).to.equal("alpha-pack");
    expect(parsed.args.stickerId).to.equal("bull");
  });

  it("requires stream to be active", async function () {
    await superChat.connect(creator).registerOwnStream(streamToken, creator.address, false);

    await expect(
      superChat.connect(trader).sendSuperChatNative(
        creator.address,
        streamToken,
        "ipfs://cid",
        "",
        "",
        ethers.hexlify(ethers.randomBytes(32)),
        { value: ethers.parseEther("0.01") }
      )
    ).to.be.revertedWithCustomError(superChat, "StreamInactive");
  });
});
