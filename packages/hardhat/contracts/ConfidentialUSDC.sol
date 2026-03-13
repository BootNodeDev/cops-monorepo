// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
// solhint-disable-next-line max-line-length
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/// @title ConfidentialUSDC
/// @author COPS Team
/// @notice ERC-7984 confidential wrapper over plain USDC.
/// @dev ZamaEthereumConfig must be first in the inheritance list to initialize the
///      FHE coprocessor before any other base constructor runs.
///
/// Funding the payroll contract:
///   1. USDC.approve(address(this), amount)          — caller approves cUSDC to spend USDC
///   2. cUSDC.wrap(payrollContractAddress, amount)   — cUSDC minted directly to payroll
///
/// Unwrapping (async two-step):
///   1. cUSDC.unwrap(from, to, encAmount, proof)            — burns cUSDC, emits UnwrapRequested
///   2. cUSDC.finalizeUnwrap(burntHandle, cleartext, proof) — KMS proof → sends plain USDC
contract ConfidentialUSDC is ZamaEthereumConfig, ERC7984ERC20Wrapper {
    /// @notice Emitted when USDC is wrapped into cUSDC.
    /// @param from The address that deposited USDC.
    /// @param to The address that receives cUSDC.
    /// @param amount The amount of USDC wrapped (6-decimal micro-units).
    event USDCWrapped(address indexed from, address indexed to, uint256 indexed amount);

    constructor(
        address usdcAddress
    ) ERC7984("Confidential USDC", "cUSDC", "") ERC7984ERC20Wrapper(IERC20(usdcAddress)) {}

    /// @notice Wrap plain USDC into confidential cUSDC. Caller must approve this contract first.
    /// @param to The address that receives cUSDC (can be a payroll contract).
    /// @param amount The amount of USDC to wrap (6-decimal micro-units).
    function wrap(address to, uint256 amount) public override {
        super.wrap(to, amount);
        emit USDCWrapped(msg.sender, to, amount);
    }
}
