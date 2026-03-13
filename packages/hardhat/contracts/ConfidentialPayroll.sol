// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IConfidentialUSDC} from "./interfaces/IConfidentialUSDC.sol";

/// @title ConfidentialPayroll
/// @author COPS Team
/// @notice Stores encrypted employee salaries and executes confidential payroll runs.
/// @dev ZamaEthereumConfig must be first in the inheritance list to initialize the
///      FHE coprocessor before any other base constructor runs.
///
/// Funding: employer calls cUSDC.wrap(address(this), amount) directly — no depositFunds()
/// needed on this contract. ERC7984's isOperator(address(this), address(this)) = true
/// enables confidentialTransferFrom on own balance without extra approval.
contract ConfidentialPayroll is ZamaEthereumConfig, Ownable2Step, ReentrancyGuard, Pausable {
    // ─── Types ─────────────────────────────────────────────────────────────────

    /// @dev On-chain employee record. Salary is an FHE-encrypted euint64 handle.
    // solhint-disable-next-line gas-struct-packing
    struct Employee {
        address wallet;
        string name;
        string role;
        euint64 salary;
        bool active;
        uint256 lastPaidAt;
    }

    // ─── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a new employee is registered.
    /// @param id The 1-indexed employee ID.
    /// @param wallet The employee's wallet address.
    event EmployeeAdded(uint256 indexed id, address indexed wallet);

    /// @notice Emitted when an employee is deactivated.
    /// @param id The 1-indexed employee ID.
    /// @param wallet The employee's wallet address.
    event EmployeeDeactivated(uint256 indexed id, address indexed wallet);

    /// @notice Emitted after a payroll run completes.
    /// @param runId The sequential payroll run number.
    /// @param employeeCount The number of active employees paid.
    /// @param timestamp The block timestamp of the payroll run.
    event PayrollExecuted(uint256 indexed runId, uint256 indexed employeeCount, uint256 indexed timestamp);

    /// @notice Emitted when a salary transfer fails during runPayroll.
    /// @param id The 1-indexed employee ID whose payment failed.
    /// @param wallet The employee's wallet address.
    event PaymentFailed(uint256 indexed id, address indexed wallet);

    // ─── Errors ────────────────────────────────────────────────────────────────

    error Unauthorized();
    error EmployeeNotFound();
    error DuplicateEmployee();
    error LengthMismatch();
    error BatchTooLarge();
    error ZeroAddress();

    // ─── State ─────────────────────────────────────────────────────────────────

    /// @notice The ConfidentialUSDC (ERC-7984) token contract.
    IConfidentialUSDC public immutable cUSDC; // solhint-disable-line immutable-vars-naming

    /// @notice The underlying plain USDC token contract.
    IERC20 public immutable USDC;

    Employee[] private _employees;

    /// @notice Maps wallet address to 1-indexed employee ID. 0 = not registered.
    mapping(address wallet => uint256 id) public walletToId;

    /// @notice The number of completed payroll runs.
    uint256 public payrollRunCount;

    /// @notice Maximum employees per batchAddEmployees call.
    uint256 public constant MAX_BATCH = 100;

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor(address cUSDCAddress, address usdcAddress) Ownable(msg.sender) {
        if (cUSDCAddress == address(0) || usdcAddress == address(0)) revert ZeroAddress();
        cUSDC = IConfidentialUSDC(cUSDCAddress);
        USDC = IERC20(usdcAddress);
    }

    // ─── Employer functions ────────────────────────────────────────────────────

    /// @notice Register multiple employees in one transaction.
    /// @dev Each salary is encrypted client-side and passed as externalEuint64 + proof.
    ///      Salary is immutable after registration. To change a salary: deactivate + re-add.
    /// @param wallets Employee wallet addresses.
    /// @param names Employee display names (plaintext).
    /// @param roles Employee role labels (plaintext).
    /// @param encSalaries Client-encrypted salary values (externalEuint64).
    /// @param inputProofs FHE input proofs corresponding to each encrypted salary.
    function batchAddEmployees(
        address[] calldata wallets,
        string[] calldata names,
        string[] calldata roles,
        externalEuint64[] calldata encSalaries,
        bytes[] calldata inputProofs
    ) external onlyOwner {
        uint256 len = wallets.length;
        if (len > MAX_BATCH) revert BatchTooLarge();
        if (len != names.length || len != roles.length || len != encSalaries.length || len != inputProofs.length)
            revert LengthMismatch();

        for (uint256 i = 0; i < len; ) {
            euint64 salary = FHE.fromExternal(encSalaries[i], inputProofs[i]);
            _registerEmployee(wallets[i], names[i], roles[i], salary);
            unchecked {
                ++i;
            }
        }
    }

    /// @notice Deactivate an employee. Salary handle is retained but no longer paid.
    /// @param id The 1-indexed employee ID to deactivate.
    function deactivateEmployee(uint256 id) external onlyOwner {
        if (id == 0 || id > _employees.length) revert EmployeeNotFound();
        Employee storage emp = _employees[id - 1];
        emp.active = false;
        emit EmployeeDeactivated(id, emp.wallet);
    }

    /// @notice Transfer each active employee's monthly salary from this contract's
    ///         cUSDC balance to their wallet.
    /// @dev ERC7984 uses saturating arithmetic: insufficient balance silently transfers 0,
    ///      not revert. PaymentFailed only fires on hard reverts (ACL, infrastructure).
    ///      Employer must verify funding covers total payroll before calling.
    function runPayroll() external onlyOwner nonReentrant whenNotPaused {
        uint256 count = 0;
        uint256 total = _employees.length;

        for (uint256 i = 0; i < total; ) {
            Employee storage emp = _employees[i];
            if (emp.active) {
                try cUSDC.confidentialTransferFrom(address(this), emp.wallet, emp.salary) {
                    emp.lastPaidAt = block.timestamp;
                    unchecked {
                        ++count;
                    }
                } catch {
                    emit PaymentFailed(i + 1, emp.wallet);
                }
            }
            unchecked {
                ++i;
            }
        }

        unchecked {
            ++payrollRunCount;
        }
        emit PayrollExecuted(payrollRunCount, count, block.timestamp);
    }

    /// @notice Pause the contract, blocking runPayroll.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract, restoring runPayroll.
    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── View / re-encryption ──────────────────────────────────────────────────

    /// @notice Returns the salary handle with transient ACL access for the caller.
    ///         Only the employer (owner) or the employee themselves can call this.
    /// @dev The returned handle uses allowTransient — accessible only within the current
    ///      transaction. Do not store the handle in persistent storage for cross-tx use.
    /// @param id The 1-indexed employee ID.
    /// @return The euint64 salary handle with transient ACL for msg.sender.
    function getSalary(uint256 id) external returns (euint64) {
        if (id == 0 || id > _employees.length) revert EmployeeNotFound();
        Employee storage emp = _employees[id - 1];
        if (msg.sender != emp.wallet && msg.sender != owner()) revert Unauthorized();
        return FHE.allowTransient(emp.salary, msg.sender);
    }

    /// @notice Returns the total number of employees (active and inactive).
    /// @return The length of the employees array.
    function getEmployeeCount() external view returns (uint256) {
        return _employees.length;
    }

    /// @notice Returns plaintext employee metadata. Salary is excluded — use getSalary().
    /// @param id The 1-indexed employee ID.
    /// @return wallet The employee's wallet address.
    /// @return name The employee's display name.
    /// @return role The employee's role label.
    /// @return active Whether the employee is active.
    /// @return lastPaidAt Timestamp of the last payroll payment (0 if never paid).
    function getEmployee(
        uint256 id
    ) external view returns (address wallet, string memory name, string memory role, bool active, uint256 lastPaidAt) {
        if (id == 0 || id > _employees.length) revert EmployeeNotFound();
        Employee storage emp = _employees[id - 1];
        return (emp.wallet, emp.name, emp.role, emp.active, emp.lastPaidAt);
    }

    // ─── Internal ──────────────────────────────────────────────────────────────

    function _registerEmployee(address wallet, string memory name, string memory role, euint64 salary) internal {
        if (wallet == address(0)) revert ZeroAddress();
        uint256 existingId = walletToId[wallet];
        if (existingId != 0 && _employees[existingId - 1].active) revert DuplicateEmployee();
        if (existingId != 0) {
            _employees[existingId - 1].wallet = address(0);
        }

        FHE.allowThis(salary);
        FHE.allow(salary, owner());
        FHE.allow(salary, wallet);
        FHE.allow(salary, address(cUSDC));

        _employees.push(
            Employee({wallet: wallet, name: name, role: role, salary: salary, active: true, lastPaidAt: 0})
        );

        walletToId[wallet] = _employees.length;
        emit EmployeeAdded(_employees.length, wallet);
    }
}
