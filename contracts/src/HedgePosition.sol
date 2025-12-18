// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./IArcShieldRouter.sol";

/**
 * @title HedgePosition
 * @notice Individual hedge position contract for each user
 * @dev Manages collateral, debt, and health factor for a single position
 */
contract HedgePosition {
    IArcShieldRouter.ProtectionLevel public protectionLevel;
    address public owner;
    uint256 public collateral;
    uint256 public debt;
    uint256 public createdAt;
    bool public isActive;
    
    // Health factor threshold
    uint256 public constant LIQUIDATION_THRESHOLD = 11500; // 1.15 in basis points
    uint256 public constant WARNING_THRESHOLD = 13000;     // 1.30
    uint256 public constant STRONG_WARNING_THRESHOLD = 15000; // 1.50
    
    // Events
    event PositionOpened(
        address indexed owner,
        uint256 collateral,
        uint256 debt,
        IArcShieldRouter.ProtectionLevel level
    );
    
    event PositionClosed(address indexed owner);
    event DebtRepaid(address indexed owner, uint256 amount);
    event HealthFactorUpdated(uint256 newHealthFactor);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not position owner");
        _;
    }
    
    modifier onlyActive() {
        require(isActive, "Position not active");
        _;
    }
    
    constructor(
        address _owner,
        uint256 _collateral,
        uint256 _debt,
        IArcShieldRouter.ProtectionLevel _level
    ) {
        owner = _owner;
        collateral = _collateral;
        debt = _debt;
        protectionLevel = _level;
        createdAt = block.timestamp;
        isActive = true;
        
        emit PositionOpened(_owner, _collateral, _debt, _level);
    }
    
    /**
     * @notice Get current health factor
     * @return Health factor in basis points (e.g., 20000 = 2.0)
     */
    function getHealthFactor() public view returns (uint256) {
        if (debt == 0) return type(uint256).max;
        
        // Simplified health factor calculation
        // In production, this would account for price oracles
        // HF = (collateral * collateralFactor) / debt
        uint256 collateralFactor = 8000; // 80% in basis points
        
        return (collateral * collateralFactor) / debt;
    }
    
    /**
     * @notice Get safety buffer percentage
     * @return Buffer in basis points showing how much price can move before risk
     */
    function getSafetyBuffer() external view returns (uint256) {
        uint256 hf = getHealthFactor();
        if (hf == type(uint256).max || hf <= 10000) return 0;
        
        // Safety buffer = (HF - 1.0) * 100
        return (hf - 10000) / 100;
    }
    
    /**
     * @notice Get risk status
     * @return 0 = Safe, 1 = Warning, 2 = Strong Warning, 3 = Emergency
     */
    function getRiskStatus() external view returns (uint256) {
        uint256 hf = getHealthFactor();
        
        if (hf >= STRONG_WARNING_THRESHOLD) return 0; // Safe
        if (hf >= WARNING_THRESHOLD) return 1; // Warning
        if (hf >= LIQUIDATION_THRESHOLD) return 2; // Strong Warning
        return 3; // Emergency
    }
    
    /**
     * @notice Close the position
     */
    function close() external onlyOwner onlyActive {
        isActive = false;
        emit PositionClosed(owner);
    }
    
    /**
     * @notice Repay debt to reduce position
     * @param amount Amount to repay
     */
    function repay(uint256 amount) external onlyOwner onlyActive {
        require(amount > 0, "Amount must be > 0");
        require(amount <= debt, "Cannot repay more than debt");
        
        debt -= amount;
        
        emit DebtRepaid(owner, amount);
        emit HealthFactorUpdated(getHealthFactor());
    }
    
    /**
     * @notice Get position details
     */
    function getPositionDetails() external view returns (
        address _owner,
        uint256 _collateral,
        uint256 _debt,
        uint256 _healthFactor,
        uint256 _safetyBuffer,
        IArcShieldRouter.ProtectionLevel _level,
        bool _isActive
    ) {
        return (
            owner,
            collateral,
            debt,
            getHealthFactor(),
            this.getSafetyBuffer(),
            protectionLevel,
            isActive
        );
    }
}

