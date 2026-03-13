import { expect } from "chai";
import { ethers } from "hardhat";
import type { MockUSDC } from "../types";

describe("MockUSDC", function () {
  let usdc: MockUSDC;
  let deployer: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let alice: Awaited<ReturnType<typeof ethers.getSigners>>[0];

  beforeEach(async function () {
    [deployer, alice] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("MockUSDC");
    usdc = (await factory.deploy()) as unknown as MockUSDC;
    await usdc.waitForDeployment();
  });

  it("returns name 'USD Coin'", async function () {
    expect(await usdc.name()).to.equal("USD Coin");
  });

  it("returns symbol 'USDC'", async function () {
    expect(await usdc.symbol()).to.equal("USDC");
  });

  it("returns 6 decimals", async function () {
    expect(await usdc.decimals()).to.equal(6n);
  });

  it("mint() credits balance and emits Transfer", async function () {
    const amount = 1_000_000n; // 1 USDC
    await expect(usdc.mint(alice.address, amount))
      .to.emit(usdc, "Transfer")
      .withArgs(ethers.ZeroAddress, alice.address, amount);
    expect(await usdc.balanceOf(alice.address)).to.equal(amount);
  });

  it("mint() is callable by anyone", async function () {
    const amount = 5_000_000n;
    await usdc.connect(alice).mint(alice.address, amount);
    expect(await usdc.balanceOf(alice.address)).to.equal(amount);
  });

  it("transfer() moves tokens between accounts", async function () {
    const amount = 2_000_000n;
    await usdc.mint(deployer.address, amount);
    await usdc.transfer(alice.address, amount);
    expect(await usdc.balanceOf(alice.address)).to.equal(amount);
    expect(await usdc.balanceOf(deployer.address)).to.equal(0n);
  });
});
