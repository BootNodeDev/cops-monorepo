import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { FhevmType } from "@fhevm/mock-utils";
import type { MockUSDC, ConfidentialUSDC, ConfidentialPayroll } from "../types";

describe("ConfidentialPayroll", function () {
  let usdc: MockUSDC;
  let cUSDC: ConfidentialUSDC;
  let payroll: ConfidentialPayroll;
  let employer: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let employee1: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let employee2: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let outsider: Awaited<ReturnType<typeof ethers.getSigners>>[0];

  const SALARY_1 = 6_500n * 1_000_000n; // $6,500
  const SALARY_2 = 5_200n * 1_000_000n; // $5,200
  const FUND_AMOUNT = 100_000n * 1_000_000n;

  async function encryptSalary(salary: bigint, contractAddress: string, userAddress: string) {
    return await hre.fhevm.encryptUint(FhevmType.euint64, salary, contractAddress, userAddress);
  }

  async function deployAndFund() {
    [employer, employee1, employee2, outsider] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory("MockUSDC");
    usdc = (await MockUSDC.deploy()) as unknown as MockUSDC;
    await usdc.waitForDeployment();

    const CUSDC = await ethers.getContractFactory("ConfidentialUSDC");
    cUSDC = (await CUSDC.deploy(await usdc.getAddress())) as unknown as ConfidentialUSDC;
    await cUSDC.waitForDeployment();

    const Payroll = await ethers.getContractFactory("ConfidentialPayroll");
    payroll = (await Payroll.deploy(
      await cUSDC.getAddress(),
      await usdc.getAddress(),
      employer.address,
    )) as unknown as ConfidentialPayroll;
    await payroll.waitForDeployment();

    // Fund payroll: mint USDC → approve → wrap to payroll
    await usdc.mint(employer.address, FUND_AMOUNT);
    await usdc.approve(await cUSDC.getAddress(), FUND_AMOUNT);
    await cUSDC.wrap(await payroll.getAddress(), FUND_AMOUNT);
  }

  beforeEach(async function () {
    await deployAndFund();
  });

  // ─── Constructor ──────────────────────────────────────────────────────

  describe("constructor", function () {
    it("sets cUSDC and USDC addresses", async function () {
      expect(await payroll.cUSDC()).to.equal(await cUSDC.getAddress());
      expect(await payroll.USDC()).to.equal(await usdc.getAddress());
    });

    it("reverts if cUSDC address is zero", async function () {
      const Payroll = await ethers.getContractFactory("ConfidentialPayroll");
      await expect(Payroll.deploy(ethers.ZeroAddress, await usdc.getAddress(), employer.address)).to.be.revertedWithCustomError(
        payroll,
        "ZeroAddress",
      );
    });

    it("reverts if USDC address is zero", async function () {
      const Payroll = await ethers.getContractFactory("ConfidentialPayroll");
      await expect(Payroll.deploy(await cUSDC.getAddress(), ethers.ZeroAddress, employer.address)).to.be.revertedWithCustomError(
        payroll,
        "ZeroAddress",
      );
    });
  });

  // ─── batchAddEmployees ────────────────────────────────────────────────

  describe("batchAddEmployees", function () {
    it("registers employees and emits EmployeeAdded", async function () {
      const payrollAddress = await payroll.getAddress();
      const enc1 = await encryptSalary(SALARY_1, payrollAddress, employer.address);

      await expect(
        payroll.batchAddEmployees(
          [employee1.address],
          ["Alice"],
          ["Engineer"],
          [enc1.externalEuint],
          [enc1.inputProof],
        ),
      )
        .to.emit(payroll, "EmployeeAdded")
        .withArgs(1n, employee1.address);

      expect(await payroll.getEmployeeCount()).to.equal(1n);
      expect(await payroll.walletToId(employee1.address)).to.equal(1n);
    });

    it("registers multiple employees in one batch", async function () {
      const payrollAddress = await payroll.getAddress();
      const enc1 = await encryptSalary(SALARY_1, payrollAddress, employer.address);
      const enc2 = await encryptSalary(SALARY_2, payrollAddress, employer.address);

      await payroll.batchAddEmployees(
        [employee1.address, employee2.address],
        ["Alice", "Bob"],
        ["Engineer", "Designer"],
        [enc1.externalEuint, enc2.externalEuint],
        [enc1.inputProof, enc2.inputProof],
      );

      expect(await payroll.getEmployeeCount()).to.equal(2n);
    });

    it("reverts for non-owner", async function () {
      const payrollAddress = await payroll.getAddress();
      const enc = await encryptSalary(SALARY_1, payrollAddress, employee1.address);

      await expect(
        payroll
          .connect(employee1)
          .batchAddEmployees([employee1.address], ["Alice"], ["Engineer"], [enc.externalEuint], [enc.inputProof]),
      ).to.be.revertedWithCustomError(payroll, "OwnableUnauthorizedAccount");
    });

    it("reverts with LengthMismatch", async function () {
      const payrollAddress = await payroll.getAddress();
      const enc = await encryptSalary(SALARY_1, payrollAddress, employer.address);

      await expect(
        payroll.batchAddEmployees(
          [employee1.address, employee2.address], // 2 wallets
          ["Alice"], // 1 name
          ["Engineer"],
          [enc.externalEuint],
          [enc.inputProof],
        ),
      ).to.be.revertedWithCustomError(payroll, "LengthMismatch");
    });

    it("reverts with ZeroAddress for zero wallet", async function () {
      const payrollAddress = await payroll.getAddress();
      const enc = await encryptSalary(SALARY_1, payrollAddress, employer.address);

      await expect(
        payroll.batchAddEmployees([ethers.ZeroAddress], ["Zero"], ["None"], [enc.externalEuint], [enc.inputProof]),
      ).to.be.revertedWithCustomError(payroll, "ZeroAddress");
    });

    it("reverts with DuplicateEmployee if wallet already active", async function () {
      const payrollAddress = await payroll.getAddress();
      const enc1 = await encryptSalary(SALARY_1, payrollAddress, employer.address);
      const enc2 = await encryptSalary(SALARY_2, payrollAddress, employer.address);

      await payroll.batchAddEmployees(
        [employee1.address],
        ["Alice"],
        ["Engineer"],
        [enc1.externalEuint],
        [enc1.inputProof],
      );

      await expect(
        payroll.batchAddEmployees(
          [employee1.address],
          ["Alice"],
          ["Engineer"],
          [enc2.externalEuint],
          [enc2.inputProof],
        ),
      ).to.be.revertedWithCustomError(payroll, "DuplicateEmployee");
    });

    it("allows re-adding a deactivated wallet", async function () {
      const payrollAddress = await payroll.getAddress();
      const enc1 = await encryptSalary(SALARY_1, payrollAddress, employer.address);
      const enc2 = await encryptSalary(SALARY_2, payrollAddress, employer.address);

      // Add, deactivate, re-add
      await payroll.batchAddEmployees(
        [employee1.address],
        ["Alice"],
        ["Engineer"],
        [enc1.externalEuint],
        [enc1.inputProof],
      );
      await payroll.deactivateEmployee(1);

      await payroll.batchAddEmployees(
        [employee1.address],
        ["Alice v2"],
        ["Senior Engineer"],
        [enc2.externalEuint],
        [enc2.inputProof],
      );

      expect(await payroll.getEmployeeCount()).to.equal(2n);
      expect(await payroll.walletToId(employee1.address)).to.equal(2n);

      // Old record should have wallet cleared to address(0)
      const [oldWallet] = await payroll.getEmployee(1);
      expect(oldWallet).to.equal(ethers.ZeroAddress);
    });
  });

  // ─── deactivateEmployee ───────────────────────────────────────────────

  describe("deactivateEmployee", function () {
    beforeEach(async function () {
      const payrollAddress = await payroll.getAddress();
      const enc = await encryptSalary(SALARY_1, payrollAddress, employer.address);
      await payroll.batchAddEmployees(
        [employee1.address],
        ["Alice"],
        ["Engineer"],
        [enc.externalEuint],
        [enc.inputProof],
      );
    });

    it("deactivates and emits EmployeeDeactivated", async function () {
      await expect(payroll.deactivateEmployee(1))
        .to.emit(payroll, "EmployeeDeactivated")
        .withArgs(1n, employee1.address);

      const [, , , active] = await payroll.getEmployee(1);
      expect(active).to.equal(false);
    });

    it("reverts EmployeeNotFound for id=0", async function () {
      await expect(payroll.deactivateEmployee(0)).to.be.revertedWithCustomError(payroll, "EmployeeNotFound");
    });

    it("reverts EmployeeNotFound for id > length", async function () {
      await expect(payroll.deactivateEmployee(999)).to.be.revertedWithCustomError(payroll, "EmployeeNotFound");
    });

    it("reverts for non-owner", async function () {
      await expect(payroll.connect(employee1).deactivateEmployee(1)).to.be.revertedWithCustomError(
        payroll,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  // ─── runPayroll ───────────────────────────────────────────────────────

  describe("runPayroll", function () {
    beforeEach(async function () {
      const payrollAddress = await payroll.getAddress();
      const enc1 = await encryptSalary(SALARY_1, payrollAddress, employer.address);
      const enc2 = await encryptSalary(SALARY_2, payrollAddress, employer.address);
      await payroll.batchAddEmployees(
        [employee1.address, employee2.address],
        ["Alice", "Bob"],
        ["Engineer", "Designer"],
        [enc1.externalEuint, enc2.externalEuint],
        [enc1.inputProof, enc2.inputProof],
      );
    });

    it("emits PayrollExecuted with correct count", async function () {
      await expect(payroll.runPayroll()).to.emit(payroll, "PayrollExecuted");

      expect(await payroll.payrollRunCount()).to.equal(1n);
    });

    it("increments payrollRunCount on each run", async function () {
      await payroll.runPayroll();
      await payroll.runPayroll();
      expect(await payroll.payrollRunCount()).to.equal(2n);
    });

    it("skips deactivated employees", async function () {
      await payroll.deactivateEmployee(1); // deactivate Alice
      await payroll.runPayroll();

      // Only Bob should have been paid
      const [, , , , lastPaid1] = await payroll.getEmployee(1);
      const [, , , , lastPaid2] = await payroll.getEmployee(2);
      expect(lastPaid1).to.equal(0n); // Alice not paid
      expect(lastPaid2).to.not.equal(0n); // Bob was paid
    });

    it("updates lastPaidAt for active employees", async function () {
      await payroll.runPayroll();
      const [, , , , lastPaid] = await payroll.getEmployee(1);
      expect(lastPaid).to.be.greaterThan(0n);
    });

    it("reverts for non-owner", async function () {
      await expect(payroll.connect(employee1).runPayroll()).to.be.revertedWithCustomError(
        payroll,
        "OwnableUnauthorizedAccount",
      );
    });

    it("reverts when paused", async function () {
      await payroll.pause();
      await expect(payroll.runPayroll()).to.be.revertedWithCustomError(payroll, "EnforcedPause");
    });

    it("works after unpause", async function () {
      await payroll.pause();
      await payroll.unpause();
      await expect(payroll.runPayroll()).to.emit(payroll, "PayrollExecuted");
    });
  });

  // ─── pause / unpause ──────────────────────────────────────────────────

  describe("pause / unpause", function () {
    it("only owner can pause", async function () {
      await expect(payroll.connect(employee1).pause()).to.be.revertedWithCustomError(
        payroll,
        "OwnableUnauthorizedAccount",
      );
    });

    it("only owner can unpause", async function () {
      await payroll.pause();
      await expect(payroll.connect(employee1).unpause()).to.be.revertedWithCustomError(
        payroll,
        "OwnableUnauthorizedAccount",
      );
    });
  });

  // ─── getSalary ────────────────────────────────────────────────────────

  describe("getSalary", function () {
    beforeEach(async function () {
      const payrollAddress = await payroll.getAddress();
      const enc = await encryptSalary(SALARY_1, payrollAddress, employer.address);
      await payroll.batchAddEmployees(
        [employee1.address],
        ["Alice"],
        ["Engineer"],
        [enc.externalEuint],
        [enc.inputProof],
      );
    });

    it("returns handle for employer (owner)", async function () {
      const handle = await payroll.getSalary.staticCall(1);
      expect(handle).to.not.equal(ethers.ZeroHash);
    });

    it("returns handle for the employee", async function () {
      const handle = await payroll.connect(employee1).getSalary.staticCall(1);
      expect(handle).to.not.equal(ethers.ZeroHash);
    });

    it("employer can decrypt salary via userDecryptEuint", async function () {
      const handle = await payroll.getSalary.staticCall(1);
      const plaintext = await hre.fhevm.userDecryptEuint(
        FhevmType.euint64,
        handle,
        await payroll.getAddress(),
        employer,
      );
      expect(plaintext).to.equal(SALARY_1);
    });

    it("reverts Unauthorized for third party", async function () {
      await expect(payroll.connect(outsider).getSalary.staticCall(1)).to.be.revertedWithCustomError(
        payroll,
        "Unauthorized",
      );
    });

    it("reverts EmployeeNotFound for id=0", async function () {
      await expect(payroll.getSalary.staticCall(0)).to.be.revertedWithCustomError(payroll, "EmployeeNotFound");
    });

    it("reverts EmployeeNotFound for id > length", async function () {
      await expect(payroll.getSalary.staticCall(999)).to.be.revertedWithCustomError(payroll, "EmployeeNotFound");
    });
  });

  // ─── getEmployee / getEmployeeCount ───────────────────────────────────

  describe("view functions", function () {
    beforeEach(async function () {
      const payrollAddress = await payroll.getAddress();
      const enc = await encryptSalary(SALARY_1, payrollAddress, employer.address);
      await payroll.batchAddEmployees(
        [employee1.address],
        ["Alice"],
        ["Engineer"],
        [enc.externalEuint],
        [enc.inputProof],
      );
    });

    it("getEmployee returns correct metadata", async function () {
      const [wallet, name, role, active, lastPaidAt] = await payroll.getEmployee(1);
      expect(wallet).to.equal(employee1.address);
      expect(name).to.equal("Alice");
      expect(role).to.equal("Engineer");
      expect(active).to.equal(true);
      expect(lastPaidAt).to.equal(0n);
    });

    it("getEmployee reverts EmployeeNotFound", async function () {
      await expect(payroll.getEmployee(999)).to.be.revertedWithCustomError(payroll, "EmployeeNotFound");
    });

    it("getEmployeeCount returns correct count", async function () {
      expect(await payroll.getEmployeeCount()).to.equal(1n);
    });

    it("walletToId maps correctly (1-indexed)", async function () {
      expect(await payroll.walletToId(employee1.address)).to.equal(1n);
      expect(await payroll.walletToId(outsider.address)).to.equal(0n);
    });
  });
});
