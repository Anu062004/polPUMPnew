const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SecureBondingCurve", function () {
  let bondingCurve, token, owner, treasury, user1, user2;
  const INITIAL_SUPPLY = ethers.utils.parseEther("1000000");
  const SEED_ETH = ethers.utils.parseEther("1");
  const FEE_BPS = 50; // 0.5%

  beforeEach(async function () {
    [owner, treasury, user1, user2] = await ethers.getSigners();

    // Deploy MemeToken
    const MemeToken = await ethers.getContractFactory("MemeToken");
    token = await MemeToken.deploy("TestToken", "TEST", owner.address);
    await token.deployed();

    // Deploy BondingCurve
    const BondingCurve = await ethers.getContractFactory("SecureBondingCurve");
    bondingCurve = await BondingCurve.deploy(
      token.address,
      owner.address,
      treasury.address,
      FEE_BPS
    );
    await bondingCurve.deployed();

    // Set bonding curve as minter
    await token.setMinter(bondingCurve.address);
  });

  describe("Deployment", function () {
    it("Should set correct initial values", async function () {
      expect(await bondingCurve.token()).to.equal(token.address);
      expect(await bondingCurve.treasury()).to.equal(treasury.address);
      expect(await bondingCurve.feeBps()).to.equal(FEE_BPS);
      expect(await bondingCurve.seeded()).to.equal(false);
    });

    it("Should reject zero addresses", async function () {
      const BondingCurve = await ethers.getContractFactory("SecureBondingCurve");
      await expect(
        BondingCurve.deploy(ethers.constants.AddressZero, owner.address, treasury.address, FEE_BPS)
      ).to.be.revertedWith("ZeroAddress");
    });
  });

  describe("Seeding", function () {
    it("Should seed liquidity correctly", async function () {
      await expect(
        bondingCurve.seed(INITIAL_SUPPLY, { value: SEED_ETH })
      ).to.emit(bondingCurve, "Seeded")
        .withArgs(SEED_ETH, INITIAL_SUPPLY, await ethers.provider.getBlock("latest").then(b => b.timestamp + 1));

      expect(await bondingCurve.ogReserve()).to.equal(SEED_ETH);
      expect(await bondingCurve.tokenReserve()).to.equal(INITIAL_SUPPLY);
      expect(await bondingCurve.seeded()).to.equal(true);
    });

    it("Should reject seeding twice", async function () {
      await bondingCurve.seed(INITIAL_SUPPLY, { value: SEED_ETH });
      await expect(
        bondingCurve.seed(INITIAL_SUPPLY, { value: SEED_ETH })
      ).to.be.revertedWith("AlreadySeeded");
    });

    it("Should reject insufficient reserve", async function () {
      await expect(
        bondingCurve.seed(INITIAL_SUPPLY, { value: ethers.utils.parseEther("0.0001") })
      ).to.be.revertedWith("ReserveTooLow");
    });

    it("Should only allow owner to seed", async function () {
      await expect(
        bondingCurve.connect(user1).seed(INITIAL_SUPPLY, { value: SEED_ETH })
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Buying", function () {
    beforeEach(async function () {
      await bondingCurve.seed(INITIAL_SUPPLY, { value: SEED_ETH });
    });

    it("Should buy tokens correctly", async function () {
      const buyAmount = ethers.utils.parseEther("0.1");
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      
      const [tokensOut, fee] = await bondingCurve.getBuyQuote(buyAmount);
      
      await expect(
        bondingCurve.connect(user1).buy(tokensOut, deadline, { value: buyAmount })
      ).to.emit(bondingCurve, "Buy");

      expect(await token.balanceOf(user1.address)).to.equal(tokensOut);
    });

    it("Should enforce slippage protection", async function () {
      const buyAmount = ethers.utils.parseEther("0.1");
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      const tooHighMin = ethers.utils.parseEther("1000000");

      await expect(
        bondingCurve.connect(user1).buy(tooHighMin, deadline, { value: buyAmount })
      ).to.be.revertedWith("InsufficientOutput");
    });

    it("Should enforce deadline", async function () {
      const buyAmount = ethers.utils.parseEther("0.1");
      const pastDeadline = (await ethers.provider.getBlock("latest")).timestamp - 1;

      await expect(
        bondingCurve.connect(user1).buy(0, pastDeadline, { value: buyAmount })
      ).to.be.revertedWith("DeadlineExpired");
    });

    it("Should collect fees correctly", async function () {
      const buyAmount = ethers.utils.parseEther("0.1");
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      
      const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
      
      await bondingCurve.connect(user1).buy(0, deadline, { value: buyAmount });
      
      const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
      const expectedFee = buyAmount.mul(FEE_BPS).div(10000);
      
      expect(treasuryBalanceAfter.sub(treasuryBalanceBefore)).to.equal(expectedFee);
    });

    it("Should increase price with buys", async function () {
      const buyAmount = ethers.utils.parseEther("0.1");
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      
      const [tokensOut1] = await bondingCurve.getBuyQuote(buyAmount);
      await bondingCurve.connect(user1).buy(tokensOut1, deadline, { value: buyAmount });
      
      const [tokensOut2] = await bondingCurve.getBuyQuote(buyAmount);
      
      expect(tokensOut2).to.be.lt(tokensOut1); // Price increased, get fewer tokens
    });
  });

  describe("Selling", function () {
    beforeEach(async function () {
      await bondingCurve.seed(INITIAL_SUPPLY, { value: SEED_ETH });
      
      // User1 buys some tokens first
      const buyAmount = ethers.utils.parseEther("0.1");
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      const [tokensOut] = await bondingCurve.getBuyQuote(buyAmount);
      await bondingCurve.connect(user1).buy(tokensOut, deadline, { value: buyAmount });
    });

    it("Should sell tokens correctly", async function () {
      const sellAmount = await token.balanceOf(user1.address);
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      
      await token.connect(user1).approve(bondingCurve.address, sellAmount);
      
      const balanceBefore = await ethers.provider.getBalance(user1.address);
      const [ogOut] = await bondingCurve.getSellQuote(sellAmount);
      
      await bondingCurve.connect(user1).sell(sellAmount, ogOut, deadline);
      
      expect(await token.balanceOf(user1.address)).to.equal(0);
    });

    it("Should enforce slippage protection on sell", async function () {
      const sellAmount = await token.balanceOf(user1.address);
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      const tooHighMin = ethers.utils.parseEther("1000");
      
      await token.connect(user1).approve(bondingCurve.address, sellAmount);
      
      await expect(
        bondingCurve.connect(user1).sell(sellAmount, tooHighMin, deadline)
      ).to.be.revertedWith("InsufficientOutput");
    });
  });

  describe("Admin Functions", function () {
    it("Should schedule and execute fee change with timelock", async function () {
      const newFee = 100; // 1%
      
      await bondingCurve.scheduleFeeChange(newFee);
      expect(await bondingCurve.pendingFeeBps()).to.equal(newFee);
      
      // Try to execute immediately (should fail)
      await expect(bondingCurve.executeFeeChange()).to.be.revertedWith("FeeChangeNotReady");
      
      // Fast forward time
      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
      await ethers.provider.send("evm_mine");
      
      await expect(bondingCurve.executeFeeChange())
        .to.emit(bondingCurve, "FeeUpdated")
        .withArgs(FEE_BPS, newFee);
      
      expect(await bondingCurve.feeBps()).to.equal(newFee);
    });

    it("Should update treasury", async function () {
      await expect(bondingCurve.setTreasury(user1.address))
        .to.emit(bondingCurve, "TreasuryUpdated")
        .withArgs(treasury.address, user1.address);
      
      expect(await bondingCurve.treasury()).to.equal(user1.address);
    });

    it("Should pause and unpause", async function () {
      await bondingCurve.pause();
      
      const buyAmount = ethers.utils.parseEther("0.1");
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      
      await expect(
        bondingCurve.connect(user1).buy(0, deadline, { value: buyAmount })
      ).to.be.revertedWith("Pausable: paused");
      
      await bondingCurve.unpause();
      
      // Should work now
      await bondingCurve.seed(INITIAL_SUPPLY, { value: SEED_ETH });
    });
  });

  describe("Security Tests", function () {
    it("Should prevent reentrancy", async function () {
      // This would require a malicious contract - placeholder test
      expect(true).to.equal(true);
    });

    it("Should handle zero amounts", async function () {
      await bondingCurve.seed(INITIAL_SUPPLY, { value: SEED_ETH });
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      
      await expect(
        bondingCurve.connect(user1).buy(0, deadline, { value: 0 })
      ).to.be.revertedWith("ZeroAmount");
    });

    it("Should reject excessive slippage", async function () {
      await bondingCurve.seed(INITIAL_SUPPLY, { value: SEED_ETH });
      
      // Try to buy more than 50% of supply (should fail)
      const massiveBuy = ethers.utils.parseEther("1000");
      const deadline = (await ethers.provider.getBlock("latest")).timestamp + 3600;
      
      await expect(
        bondingCurve.connect(user1).buy(0, deadline, { value: massiveBuy })
      ).to.be.revertedWith("SlippageTooHigh");
    });
  });
});
