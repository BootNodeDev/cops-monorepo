import { task } from "hardhat/config";

task("transfer-ownership", "Transfer ConfidentialPayroll ownership (Ownable2Step)")
  .addParam("to", "New owner address")
  .setAction(async ({ to }, hre) => {
    const { ethers, deployments } = hre;
    const [deployer] = await ethers.getSigners();

    const payrollDeployment = await deployments.get("ConfidentialPayroll");
    const payroll = await ethers.getContractAt("ConfidentialPayroll", payrollDeployment.address, deployer);

    const currentOwner = await payroll.owner();
    console.log(`Current owner: ${currentOwner}`);
    console.log(`Transferring to: ${to}`);

    // Step 1: initiate transfer (Ownable2Step)
    const tx = await payroll.transferOwnership(to);
    await tx.wait();
    console.log(`Step 1 done: transferOwnership(${to}) — tx: ${tx.hash}`);
    console.log(`\nStep 2: The new owner must call acceptOwnership() to complete the transfer.`);
    console.log(`  npx hardhat accept-ownership --network ${hre.network.name}`);
  });

task("accept-ownership", "Accept pending ConfidentialPayroll ownership transfer").setAction(async (_, hre) => {
  const { ethers, deployments } = hre;
  const [signer] = await ethers.getSigners();

  const payrollDeployment = await deployments.get("ConfidentialPayroll");
  const payroll = await ethers.getContractAt("ConfidentialPayroll", payrollDeployment.address, signer);

  const pendingOwner = await payroll.pendingOwner();
  const signerAddr = await signer.getAddress();
  console.log(`Pending owner: ${pendingOwner}`);
  console.log(`Signer: ${signerAddr}`);

  if (pendingOwner.toLowerCase() !== signerAddr.toLowerCase()) {
    console.error(`Error: signer ${signerAddr} is not the pending owner ${pendingOwner}`);
    return;
  }

  const tx = await payroll.acceptOwnership();
  await tx.wait();
  console.log(`Ownership accepted! New owner: ${await payroll.owner()}`);
});
