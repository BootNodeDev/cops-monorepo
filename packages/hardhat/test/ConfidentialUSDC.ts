import { expect } from "chai";
import { ethers } from "hardhat";
import type { MockUSDC, ConfidentialUSDC } from "../types";

describe("ConfidentialUSDC", function () {
  let usdc: MockUSDC;
  let cUSDC: ConfidentialUSDC;
  let deployer: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let alice: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let bob: Awaited<ReturnType<typeof ethers.getSigners>>[0];

  const INITIAL_MINT = 100_000n * 1_000_000n; // 100k USDC

  beforeEach(async function () {
    [deployer, alice, bob] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = (await MockUSDC.deploy()) as unknown as MockUSDC;
    await usdc.waitForDeployment();

    const CUSDC = await ethers.getContractFactory("ConfidentialUSDC");
    cUSDC = (await CUSDC.deploy(await usdc.getAddress())) as unknown as ConfidentialUSDC;
    await cUSDC.waitForDeployment();

    // Mint USDC and approve cUSDC
    await usdc.mint(deployer.address, INITIAL_MINT);
    await usdc.approve(await cUSDC.getAddress(), INITIAL_MINT);
  });

  it("returns name 'Confidential USDC'", async function () {
    expect(await cUSDC.name()).to.equal("Confidential USDC");
  });

  it("returns symbol 'cUSDC'", async function () {
    expect(await cUSDC.symbol()).to.equal("cUSDC");
  });

  it("returns 6 decimals", async function () {
    expect(await cUSDC.decimals()).to.equal(6n);
  });

  it("returns rate 1 (same decimals)", async function () {
    expect(await cUSDC.rate()).to.equal(1n);
  });

  it("wrap() mints cUSDC and emits USDCWrapped", async function () {
    const amount = 10_000n * 1_000_000n;
    await expect(cUSDC.wrap(alice.address, amount))
      .to.emit(cUSDC, "USDCWrapped")
      .withArgs(deployer.address, alice.address, amount);

    // USDC moved from deployer to cUSDC contract
    expect(await usdc.balanceOf(await cUSDC.getAddress())).to.equal(amount);
  });

  it("wrap() fails without USDC approval", async function () {
    await usdc.connect(alice).mint(alice.address, 1_000_000n);
    // alice has not approved cUSDC
    await expect(cUSDC.connect(alice).wrap(alice.address, 1_000_000n)).to.be.reverted;
  });

  it("wrap() mints directly to a third-party address", async function () {
    const amount = 5_000n * 1_000_000n;
    // Deployer wraps USDC to bob's address
    await cUSDC.wrap(bob.address, amount);
    // USDC leaves deployer, goes to cUSDC contract
    expect(await usdc.balanceOf(deployer.address)).to.equal(INITIAL_MINT - amount);
    expect(await usdc.balanceOf(await cUSDC.getAddress())).to.equal(amount);
  });

  it("isOperator(self, self) returns true", async function () {
    expect(await cUSDC.isOperator(deployer.address, deployer.address)).to.equal(true);
  });

  it("confidentialBalanceOf() returns a handle after wrap", async function () {
    await cUSDC.wrap(alice.address, 1_000_000n);
    const handle = await cUSDC.confidentialBalanceOf(alice.address);
    // Handle is a non-zero bytes32 value
    expect(handle).to.not.equal(ethers.ZeroHash);
  });

  it("underlying() returns MockUSDC address", async function () {
    expect(await cUSDC.underlying()).to.equal(await usdc.getAddress());
  });
});
