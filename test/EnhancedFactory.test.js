const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("EnhancedFactory", function () {
  async function deployFactoryFixture() {
    const [owner, treasury, creator, user1, user2] = await ethers.getSigners();

    const MemeToken = await ethers.getContractFactory("MemeToken");
    const EnhancedBondingCurve = await ethers.getContractFactory("EnhancedBondingCurve");
    const EnhancedFactory = await ethers.getContractFactory("EnhancedFactory");

    // Default fee split: 50% platform, 30% creator, 10% burn, 10% LP
    const feeSplit = {
      platformFeeBps: 5000,
      creatorFeeBps: 3000,
      burnFeeBps: 1000,
      lpFeeBps: 1000,
    };

    const factory = await EnhancedFactory.deploy(
      treasury.address,
      50, // 0.5% default fee
      feeSplit
    );

    return { factory, owner, treasury, creator, user1, user2, feeSplit };
  }

  describe("Deployment", function () {
    it("Should set the right roles", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      
      const DEFAULT_ADMIN_ROLE = await factory.DEFAULT_ADMIN_ROLE();
      const GAME_ADMIN_ROLE = await factory.GAME_ADMIN_ROLE();
      
      expect(await factory.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await factory.hasRole(GAME_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("Should set correct treasury and fees", async function () {
      const { factory, treasury } = await loadFixture(deployFactoryFixture);
      
      expect(await factory.treasury()).to.equal(treasury.address);
      expect(await factory.defaultFeeBps()).to.equal(50);
    });
  });

  describe("Access Control", function () {
    it("Should allow DEFAULT_ADMIN_ROLE to pause", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      
      await factory.pause();
      expect(await factory.paused()).to.be.true;
      
      await factory.unpause();
      expect(await factory.paused()).to.be.false;
    });

    it("Should reject pause from non-admin", async function () {
      const { factory, user1 } = await loadFixture(deployFactoryFixture);
      
      await expect(factory.connect(user1).pause()).to.be.reverted;
    });

    it("Should allow GAME_ADMIN_ROLE to manage whitelist", async function () {
      const { factory, owner, creator } = await loadFixture(deployFactoryFixture);
      
      await factory.setWhitelistedCreator(creator.address, true);
      expect(await factory.whitelistedCreators(creator.address)).to.be.true;
      
      await factory.setWhitelistedCreator(creator.address, false);
      expect(await factory.whitelistedCreators(creator.address)).to.be.false;
    });
  });

  describe("Token Creation", function () {
    it("Should create token pair and emit events", async function () {
      const { factory, creator } = await loadFixture(deployFactoryFixture);
      
      const seedAmount = ethers.parseEther("1.0");
      const seedTokens = ethers.parseUnits("1000000", 18);
      
      await expect(
        factory.connect(creator).createPair(
          "Test Token",
          "TEST",
          seedTokens,
          0, // LINEAR curve
          "0x" // empty params
        )
      ).to.emit(factory, "TokenCreated")
        .withArgs(
          (token) => token !== ethers.ZeroAddress,
          (curve) => curve !== ethers.ZeroAddress,
          creator.address,
          "Test Token",
          "TEST",
          seedAmount,
          seedTokens
        );
    });

    it("Should track token mappings", async function () {
      const { factory, creator } = await loadFixture(deployFactoryFixture);
      
      const seedAmount = ethers.parseEther("1.0");
      const seedTokens = ethers.parseUnits("1000000", 18);
      
      const tx = await factory.connect(creator).createPair(
        "Test Token",
        "TEST",
        seedTokens,
        0,
        "0x"
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(
        log => factory.interface.parseLog(log)?.name === "TokenCreated"
      );
      const parsed = factory.interface.parseLog(event);
      const tokenAddr = parsed.args.token;
      const curveAddr = parsed.args.curve;
      
      expect(await factory.tokenToCurve(tokenAddr)).to.equal(curveAddr);
      expect(await factory.curveToToken(curveAddr)).to.equal(tokenAddr);
      expect(await factory.tokenToCreator(tokenAddr)).to.equal(creator.address);
    });

    it("Should reject creation when paused", async function () {
      const { factory, creator, owner } = await loadFixture(deployFactoryFixture);
      
      await factory.connect(owner).pause();
      
      const seedTokens = ethers.parseUnits("1000000", 18);
      await expect(
        factory.connect(creator).createPair(
          "Test Token",
          "TEST",
          seedTokens,
          0,
          "0x"
        )
      ).to.be.revertedWithCustomError(factory, "EnforcedPause");
    });
  });

  describe("Fee Configuration", function () {
    it("Should update fee split", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      
      const newFeeSplit = {
        platformFeeBps: 6000,
        creatorFeeBps: 2000,
        burnFeeBps: 1000,
        lpFeeBps: 1000,
      };
      
      await expect(factory.connect(owner).setFeeSplit(newFeeSplit))
        .to.emit(factory, "FeeConfigUpdated")
        .withArgs(6000, 2000, 1000, 1000);
    });

    it("Should reject invalid fee split (>100%)", async function () {
      const { factory, owner } = await loadFixture(deployFactoryFixture);
      
      const invalidFeeSplit = {
        platformFeeBps: 6000,
        creatorFeeBps: 3000,
        burnFeeBps: 2000,
        lpFeeBps: 2000, // Total > 100%
      };
      
      await expect(factory.connect(owner).setFeeSplit(invalidFeeSplit))
        .to.be.revertedWith("fee split > 100%");
    });
  });

  describe("Emergency Functions", function () {
    it("Should allow emergency withdraw of native tokens", async function () {
      const { factory, owner, treasury } = await loadFixture(deployFactoryFixture);
      
      // Send some native tokens to factory
      await owner.sendTransaction({
        to: await factory.getAddress(),
        value: ethers.parseEther("1.0"),
      });
      
      const balanceBefore = await ethers.provider.getBalance(treasury.address);
      await factory.connect(owner).emergencyWithdrawNative(ethers.parseEther("1.0"));
      const balanceAfter = await ethers.provider.getBalance(treasury.address);
      
      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("1.0"));
    });
  });
});


