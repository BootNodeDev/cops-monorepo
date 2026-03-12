# /commit

Stage and commit changes following the 7 Rules of a Great Commit Message.

---

## Behavior

### 1. Check what's changed

```bash
git diff --stat
git status
```

Review the diff mentally. If unrelated changes are mixed in, stop and ask which files to stage.

### 2. Stage selectively

Stage only files related to the current issue:
```bash
git add <file1> <file2> ...
```

Never `git add .` blindly — verify with `git diff --cached` before committing.

### 3. Write the commit message

Follow the [7 Rules](https://cbea.ms/git-commit/):

1. **Subject line**: imperative mood, ≤ 72 chars, no period
2. **Blank line** between subject and body
3. **Body**: explains *what* changed and *why* — not *how* (the diff shows how)

**Template:**
```
<verb> <what was done>

<Why this was needed. What problem it solves. Any non-obvious decisions.>
<Reference the issue if relevant: Closes #N or Refs #N>
```

**Good examples:**
```
Add ConfidentialPayroll with encrypted salary storage

Stores each salary as a euint64 handle. ACL grants are set at
registration time for employer (owner) and employee wallet so
both can decrypt via the relayer without extra steps.

Closes #5
```

```
Copy lib/confidential from PayProof reference

@openzeppelin/confidential-contracts@0.3.1 requires
@fhevm/solidity@0.9.1 as peer dep — incompatible with ^0.11.1.
Local copy matches exactly what works on Sepolia.

Closes #2
```

**Bad examples (avoid):**
```
fix stuff              ← vague
WIP                    ← not a commit, use stash
Added the contract.    ← past tense + period
```

### 4. Commit

```bash
git commit -m "<subject>" -m "<body>"
```

Or use `git commit` to open the editor for multi-line messages.

### 5. Verify

```bash
git log --oneline -3
```

Confirm the message looks right. If not, amend immediately (before pushing):
```bash
git commit --amend
```

### 6. Handoff

Report the commit hash and message.

Say: "Committed. Push your branch and open a PR referencing the issue when ready."

> **Note:** Do not push. The developer pushes and opens the PR — that's a human gate.
