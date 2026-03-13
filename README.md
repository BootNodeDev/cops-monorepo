# COPS — Confidential Onchain Payroll System

On-chain payroll dApp where employers pay employees in encrypted USDC while keeping all salary amounts private. Built with fhEVM coprocessor and ERC-7984 confidential tokens.

## Deployed Contracts (Sepolia)

| Contract | Address | Etherscan |
|---|---|---|
| MockUSDC | `0x7FEc53132c406d74995FA36579681C18F1b76C9B` | [View](https://sepolia.etherscan.io/address/0x7FEc53132c406d74995FA36579681C18F1b76C9B#code) |
| ConfidentialUSDC | `0xFA64d7a4815803f118847438F58A4B569a91a2eb` | [View](https://sepolia.etherscan.io/address/0xFA64d7a4815803f118847438F58A4B569a91a2eb#code) |
| ConfidentialPayroll | `0xfdc7e95d02f3E092E1CE1fAfeAc866BF757EA812` | [View](https://sepolia.etherscan.io/address/0xfdc7e95d02f3E092E1CE1fAfeAc866BF757EA812#code) |

**Network:** Sepolia (chainId: 11155111)

## Stack

- **Contracts:** Solidity 0.8.27, `@fhevm/solidity ^0.11.1`, `@openzeppelin/confidential-contracts 0.3.1`, Hardhat
- **Frontend:** Next.js 15, React 19, Wagmi 2, Viem 2, RainbowKit, `@zama-fhe/relayer-sdk 0.4.2`
- **FHE SDK:** `@fhevm-sdk` workspace package (`useFHEEncryption`, `useFHEDecrypt`)

## Quick Start

### Prerequisites

- Node.js v18+
- pnpm

### Setup

```bash
pnpm install

# Set Hardhat vars
cd packages/hardhat
npx hardhat vars set DEPLOYER_PK "0x..."
npx hardhat vars set ALCHEMY_API_KEY "your_key"
npx hardhat vars set ETHERSCAN_API_KEY "your_key"
```

### Run Tests (local mock, no Docker)

```bash
cd packages/hardhat
pnpm test           # 55 tests
pnpm coverage       # 98% line coverage
```

### Deploy to Sepolia

```bash
cd packages/hardhat
pnpm deploy:sepolia

# Generate frontend contract data
npx ts-node scripts/generateDeployedContracts.ts sepolia
```

### Start Frontend

```bash
pnpm dev
# Open http://localhost:3000
```

## Project Structure

```
packages/
  hardhat/          Smart contracts, tests, deploy scripts
    contracts/
      MockUSDC.sol              ERC-20 testnet USDC (open mint, 6 decimals)
      ConfidentialUSDC.sol      ERC-7984 wrapper (wrap/unwrap USDC <-> cUSDC)
      ConfidentialPayroll.sol   Employee registry, encrypted salaries, payroll execution
      interfaces/
        IConfidentialUSDC.sol   Minimal interface for ConfidentialPayroll
    deploy/                     hardhat-deploy scripts (Sepolia)
    test/                       Unit + E2E tests (mock coprocessor)
  nextjs/           Frontend (Next.js 15 App Router)
  fhevm-sdk/        FHE hook library (workspace package)
```

## Architecture

See [docs/architecture.md](docs/architecture.md) for Mermaid diagrams covering contract dependencies, FHE coprocessor, encryption lifecycle, payroll execution, unwrap flow, and trust boundaries.

Full technical spec: [docs/PRD.md](docs/PRD.md)

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start frontend dev server |
| `pnpm test` | Run contract tests (mock FHE) |
| `pnpm deploy:sepolia` | Deploy contracts to Sepolia |
| `pnpm lint:sol` | Lint Solidity with solhint |
| `pnpm coverage` | Generate coverage report |

## License

BSD-3-Clause-Clear
