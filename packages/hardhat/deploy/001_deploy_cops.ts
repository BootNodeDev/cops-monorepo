import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Deploy COPS contracts in order:
 *   1. MockUSDC
 *   2. ConfidentialUSDC(mockUSDCAddress)
 *   3. ConfidentialPayroll(cUSDCAddress, mockUSDCAddress)
 *
 * No post-deploy authorization step needed — ERC7984's
 * isOperator(self, self) = true handles it natively.
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  // Owner override: set PAYROLL_OWNER env var to deploy with a different owner.
  // Falls back to deployer if not set.
  const payrollOwner = process.env.PAYROLL_OWNER || deployer;

  // 1. MockUSDC
  const mockUSDC = await deploy("MockUSDC", {
    from: deployer,
    args: [],
    log: true,
  });
  log(`MockUSDC deployed at ${mockUSDC.address}`);

  // 2. ConfidentialUSDC(mockUSDCAddress)
  const confidentialUSDC = await deploy("ConfidentialUSDC", {
    from: deployer,
    args: [mockUSDC.address],
    log: true,
  });
  log(`ConfidentialUSDC deployed at ${confidentialUSDC.address}`);

  // 3. ConfidentialPayroll(cUSDCAddress, mockUSDCAddress, initialOwner)
  const confidentialPayroll = await deploy("ConfidentialPayroll", {
    from: deployer,
    args: [confidentialUSDC.address, mockUSDC.address, payrollOwner],
    log: true,
  });
  log(`ConfidentialPayroll deployed at ${confidentialPayroll.address}`);
  if (payrollOwner !== deployer) {
    log(`  Owner: ${payrollOwner} (different from deployer)`);
  }

  log("\n─── COPS Deployment Summary ───");
  log(`  MockUSDC:            ${mockUSDC.address}`);
  log(`  ConfidentialUSDC:    ${confidentialUSDC.address}`);
  log(`  ConfidentialPayroll: ${confidentialPayroll.address}`);
  log("───────────────────────────────\n");
};

export default func;
func.id = "deploy_cops";
func.tags = ["cops", "MockUSDC", "ConfidentialUSDC", "ConfidentialPayroll"];
