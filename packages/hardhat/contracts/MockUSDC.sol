// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @author COPS Team
/// @notice Mintable ERC-20 for Sepolia testing only. Open mint — do not deploy to mainnet.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    /// @notice Returns 6 decimals to match real USDC.
    /// @return The number of decimals (6).
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint tokens to any address. Unrestricted for testnet convenience.
    /// @param to The recipient address.
    /// @param amount The amount of tokens to mint (6-decimal micro-units).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
