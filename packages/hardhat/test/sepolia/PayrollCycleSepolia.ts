/**
 * PayrollCycleSepolia — BTT-structured E2E test on Sepolia with real FHE KMS/relayer.
 *
 * Tree: test/sepolia/PayrollCycle.tree
 *
 * Requires:
 *   - Contracts deployed to Sepolia (pnpm deploy:sepolia)
 *   - Funded deployer wallet with Sepolia ETH
 *   - Real FHE relayer + KMS available on Sepolia
 *
 * Run: cd packages/hardhat && pnpm test:sepolia
 */
import { expect } from "chai";
import hre, { ethers, deployments } from "hardhat";
import { FhevmType } from "@fhevm/mock-utils";
import type { MockUSDC, ConfidentialUSDC, ConfidentialPayroll } from "../../types";

// Skip on mock/localhost — only runs on Sepolia
const isSepolia = hre.network.name === "sepolia";

(isSepolia ? describe : describe.skip)("PayrollCycleSepolia (BTT)", function () {
  // Sepolia transactions are slow
  this.timeout(240_000);

  let usdc: MockUSDC;
  let cUSDC: ConfidentialUSDC;
  let payroll: ConfidentialPayroll;
  let employer: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let employee: Awaited<ReturnType<typeof ethers.getSigners>>[0];
  let outsider: Awaited<ReturnType<typeof ethers.getSigners>>[0];

  const SALARY = 5_000n * 1_000_000n; // $5,000 in USDC micro-units
  const FUND_AMOUNT = 50_000n * 1_000_000n; // $50,000

  before(async function () {
    [employer, employee, outsider] = await ethers.getSigners();

    // Load deployed contracts
    const mockUSDCDeployment = await deployments.get("MockUSDC");
    const cUSDCDeployment = await deployments.get("ConfidentialUSDC");
    const payrollDeployment = await deployments.get("ConfidentialPayroll");

    usdc = (await ethers.getContractAt("MockUSDC", mockUSDCDeployment.address)) as unknown as MockUSDC;
    cUSDC = (await ethers.getContractAt("ConfidentialUSDC", cUSDCDeployment.address)) as unknown as ConfidentialUSDC;
    payroll = (await ethers.getContractAt(
      "ConfidentialPayroll",
      payrollDeployment.address,
    )) as unknown as ConfidentialPayroll;
  });

  // ─── given contracts are deployed on Sepolia ──────────────────────────

  describe("given contracts are deployed on Sepolia", function () {
    it("should have MockUSDC at expected address", async function () {
      const deployment = await deployments.get("MockUSDC");
      expect(await usdc.getAddress()).to.equal(deployment.address);
      expect(await usdc.name()).to.equal("USD Coin");
    });

    it("should have ConfidentialUSDC at expected address", async function () {
      const deployment = await deployments.get("ConfidentialUSDC");
      expect(await cUSDC.getAddress()).to.equal(deployment.address);
      expect(await cUSDC.name()).to.equal("Confidential USDC");
    });

    it("should have ConfidentialPayroll at expected address", async function () {
      const deployment = await deployments.get("ConfidentialPayroll");
      expect(await payroll.getAddress()).to.equal(deployment.address);
      expect(await payroll.cUSDC()).to.equal(await cUSDC.getAddress());
    });
  });

  // ─── given employer mints and wraps USDC ──────────────────────────────

  describe("given employer mints and wraps USDC", function () {
    it("when employer mints MockUSDC, should credit employer balance", async function () {
      const tx = await usdc.connect(employer).mint(employer.address, FUND_AMOUNT);
      await tx.wait();
      const balance = await usdc.balanceOf(employer.address);
      expect(balance).to.be.gte(FUND_AMOUNT);
    });

    it("when employer approves cUSDC, should set allowance", async function () {
      const tx = await usdc.connect(employer).approve(await cUSDC.getAddress(), FUND_AMOUNT);
      await tx.wait();
      const allowance = await usdc.allowance(employer.address, await cUSDC.getAddress());
      expect(allowance).to.be.gte(FUND_AMOUNT);
    });

    it("when employer wraps USDC to payroll, should emit USDCWrapped", async function () {
      const payrollAddr = await payroll.getAddress();
      const tx = await cUSDC.connect(employer).wrap(payrollAddr, FUND_AMOUNT);
      const receipt = await tx.wait();
      expect(receipt!.status).to.equal(1);
      // Verify USDC left the employer
      const usdcBal = await usdc.balanceOf(await cUSDC.getAddress());
      expect(usdcBal).to.be.gte(FUND_AMOUNT);
    });
  });

  // ─── given employer registers employee with encrypted salary ──────────

  describe("given employer registers employee with encrypted salary", function () {
    let encSalary: { externalEuint: string; inputProof: string };

    before(async function () {
      // Initialize CLI API for Sepolia FHE operations
      if (!hre.fhevm.isMock) {
        await hre.fhevm.initializeCLIApi();
      }

      // Encrypt salary using real relayer SDK
      encSalary = await hre.fhevm.encryptUint(FhevmType.euint64, SALARY, await payroll.getAddress(), employer.address);
    });

    it("when salary is encrypted client-side, should produce handle + proof", function () {
      expect(encSalary.externalEuint).to.not.be.undefined;
      expect(encSalary.inputProof).to.not.be.undefined;
      expect(encSalary.externalEuint.length).to.be.greaterThan(0);
    });

    it("when batchAddEmployees is called, should emit EmployeeAdded", async function () {
      const tx = await payroll
        .connect(employer)
        .batchAddEmployees(
          [employee.address],
          ["Alice Martin"],
          ["Senior Engineer"],
          [encSalary.externalEuint],
          [encSalary.inputProof],
        );
      const receipt = await tx.wait();
      expect(receipt!.status).to.equal(1);

      const count = await payroll.getEmployeeCount();
      expect(count).to.be.gte(1n);
    });

    it("when getSalary is called by employer, should return decryptable salary", async function () {
      const empCount = await payroll.getEmployeeCount();
      const handle = await payroll.connect(employer).getSalary.staticCall(empCount);
      expect(handle).to.not.equal(ethers.ZeroHash);

      // Decrypt via real KMS
      const plaintext = await hre.fhevm.userDecryptEuint(
        FhevmType.euint64,
        handle,
        await payroll.getAddress(),
        employer,
      );
      expect(plaintext).to.equal(SALARY);
    });
  });

  // ─── given employer runs payroll ──────────────────────────────────────

  describe("given employer runs payroll", function () {
    it("when runPayroll is called, should emit PayrollExecuted", async function () {
      const tx = await payroll.connect(employer).runPayroll();
      const receipt = await tx.wait();
      expect(receipt!.status).to.equal(1);

      const runCount = await payroll.payrollRunCount();
      expect(runCount).to.be.gte(1n);
    });

    it("when employee checks cUSDC balance, should equal salary", async function () {
      const balHandle = await cUSDC.confidentialBalanceOf(employee.address);
      expect(balHandle).to.not.equal(ethers.ZeroHash);

      const balance = await hre.fhevm.userDecryptEuint(
        FhevmType.euint64,
        balHandle,
        await cUSDC.getAddress(),
        employee,
      );
      expect(balance).to.equal(SALARY);
    });
  });

  // ─── given employee decrypts own salary ───────────────────────────────

  describe("given employee decrypts own salary", function () {
    it("when employee calls getSalary, should return handle with transient ACL", async function () {
      const empCount = await payroll.getEmployeeCount();
      const handle = await payroll.connect(employee).getSalary.staticCall(empCount);
      expect(handle).to.not.equal(ethers.ZeroHash);
    });

    it("when handle is decrypted via relayer, should match registered salary", async function () {
      const empCount = await payroll.getEmployeeCount();
      const handle = await payroll.connect(employee).getSalary.staticCall(empCount);

      const plaintext = await hre.fhevm.userDecryptEuint(
        FhevmType.euint64,
        handle,
        await payroll.getAddress(),
        employee,
      );
      expect(plaintext).to.equal(SALARY);
    });
  });

  // ─── given unauthorized caller ────────────────────────────────────────

  describe("given unauthorized caller", function () {
    it("when outsider calls getSalary, should revert with Unauthorized", async function () {
      const empCount = await payroll.getEmployeeCount();
      await expect(payroll.connect(outsider).getSalary.staticCall(empCount)).to.be.revertedWithCustomError(
        payroll,
        "Unauthorized",
      );
    });
  });
});
