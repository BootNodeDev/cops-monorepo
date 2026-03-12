# /plan

Given a GitHub issue, produce a concrete implementation plan before touching any code.

---

## Behavior

### 1. Read the issue

Fetch the issue with:
```bash
gh issue view <number> --json title,body,labels
```

Extract: objective, acceptance criteria, technical notes, dependencies.

### 2. Explore the codebase

Read the files that will be touched. Understand existing patterns before proposing new ones. Check:
- Relevant contracts or components already in place
- Import paths, inheritance chains, naming conventions
- Existing tests for the area being changed

### 3. Produce the plan

The plan must cover:

**Approach** — one paragraph describing the overall strategy and why.

**Files to create or modify** — exhaustive list with what changes in each:
```
packages/hardhat/contracts/ConfidentialPayroll.sol  — create
packages/hardhat/test/ConfidentialPayroll.test.ts   — create
```

**Implementation steps** — ordered, atomic, each small enough to verify:
```
1. Add Employee struct and _employees[] array
2. Implement batchAddEmployees with FHE.fromExternal per salary
3. Set ACL: FHE.allowThis + FHE.allow(owner) + FHE.allow(wallet) per salary
4. Implement runPayroll with cUSDC.confidentialTransferFrom loop
5. Implement getSalary with FHE.allowTransient
6. Write unit tests for each function
7. Write integration test (wrap → register → run → decrypt)
```

**Edge cases and error paths** — what can go wrong, how the code handles it.

**Test strategy** — which functions need unit tests, which need integration tests, what mock coprocessor setup is required.

**COPS-specific checklist:**
- [ ] No `TFHE.*` anywhere
- [ ] `ZamaEthereumConfig` in inheritance, not `FHE.setCoprocessor()`
- [ ] `FHE.allowTransient` for returned handles, not `sealoutput`
- [ ] `FHE.isAllowed(handle, msg.sender)` for auth checks
- [ ] ACL set at write time (`allowThis` + `allow` for each authorized party)
- [ ] No amounts in events

### 4. Show and wait

Present the full plan. Do NOT write any code until the user approves.

If the plan reveals a blocker (missing dependency, unclear spec), surface it now — not after coding starts.

### 5. On approval

Say: "Plan approved. Ready to implement — run `/implement` to execute."

Do NOT start implementing in this skill. `/implement` is the next step.
