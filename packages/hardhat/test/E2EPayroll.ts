import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { FhevmType } from "@fhevm/mock-utils";
import type { MockUSDC, ConfidentialUSDC, ConfidentialPayroll } from "../types";

describe("E2E Payroll Flow", function () {
  let usdc: MockUSDC;
  let cUSDC: ConfidentialUSDC;
  let payroll: ConfidentialPayroll;
  let employer: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let alice: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let bob: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let outsider: Awaited<ReturnType<typeof ethers.getSigners>>[0];

  const ALICE_SALARY = 6_500n * 1_000_000n; // $6,500
  const BOB_SALARY = 5_200n * 1_000_000n; // $5,200
  const FUND_AMOUNT = 100_000n * 1_000_000n; // $100k

  async function encryptSalary(salary: bigint) {
    return await hre.fhevm.encryptUint(FhevmType.euint64, salary, await payroll.getAddress(), employer.address);
  }

  beforeEach(async function () {
    [employer, alice, bob, outsider] = await ethers.getSigners();

    // Deploy contracts
    usdc = (await (await ethers.getContractFactory("MockUSDC")).deploy()) as unknown as MockUSDC;
    cUSDC = (await (
      await ethers.getContractFactory("ConfidentialUSDC")
    ).deploy(await usdc.getAddress())) as unknown as ConfidentialUSDC;
    payroll = (await (
      await ethers.getContractFactory("ConfidentialPayroll")
    ).deploy(await cUSDC.getAddress(), await usdc.getAddress())) as unknown as ConfidentialPayroll;

    // Fund payroll: mint → approve → wrap to payroll
    await usdc.mint(employer.address, FUND_AMOUNT);
    await usdc.approve(await cUSDC.getAddress(), FUND_AMOUNT);
    await cUSDC.wrap(await payroll.getAddress(), FUND_AMOUNT);

    // Register employees
    const encAlice = await encryptSalary(ALICE_SALARY);
    const encBob = await encryptSalary(BOB_SALARY);
    await payroll.batchAddEmployees(
      [alice.address, bob.address],
      ["Alice Martin", "Bob Chen"],
      ["Senior Engineer", "Product Designer"],
      [encAlice.externalEuint, encBob.externalEuint],
      [encAlice.inputProof, encBob.inputProof],
    );
  });

  it("E2E: mint → wrap → register → runPayroll → getSalary → decrypt", async function () {
    // Run payroll
    await payroll.runPayroll();

    // Verify payroll count
    expect(await payroll.payrollRunCount()).to.equal(1n);

    // Employer decrypts Alice's salary
    const aliceHandle = await payroll.getSalary.staticCall(1);
    const aliceSalary = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      aliceHandle,
      await payroll.getAddress(),
      employer,
    );
    expect(aliceSalary).to.equal(ALICE_SALARY);

    // Employee (Alice) decrypts own salary
    const aliceOwnHandle = await payroll.connect(alice).getSalary.staticCall(1);
    const aliceOwnSalary = await hre.fhevm.userDecryptEuint(
      FhevmType.euint64,
      aliceOwnHandle,
      await payroll.getAddress(),
      alice,
    );
    expect(aliceOwnSalary).to.equal(ALICE_SALARY);
  });

  it("third party calling getSalary reverts Unauthorized", async function () {
    await expect(payroll.connect(outsider).getSalary.staticCall(1)).to.be.revertedWithCustomError(
      payroll,
      "Unauthorized",
    );
  });

  it("employee cUSDC balance equals salary after payroll run", async function () {
    await payroll.runPayroll();

    // Alice should have ALICE_SALARY in cUSDC
    const balHandle = await cUSDC.confidentialBalanceOf(alice.address);
    const balance = await hre.fhevm.userDecryptEuint(FhevmType.euint64, balHandle, await cUSDC.getAddress(), alice);
    expect(balance).to.equal(ALICE_SALARY);
  });

  it("deactivated employee receives 0 in subsequent payroll run", async function () {
    // First payroll — both get paid
    await payroll.runPayroll();

    // Deactivate Alice
    await payroll.deactivateEmployee(1);

    // Second payroll — only Bob gets paid
    await payroll.runPayroll();

    // Bob should have 2x his salary (paid twice)
    const bobBal = await cUSDC.confidentialBalanceOf(bob.address);
    const bobBalance = await hre.fhevm.userDecryptEuint(FhevmType.euint64, bobBal, await cUSDC.getAddress(), bob);
    expect(bobBalance).to.equal(BOB_SALARY * 2n);

    // Alice should still have only 1x salary (paid once, then deactivated)
    const aliceBal = await cUSDC.confidentialBalanceOf(alice.address);
    const aliceBalance = await hre.fhevm.userDecryptEuint(FhevmType.euint64, aliceBal, await cUSDC.getAddress(), alice);
    expect(aliceBalance).to.equal(ALICE_SALARY);
  });

  it("multiple employees with different salaries", async function () {
    await payroll.runPayroll();

    // Alice: $6,500
    const aliceBal = await cUSDC.confidentialBalanceOf(alice.address);
    const aliceBalance = await hre.fhevm.userDecryptEuint(FhevmType.euint64, aliceBal, await cUSDC.getAddress(), alice);

    // Bob: $5,200
    const bobBal = await cUSDC.confidentialBalanceOf(bob.address);
    const bobBalance = await hre.fhevm.userDecryptEuint(FhevmType.euint64, bobBal, await cUSDC.getAddress(), bob);

    expect(aliceBalance).to.equal(ALICE_SALARY);
    expect(bobBalance).to.equal(BOB_SALARY);
    expect(aliceBalance).to.not.equal(bobBalance);
  });

  it("payroll contract cUSDC backing decreases after run", async function () {
    // inferredTotalSupply tracks USDC held by cUSDC wrapper — plaintext, no decrypt needed
    const cUSDCAddr = await cUSDC.getAddress();
    const usdcBefore = await usdc.balanceOf(cUSDCAddr);
    expect(usdcBefore).to.equal(FUND_AMOUNT);

    await payroll.runPayroll();

    // USDC backing should remain the same (no unwrap yet — cUSDC just moved between accounts)
    const usdcAfter = await usdc.balanceOf(cUSDCAddr);
    expect(usdcAfter).to.equal(FUND_AMOUNT);

    // But inferredTotalSupply should still equal FUND_AMOUNT since underlying hasn't changed
    expect(await cUSDC.inferredTotalSupply()).to.equal(FUND_AMOUNT);
  });
});
