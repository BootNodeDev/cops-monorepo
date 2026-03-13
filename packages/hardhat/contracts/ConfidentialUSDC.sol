// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ERC20Wrapper} from
    "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";

/// @title ConfidentialUSDC
/// @notice ERC-7984 confidential wrapper over plain USDC.
///
/// Funding the payroll contract:
///   1. USDC.approve(address(this), amount)          — caller approves cUSDC to spend USDC
///   2. cUSDC.wrap(payrollContractAddress, amount)   — cUSDC minted directly to payroll
///
/// Unwrapping (async two-step):
///   1. cUSDC.unwrap(from, to, encAmount, proof)            — burns cUSDC, emits UnwrapRequested
///   2. cUSDC.finalizeUnwrap(burntHandle, cleartext, proof) — KMS proof → sends plain USDC
contract ConfidentialUSDC is ZamaEthereumConfig, ERC7984ERC20Wrapper {
    event USDCWrapped(address indexed from, address indexed to, uint256 amount);

    constructor(address usdcAddress)
        ERC7984("Confidential USDC", "cUSDC", "")
        ERC7984ERC20Wrapper(IERC20(usdcAddress))
    {}

    /// @notice Override to emit a tracking event. Caller must approve this contract first.
    function wrap(address to, uint256 amount) public override {
        super.wrap(to, amount);
        emit USDCWrapped(msg.sender, to, amount);
    }
}
