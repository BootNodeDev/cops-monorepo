import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/**
 * Verify all COPS contracts on Etherscan.
 * Only runs on Sepolia (skipped on localhost/hardhat).
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if (hre.network.name === "hardhat" || hre.network.name === "localhost") {
    return;
  }

  const { log } = hre.deployments;
  const mockUSDC = await hre.deployments.get("MockUSDC");
  const confidentialUSDC = await hre.deployments.get("ConfidentialUSDC");
  const confidentialPayroll = await hre.deployments.get("ConfidentialPayroll");

  log("Verifying contracts on Etherscan...");

  try {
    await hre.run("verify:verify", {
      address: mockUSDC.address,
      constructorArguments: [],
    });
    log(`  MockUSDC verified at ${mockUSDC.address}`);
  } catch (e: unknown) {
    log(`  MockUSDC verification skipped: ${(e as Error).message?.slice(0, 80)}`);
  }

  try {
    await hre.run("verify:verify", {
      address: confidentialUSDC.address,
      constructorArguments: [mockUSDC.address],
    });
    log(`  ConfidentialUSDC verified at ${confidentialUSDC.address}`);
  } catch (e: unknown) {
    log(`  ConfidentialUSDC verification skipped: ${(e as Error).message?.slice(0, 80)}`);
  }

  try {
    await hre.run("verify:verify", {
      address: confidentialPayroll.address,
      constructorArguments: [confidentialUSDC.address, mockUSDC.address],
    });
    log(`  ConfidentialPayroll verified at ${confidentialPayroll.address}`);
  } catch (e: unknown) {
    log(`  ConfidentialPayroll verification skipped: ${(e as Error).message?.slice(0, 80)}`);
  }
};

export default func;
func.id = "verify_cops";
func.tags = ["verify"];
func.dependencies = ["cops"];
func.runAtTheEnd = true;
