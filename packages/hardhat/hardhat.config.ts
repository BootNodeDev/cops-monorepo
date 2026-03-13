import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { vars } from "hardhat/config";
import "solidity-coverage";

import "./tasks/accounts";

// Run 'npx hardhat vars setup' to see the list of variables that need to be set
// Required: DEPLOYER_PK, ALCHEMY_API_KEY, ETHERSCAN_API_KEY

const DEPLOYER_PK: string = vars.get("DEPLOYER_PK", "");

const hardhatNetwork = process.env.HARDHAT_NETWORK;
if (
  !DEPLOYER_PK &&
  (hardhatNetwork === "sepolia" || hardhatNetwork === "anvil")
) {
  throw new Error(
    "DEPLOYER_PK is required when using the 'sepolia' or 'anvil' networks. " +
      "Please set it with `npx hardhat vars set DEPLOYER_PK`.",
  );
}

const ALCHEMY_API_KEY: string = vars.get("ALCHEMY_API_KEY", "");

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: vars.get("ETHERSCAN_API_KEY", ""),
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    anvil: {
      accounts: [DEPLOYER_PK],
      chainId: 31337,
      url: "http://localhost:8545",
    },
    localhost: {
      accounts: [DEPLOYER_PK],
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts: [DEPLOYER_PK],
      chainId: 11155111,
      url: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
