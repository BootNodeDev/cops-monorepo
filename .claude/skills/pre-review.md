# /pre-review

Review your own local diff before opening a PR. Catch issues before reviewers see them.

---

## Behavior

### 1. Get the diff

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

If the branch isn't pushed yet:
```bash
git diff main...HEAD
```

### 2. Run all checks

```bash
# Contracts
cd packages/hardhat && pnpm lint && pnpm test && pnpm coverage

# Frontend (if changed)
cd packages/nextjs && pnpm check-types && pnpm lint && pnpm test
```

All must pass. If any fail, stop — fix before reviewing.

### 3. Review the diff against the issue

Fetch the linked issue:
```bash
gh issue view <number>
```

Check each acceptance criterion:
- [ ] Is it implemented?
- [ ] Is it tested?
- [ ] Is it documented (if needed)?

### 4. COPS contract audit

Run for every contract file touched:

```bash
grep -r 'TFHE\.'          packages/hardhat/contracts/  # must be empty
grep -r 'setCoprocessor'  packages/hardhat/contracts/  # must be empty
grep -r 'sealoutput'      packages/hardhat/contracts/  # must be empty
grep -r 'isSenderAllowed' packages/hardhat/contracts/  # must be empty
```

Check each contract inherits `ZamaEthereumConfig`:
```bash
grep -r 'ZamaEthereumConfig' packages/hardhat/contracts/
```

### 5. General code review

Flag any of the following:
- Commented-out code left in
- TODO comments that should be tracked as issues (not buried in code)
- Functions > 100 lines
- Missing error messages on `require` / `revert`
- Hardcoded addresses or values that should be env vars
- Unhandled edge cases visible from the diff

### 6. Report

Produce a structured report:

```
## Pre-review report

**Checks:** ✅ lint / ✅ tests / ✅ coverage / ✅ types

**Acceptance criteria:**
- [x] <criterion 1>
- [x] <criterion 2>
- [ ] <criterion 3> — NOT MET: <explanation>

**Issues found:**
- <file>:<line> — <description>

**Verdict:** Ready to open PR / Needs fixes first
```

If verdict is "Needs fixes", describe each fix concisely. Do not open the PR until all are resolved.
