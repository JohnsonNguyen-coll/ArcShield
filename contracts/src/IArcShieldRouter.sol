// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IArcShieldRouter
 * @notice Interface for ArcShieldRouter to avoid circular dependencies
 */
interface IArcShieldRouter {
    enum ProtectionLevel {
        Low,    // LTV ~20%
        Medium, // LTV ~35%
        High    // LTV ~50%
    }
}

