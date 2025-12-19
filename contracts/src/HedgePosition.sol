// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./IArcShieldRouter.sol";
import "./PriceOracle.sol";

/**
 * @title HedgePosition
 * @notice Individual hedge position contract for each user
 * @dev Manages collateral, debt, and health factor for a single position
 */
contract HedgePosition {
    IArcShieldRouter.ProtectionLevel public protectionLevel;
    address public owner;
    address public router; // Router contract that manages this position
    uint256 public collateral;
    uint256 public debt;
    uint256 public createdAt;
    bool public isActive;
    string public targetCurrency; // Currency being hedged (BRL, MXN, EUR)
    PriceOracle public oracle; // Price oracle for FX rates
    
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
    
    modifier onlyOwnerOrRouter() {
        require(msg.sender == owner || msg.sender == router, "Not position owner or router");
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
        IArcShieldRouter.ProtectionLevel _level,
        string memory _targetCurrency,
        address _oracle,
        address _router
    ) {
        owner = _owner;
        router = _router;
        collateral = _collateral;
        debt = _debt;
        protectionLevel = _level;
        targetCurrency = _targetCurrency;
        oracle = PriceOracle(_oracle);
        createdAt = block.timestamp;
        isActive = true;
        
        emit PositionOpened(_owner, _collateral, _debt, _level);
    }
    
    /**
     * @notice Get current health factor using real-time FX rates
     * @return Health factor in basis points (e.g., 20000 = 2.0)
     * @dev HF = (collateral * collateralFactor * exchangeRate) / debt
     *      Exchange rate accounts for currency depreciation/appreciation
     */
    function getHealthFactor() public view returns (uint256) {
        if (debt == 0) return type(uint256).max;
        
        uint256 collateralFactor = 8000; // 80% in basis points
        
        // Get current exchange rate from oracle
        (uint256 exchangeRate, bool isStale) = oracle.getPrice(targetCurrency);
        
        // If price is stale, use conservative estimate (assume currency depreciated)
        // This protects users from stale data attacks
        if (isStale || exchangeRate == 0) {
            // Fallback to simplified calculation if oracle fails
            return (collateral * collateralFactor) / debt;
        }
        
        // Health factor calculation with real-time FX rate
        // Exchange rate is in 8 decimals, so we need to normalize
        // Example: 1 BRL = 0.2 USD = 20000000 (8 decimals)
        // If BRL depreciates to 0.15 USD, exchangeRate decreases, HF decreases
        
        // Normalize exchange rate to 18 decimals for calculation
        // exchangeRate is in 8 decimals, we need 18 decimals
        uint256 normalizedRate = exchangeRate * 1e10; // 8 -> 18 decimals
        
        // HF = (collateral * collateralFactor * normalizedRate) / (debt * 1e8)
        // Simplified: HF = (collateral * collateralFactor * exchangeRate) / (debt * 1e8)
        return (collateral * collateralFactor * normalizedRate) / (debt * 1e8);
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
    function close() external onlyOwnerOrRouter onlyActive {
        isActive = false;
        emit PositionClosed(owner);
    }
    
    /**
     * @notice Repay debt to reduce position
     * @param amount Amount to repay
     */
    function repay(uint256 amount) external onlyOwnerOrRouter onlyActive {
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

