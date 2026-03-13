// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IConfidentialUSDC
/// @author COPS Team
/// @notice Minimal interface exposing only the functions used by ConfidentialPayroll.
interface IConfidentialUSDC {
    /// @notice Wrap plain USDC into confidential cUSDC.
    /// @param to The address that receives cUSDC.
    /// @param amount The amount of USDC to wrap.
    function wrap(address to, uint256 amount) external;

    /// @notice Transfer encrypted cUSDC from one address to another.
    /// @param from The sender address (must be msg.sender or operator-approved).
    /// @param to The recipient address.
    /// @param amount The encrypted transfer amount.
    /// @return transferred The encrypted amount actually transferred.
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64 transferred);

    /// @notice Returns the encrypted cUSDC balance of an account.
    /// @param account The address to query.
    /// @return The encrypted balance handle.
    function confidentialBalanceOf(address account) external view returns (euint64);
}
