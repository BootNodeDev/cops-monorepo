# /implement

Execute an approved implementation plan from `/plan`. Follows the Plan → Design → Implement → Review cycle.

---

## Prerequisites

A plan must exist and be approved before invoking this skill. If no plan is present, stop and run `/plan <issue>` first.

## Behavior

### 1. Confirm the plan

Re-read the approved plan. Confirm:
- All files to touch are identified
- Steps are ordered and atomic
- COPS-specific checklist was reviewed

### 2. Execute step by step

Work through each step in the plan. After each step:
- Run the relevant check (compile, test, lint) before moving to the next
- Do not batch steps — verify incrementally

**For contracts:**
```bash
cd packages/hardhat && pnpm hardhat compile   # after each contract change
cd packages/hardhat && pnpm test              # after adding tests
```

**For frontend:**
```bash
cd packages/nextjs && pnpm check-types        # after each TS change
cd packages/nextjs && pnpm lint               # before committing
```

### 3. COPS contract rules (enforce on every file touched)

- Import `ZamaEthereumConfig` from `@fhevm/solidity/config/ZamaConfig.sol` — inherit, never call `FHE.setCoprocessor()`
- Use `FHE.*` namespace — never `TFHE.*`
- `getSalary` and any function returning an encrypted handle: use `FHE.allowTransient(handle, msg.sender)` — never `FHE.sealoutput`
- Auth on passed-in handles: `require(FHE.isAllowed(handle, msg.sender), "...")`  — never `FHE.isSenderAllowed`
- Set ACL at every write: `FHE.allowThis` + `FHE.allow` for each authorized party
- No salary amounts in any event — emit only addresses and metadata
- `lib/confidential/` imports use relative paths: `../lib/confidential/token/ERC7984/...`

### 4. Review your own output

Before declaring done, read every file you changed:
- Does it match the acceptance criteria from the issue?
- Are there any TODO comments that should be addressed now vs. tracked as OQ?
- Did you introduce any of the prohibited patterns? (run `grep -r 'TFHE\.' packages/hardhat/contracts/`)
- Are all new functions covered by tests?

### 5. Run the full verification

```bash
# Contracts
cd packages/hardhat
pnpm lint && pnpm test && pnpm coverage

# Frontend (if applicable)
cd packages/nextjs
pnpm check-types && pnpm lint && pnpm test
```

All checks must pass before proceeding to `/commit`.

### 6. Handoff

Report: what was implemented, what tests pass, any deviations from the plan and why.

Say: "Implementation complete. Run `/commit` to stage and commit."
