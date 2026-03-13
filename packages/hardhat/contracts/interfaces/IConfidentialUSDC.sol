// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title IConfidentialUSDC
/// @notice Minimal interface exposing only the functions used by ConfidentialPayroll.
interface IConfidentialUSDC {
    function wrap(address to, uint256 amount) external;
    function confidentialTransferFrom(address from, address to, euint64 amount) external returns (euint64);
    function confidentialBalanceOf(address account) external view returns (euint64);
}
