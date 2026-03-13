# COPS Contract Architecture

Reference architecture for the Confidential Onchain Payroll System smart contracts.

---

## Contract Dependency Graph

```mermaid
graph TD
    subgraph OZ["@openzeppelin/contracts ^5.6.1"]
        ERC20["ERC20"]
        O2S["Ownable2Step"]
        RG["ReentrancyGuard"]
        PA["Pausable"]
        SE["SafeERC20"]
    end

    subgraph OZC["@openzeppelin/confidential-contracts 0.3.1"]
        E7984["ERC7984<br/>balances · transfers · operators"]
        E7984W["ERC7984ERC20Wrapper<br/>wrap · unwrap · finalizeUnwrap"]
        FSM["FHESafeMath<br/>tryIncrease · tryDecrease"]
        E7984U["ERC7984Utils<br/>checkOnTransferReceived"]
    end

    subgraph FHEVM["@fhevm/solidity ^0.11.1"]
        ZEC["ZamaEthereumConfig<br/>coprocessor init"]
        FHE["FHE.sol<br/>add · sub · select · allow · allowTransient"]
    end

    subgraph COPS["COPS Contracts"]
        MUSDC["MockUSDC<br/>ERC20 · open mint · 6 decimals"]
        CUSDC["ConfidentialUSDC<br/>ERC-7984 wrapper · USDCWrapped event"]
        CP["ConfidentialPayroll<br/>employee registry · salary storage<br/>payroll execution"]
        ICUSDC["IConfidentialUSDC<br/>minimal interface"]
    end

    MUSDC --> ERC20
    CUSDC --> ZEC
    CUSDC --> E7984W
    E7984W --> E7984
    E7984 --> FSM
    E7984 --> E7984U
    E7984 --> FHE
    E7984W --> SE
    CP --> ZEC
    CP --> O2S
    CP --> RG
    CP --> PA
    CP --> ICUSDC
    CP -.->|"confidentialTransferFrom"| CUSDC
    CUSDC -.->|"wraps"| MUSDC
```

---

## FHE Coprocessor Architecture

```mermaid
graph LR
    subgraph Client["CLIENT (Browser)"]
        SDK["@zama-fhe/relayer-sdk<br/>SepoliaConfig"]
        ENC["encryptWith(builder =>
builder.add64(salary))"]
        DEC["useFHEDecrypt<br/>handle → plaintext"]
    end

    subgraph Sepolia["SEPOLIA CHAIN"]
        subgraph Contracts["COPS Contracts"]
            CP2["ConfidentialPayroll"]
            CU2["ConfidentialUSDC"]
        end

        subgraph Coprocessor["FHE COPROCESSOR (Zama)"]
            ACL["ACL Contract<br/>handle → address permissions<br/>allow · allowThis · allowTransient<br/>isAllowed · makePubliclyDecryptable"]
            EXEC["FHEVMExecutor<br/>add · sub · select · fromExternal<br/>asEuint64 · isInitialized"]
            KMS["KMSVerifier<br/>threshold key management<br/>checkSignatures"]
        end
    end

    subgraph Relayer["FHE RELAYER (HTTP)"]
        GW["Gateway Service<br/>re-encryption proxy"]
    end

    ENC -->|"externalEuint64 + inputProof"| CP2
    CP2 -->|"FHE.fromExternal"| EXEC
    CP2 -->|"FHE.allow*"| ACL
    CU2 -->|"FHE.add/sub"| EXEC
    CU2 -->|"makePubliclyDecryptable"| ACL
    DEC -->|"HTTP decrypt request"| GW
    GW -->|"re-encrypt under session key"| KMS
    KMS -->|"decryption proof"| GW
    GW -->|"plaintext result"| DEC
```

---

## Encryption Lifecycle

```mermaid
sequenceDiagram
    participant Employer as Employer Browser
    participant Relayer as FHE Relayer SDK
    participant Payroll as ConfidentialPayroll
    participant ACL as ACL Contract
    participant Exec as FHEVMExecutor
    participant KMS as KMS Gateway

    Note over Employer,KMS: ── ENCRYPTION (client → chain) ──

    Employer->>Relayer: 1. encryptWith(b => b.add64(salary))
    Relayer-->>Employer: {externalEuint64 handle, inputProof}
    Employer->>Payroll: 2. batchAddEmployees([handle], [proof])
    Payroll->>Exec: 3. FHE.fromExternal(handle, proof)
    Exec-->>Payroll: euint64 salary handle
    Payroll->>ACL: 4. FHE.allowThis(salary)
    Payroll->>ACL: 5. FHE.allow(salary, employer)
    Payroll->>ACL: 6. FHE.allow(salary, employee)
    Note over Payroll: salary stored as euint64 in Employee struct

    Note over Employer,KMS: ── DECRYPTION (chain → client) ──

    Employer->>Payroll: 7. getSalary(id)
    Payroll->>ACL: 8. FHE.allowTransient(salary, msg.sender)
    Payroll-->>Employer: euint64 handle (transient ACL)
    Employer->>Relayer: 9. useFHEDecrypt({handle, contractAddress})
    Relayer->>KMS: 10. re-encryption request (employee has persistent ACL)
    KMS-->>Relayer: plaintext salary value
    Relayer-->>Employer: 11. $6,500.00 / month
```

---

## Payroll Execution — Transfer Flow

```mermaid
sequenceDiagram
    participant Employer
    participant Payroll as ConfidentialPayroll
    participant cUSDC as ConfidentialUSDC
    participant ERC7984 as ERC7984 Base
    participant FHE as FHEVMExecutor
    participant ACL

    Employer->>Payroll: runPayroll() [onlyOwner, nonReentrant, whenNotPaused]

    loop For each active employee
        Payroll->>cUSDC: try confidentialTransferFrom(this, emp.wallet, emp.salary)
        cUSDC->>ERC7984: isOperator(payroll, payroll) → true (self-operator)
        cUSDC->>ERC7984: _transfer(payroll, employee, salary)
        ERC7984->>FHE: FHESafeMath.tryDecrease(payrollBalance, salary)

        alt Sufficient balance
            FHE-->>ERC7984: (true, newBalance)
            ERC7984->>ACL: allow(newPayrollBal, payroll)
            ERC7984->>FHE: FHE.add(employeeBal, salary)
            ERC7984->>ACL: allow(newEmployeeBal, employee)
            ERC7984-->>cUSDC: transferred = salary
        else Insufficient balance (FHE saturating)
            FHE-->>ERC7984: (false, originalBalance)
            Note over ERC7984: FHE.select → transfers 0 (no revert!)
            ERC7984-->>cUSDC: transferred = 0
        end

        cUSDC-->>Payroll: success (even if 0 transferred)
        Payroll->>Payroll: emp.lastPaidAt = block.timestamp
    end

    Payroll-->>Employer: emit PayrollExecuted(runId, count, timestamp)
```

---

## Unwrap — Async Two-Step Flow

```mermaid
sequenceDiagram
    participant Employee
    participant Browser
    participant cUSDC as ConfidentialUSDC
    participant ERC7984W as ERC7984ERC20Wrapper
    participant FHE as FHEVMExecutor
    participant KMS as KMS Gateway
    participant USDC as MockUSDC

    rect rgb(235, 235, 255)
        Note over Employee,USDC: STEP 1 — Burn and request
        Employee->>Browser: Enter unwrap amount
        Browser->>Browser: encryptWith(b => b.add64(amount))
        Browser->>cUSDC: unwrap(employee, employee, encAmount, proof)
        cUSDC->>ERC7984W: _unwrap(from, to, FHE.fromExternal(...))
        ERC7984W->>ERC7984W: _burn(employee, amount)
        ERC7984W->>FHE: makePubliclyDecryptable(burntAmount)
        ERC7984W->>ERC7984W: _unwrapRequests[burntAmount] = employee
        ERC7984W-->>Browser: emit UnwrapRequested(employee, burntAmount)
        Browser->>Browser: Show "Pending unwrap..."
    end

    rect rgb(235, 255, 235)
        Note over Employee,USDC: STEP 2 — Finalize (seconds on Sepolia)
        KMS->>KMS: Decrypt burntAmount off-chain
        KMS-->>Browser: cleartext + decryptionProof
        Browser->>cUSDC: finalizeUnwrap(burntAmount, cleartext, proof)
        cUSDC->>FHE: checkSignatures([handle], cleartexts, proof)
        cUSDC->>USDC: SafeERC20.safeTransfer(employee, cleartext * rate)
        cUSDC-->>Browser: emit UnwrapFinalized(employee, amount, cleartext)
        Browser->>Browser: Show "USDC received"
    end
```

---

## Trust Boundaries

```mermaid
graph TB
    subgraph Trusted["TRUSTED (Zama infrastructure — immutable addresses)"]
        ACL2["ACL Contract"]
        EXEC2["FHEVMExecutor"]
        KMS2["KMSVerifier"]
    end

    subgraph Semi["SEMI-TRUSTED (owner-controlled)"]
        PAYROLL["ConfidentialPayroll<br/>owner = employer<br/>Ownable2Step"]
    end

    subgraph Untrusted["UNTRUSTED (any caller)"]
        CUSDC2["ConfidentialUSDC<br/>wrap · unwrap (public)"]
        MUSDC2["MockUSDC<br/>mint (public, testnet only)"]
    end

    PAYROLL -->|"FHE.allow*"| ACL2
    PAYROLL -->|"FHE.fromExternal"| EXEC2
    PAYROLL -->|"confidentialTransferFrom"| CUSDC2
    CUSDC2 -->|"FHE.add/sub/select"| EXEC2
    CUSDC2 -->|"checkSignatures"| KMS2
    CUSDC2 -->|"SafeERC20"| MUSDC2

    style Trusted fill:#d4edda
    style Semi fill:#fff3cd
    style Untrusted fill:#f8d7da
```

### Actor Permissions

| Actor | Can | Cannot |
|---|---|---|
| **Owner (employer)** | batchAddEmployees, deactivateEmployee, runPayroll, pause/unpause, getSalary (any ID) | Transfer employee cUSDC, modify salary, access other employer's contracts |
| **Employee** | getSalary (own ID only), unwrap own cUSDC, confidentialTransfer own cUSDC | View other employees' salaries, trigger runPayroll, register employees |
| **External observer** | Read getEmployee metadata, getEmployeeCount, walletToId | Decrypt any salary handle, view transfer amounts, call owner-only functions |
| **Zama infrastructure** | Execute FHE ops, manage ACL, verify KMS proofs | Modify contract state directly, override access control |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **npm `@openzeppelin/confidential-contracts@0.3.1`** instead of local `lib/confidential/` | Peer dep conflict with `@fhevm/solidity@^0.11.1` has been resolved in v0.3.1. npm is cleaner than vendored copy. |
| **No `depositFunds()`** on ConfidentialPayroll | ERC7984's `isOperator(self, self) = true` means the contract can spend its own cUSDC balance natively. |
| **Salary immutability** | Avoids complex ACL re-grant logic. To change salary: deactivate + re-add. |
| **`try/catch` in `runPayroll`** | Prevents a single reverting wallet from blocking all payments. Emits `PaymentFailed` for observability. |
| **Duplicate wallet guard** | Prevents silent double-payment from re-registering an active wallet. |
| **Old wallet cleared on re-hire** | Maintains `walletToId` invariant when deactivating and re-adding the same address. |
| **FHE saturating arithmetic** | `runPayroll` with insufficient balance silently transfers 0 (no revert). Documented in NatSpec. |

---

## Slither Compatibility

Slither cannot directly analyze fhEVM projects due to `@fhevm/hardhat-plugin` patching `ZamaConfig.sol` at compile time. The workaround patches the on-disk file to match build artifacts before running Slither:

```bash
cd packages/hardhat
ZAMA="node_modules/@fhevm/solidity/config/ZamaConfig.sol"
cp "$ZAMA" "$ZAMA.bak"
BINFO=$(find artifacts/build-info -name '*.json' | head -1)
python3 -c "
import json
d=json.load(open('$BINFO'))
content=d['input']['sources']['@fhevm/solidity/config/ZamaConfig.sol']['content']
open('$ZAMA','w').write(content)
"
uvx --from slither-analyzer slither . --hardhat-ignore-compile \
    --filter-paths "node_modules" --exclude-dependencies
cp "$ZAMA.bak" "$ZAMA" && rm "$ZAMA.bak"
```
