# Roadmap

> **Current version:** v1.0 — Core confidential payroll on Sepolia
> All items below are post-bounty. Priorities to be confirmed by the team.

---

## At a Glance

| Phase | Focus | Status |
|---|---|---|
| [v1.0 — Core](#v10--core) | Encrypted payroll, ERC-7984, employer + employee flows | ✅ Shipped |
| [v1.1 — Hardening](#v11--hardening) | Contract improvements, DX, UX polish | 🔜 Next |
| [v2.0 — Access Control](#v20--access-control) | Multisig, gasless UX, employment attestations | 💬 Under Consideration |
| [v3.0 — Integrations](#v30--integrations) | Cross-chain, salary streaming, DeFi hooks | 💬 Under Consideration |

---

## v1.0 — Core
> Shipped

- Encrypted employee registration via `batchAddEmployees` — salaries never leave the browser in plaintext
- Confidential payroll execution via ERC-7984 `confidentialTransferFrom` — zero amounts in events
- Per-employee salary decryption — employer and employee only, enforced by on-chain ACL
- cUSDC balance check and async two-step unwrap to plain USDC
- 98% smart contract test coverage, deployed and verified on Sepolia

---

## v1.1 — Hardening
> Next milestone — contract improvements and DX

### Smart Contracts

| Feature | Description |
|---|---|
| **Salary updates** | `updateSalary(id, externalEuint64, proof)` — currently requires deactivate + re-add |
| **Paginated payroll** | `runPayroll(startId, endId)` — prevents gas limit issues at 50+ employees |
| **On-chain payroll history** | Track timestamp and run ID per employee per cycle — auditable without exposing amounts |
| **Batch transactions** | Bundle register + fund + run into a single atomic call via `Multicall3` — reduces wallet confirmations from 3 to 1 |

### Developer Experience

| Feature | Description |
|---|---|
| **CI coverage gate** | Enforce ≥95% line coverage as a hard CI failure, not just a target |
| **Gas regression tracking** | Surface `hardhat-gas-reporter` output on every PR — catch regressions in `runPayroll` before merging |
| **Testnet faucet in UI** | One-click MockUSDC mint in the employer dashboard for demo and onboarding |

---

## v2.0 — Access Control
> Real-world viability — multisig, gasless UX, verifiable employment

### Gnosis Safe Integration

No production company runs payroll from a single EOA. The `/safe` route wraps all employer transactions — `batchAddEmployees`, `wrap`, `runPayroll` — inside a Safe multisig proposal. Requires M-of-N signatures before execution. This is the single highest-impact change for real-world adoption.

```
Employer submits proposal → Safe signers approve → transaction executes
```

| Scope | Detail |
|---|---|
| New route | `/safe` — loads dApp as a Safe App |
| Affected flows | Employee registration, fund payroll, run payroll |
| Dependency | Gnosis Safe deployed on Sepolia ✅ |

---

### Account Abstraction (ERC-4337)

Employees should not need ETH to decrypt their salary or unwrap cUSDC. A Paymaster contract sponsored by the employer covers gas for all employee-side operations.

| Operation | Sponsored by |
|---|---|
| `getSalary()` — salary decryption | Employer Paymaster |
| `encryptedBalanceOf()` — balance check | Employer Paymaster |
| `unwrap()` + `finalizeUnwrap()` | Employer Paymaster |

Eliminates the main onboarding barrier for non-crypto-native employees.

---

### Ethereum Attestation Service (EAS)

After employee registration, the employer issues an on-chain EAS attestation:

```
"address 0x... is an active employee of organization 0x..."
```

The attestation contains **no salary, no role, no compensation data**. The employee uses it as verifiable proof of employment in DeFi protocols — collateral eligibility, undercollateralized lending, rental applications — without exposing any payroll information.

```
Register employee → employer signs EAS attestation → employee presents to DeFi protocol
```

---

## v3.0 — Integrations
> Expand the protocol surface — cross-chain, streaming, DeFi

### Cross-Chain Payroll (Chainlink CCIP)

Employer operates on one chain. Employees receive on another. Route cUSDC transfers cross-chain via Chainlink CCIP while preserving end-to-end confidentiality.

```
Employer (Ethereum) → CCIP bridge → Employee (Polygon / Base / Arbitrum)
                           ↑
                    amounts stay encrypted
```

| Target chains | Polygon, Base, Arbitrum, Optimism |
|---|---|
| Dependency | Chainlink CCIP + fhEVM support on target chains |

---

### Salary Streaming with FHE

Replace monthly batch payments with per-second salary accrual. Integrate Sablier or Superfluid with `euint64` stream handles — the running balance accumulates continuously and remains encrypted on-chain at all times.

```
Stream open → salary accrues per second (encrypted) → employee withdraws anytime
```

Highest technical complexity in this phase. Strong differentiator vs. batch payroll systems.

---

## Contributing

See [AGENTS.md](../AGENTS.md) for development conventions, FHE patterns, commit standards, and branch strategy.
Open an issue using the templates in `.github/ISSUE_TEMPLATE/` before starting any roadmap item.
