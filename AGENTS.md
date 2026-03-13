# COPS — Agent Configuration

Confidential Onchain Payroll System. pnpm monorepo based on fhevm-react-template.
Full technical spec: [`docs/PRD.md`](docs/PRD.md) (v1.0.0) — read this before touching any code.

---

## Stack

### Contracts (`packages/hardhat/`)
- Solidity `0.8.27`
- `@fhevm/solidity ^0.11.1` — FHE library (`FHE.*` namespace, NOT `TFHE.*`)
- `@openzeppelin/contracts ^5.6.1`
- `@openzeppelin/confidential-contracts 0.3.1` — ERC7984 confidential token library (npm, not local copy)
- Hardhat + `@fhevm/hardhat-plugin ^0.4.2` + `@fhevm/mock-utils 0.4.2`

### Frontend (`packages/nextjs/`)
- Next.js 15 App Router, React 19, TypeScript 5.8
- Wagmi 2 + Viem 2 + RainbowKit
- `@zama-fhe/relayer-sdk 0.4.2` (SepoliaConfig — built-in relayer URL)
- `@fhevm-sdk workspace:*` — `useFHEEncryption`, `useFHEDecrypt`, `useInMemoryStorage`
- TailwindCSS 4 + DaisyUI 5 + Zustand

---

## FHE Mandatory Patterns

**Coprocessor init — inheritance only:**
```solidity
// CORRECT
contract Foo is ZamaEthereumConfig, Ownable2Step { ... }

// WRONG — does not exist
FHE.setCoprocessor(CoprocessorSetup.defaultConfig());
```

**Imports:**
```solidity
import {FHE, euint64, externalEuint64, ebool} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";
```

**Re-encryption — return handle, not sealoutput:**
```solidity
// CORRECT
function getSalary(uint256 id) external returns (euint64) {
    return FHE.allowTransient(_employees[id].salary, msg.sender);
}
// WRONG — FHE.sealoutput does not apply here
```

**Auth check on passed-in handles:**
```solidity
require(FHE.isAllowed(handle, msg.sender), "Not authorized");
// NOT: FHE.isSenderAllowed(handle)  — does not exist
```

**ACL after every write:**
```solidity
FHE.allowThis(salary);
FHE.allow(salary, owner());      // employer
FHE.allow(salary, employeeWallet); // employee
```

**Never in contract code:**
- `TFHE.*` — archived API
- `FHE.setCoprocessor()` — use ZamaEthereumConfig inheritance
- `FHE.sealoutput()` — use allowTransient
- `FHE.isSenderAllowed()` — use FHE.isAllowed(handle, msg.sender)
- Plaintext `uint256 salary` — always externalEuint64 → FHE.fromExternal
- Plaintext if/else on encrypted values — use FHE.select

---

## Key Architecture Decisions

- **Token funding**: employer calls `cUSDC.wrap(payrollContractAddress, amount)` directly — no `depositFunds()` on ConfidentialPayroll.
- **No setPayrollContract()**: ERC7984's `isOperator(holder, spender) = true` when `holder == spender` — payroll can `confidentialTransferFrom` its own balance natively.
- **Salary immutability**: salaries are immutable after registration. To change: deactivate + re-add.
- **ERC7984 library**: `@openzeppelin/confidential-contracts@0.3.1` npm package. Peer dep conflict with `@fhevm/solidity@^0.11.1` was resolved upstream — npm package works correctly (compile-time warning only).
- **Target network**: Sepolia testnet (chainId 11155111).
- **No backend**: fully client-side. Vercel static deploy.

---

## Contract Structure

```
packages/hardhat/
├── contracts/
│   ├── MockUSDC.sol               ← ERC20 (open mint, testnet only)
│   ├── ConfidentialUSDC.sol       ← ZamaEthereumConfig, ERC7984ERC20Wrapper
│   ├── ConfidentialPayroll.sol    ← ZamaEthereumConfig, Ownable2Step, ReentrancyGuard, Pausable
│   └── interfaces/
│       └── IConfidentialUSDC.sol  ← minimal interface for ConfidentialPayroll
└── node_modules/
    └── @openzeppelin/confidential-contracts/  ← ERC7984, ERC7984ERC20Wrapper, FHESafeMath (npm)
```

---

## Testing

- Framework: Hardhat + `@fhevm/mock-utils` (no Docker needed for unit tests)
- Coverage target: ≥ 95% line coverage via `solidity-coverage`
- Run: `cd packages/hardhat && pnpm test`
- Coverage: `cd packages/hardhat && pnpm coverage`

Frontend:
- Framework: Vitest, colocated `*.test.ts` files
- Run: `cd packages/nextjs && pnpm test`

---

## Commit Standards

Follow the [7 Rules of a Great Commit Message](https://cbea.ms/git-commit/):
1. Separate subject from body with a blank line
2. Limit the subject line to 72 characters
3. Use the imperative mood in the subject line
4. Do not end the subject line with a period
5. Use the body to explain *what* and *why*, not *how*

Examples:
```
Add batchAddEmployees with FHE salary encryption

Stores each salary as a euint64 handle with ACL grants for
both employer and employee at registration time.
```

---

## Branch Strategy

```
main          ← protected; PR + CI required
feature/*     ← one issue = one branch = one PR
```

Naming: `feature/epic1-confidential-usdc`, `feature/epic2-csv-upload`, etc.
Parallel workstreams: use `git worktrees`.

---

## PR Checklist (from .github/PULL_REQUEST_TEMPLATE.md)

- Self-reviewed diff
- Tests added or updated
- `pnpm lint` passes
- `pnpm check-types` passes (frontend)
- No unrelated changes bundled
