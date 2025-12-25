// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./IArcShieldRouter.sol";
import "./PriceOracle.sol";

/**
 * @title HedgePosition 
 * @notice Individual hedge position contract for each user
 * @dev Manages collateral, debt, and health factor for a single position
 * Fixed: Oracle fallback logic, collateral reduction, health factor calculation
 */
contract HedgePosition {
    IArcShieldRouter.ProtectionLevel public protectionLevel;
    address public owner;
    address public router;
    uint256 public collateral;
    uint256 public debt;
    uint256 public principalDebt;
    uint256 public lastInterestUpdate;
    uint256 public createdAt;
    uint256 public entryRate;
    bool public isActive;
    string public targetCurrency;
    PriceOracle public oracle;
    
    uint256 public constant INTEREST_RATE = 500;
    uint256 public constant SECONDS_PER_YEAR = 31536000;
    uint256 public constant MAX_DEBT_RATIO = 9000;
    
    uint256 public constant LIQUIDATION_THRESHOLD = 11500;
    uint256 public constant WARNING_THRESHOLD = 13000;
    uint256 public constant STRONG_WARNING_THRESHOLD = 15000;
    
    uint256 public constant ORACLE_FALLBACK_PERCENTAGE = 9000;
    
    event PositionOpened(
        address indexed owner,
        uint256 collateral,
        uint256 debt,
        IArcShieldRouter.ProtectionLevel level
    );
    
    event PositionClosed(address indexed owner);
    event DebtRepaid(address indexed owner, uint256 amount);
    event CollateralReduced(address indexed owner, uint256 amount, uint256 remainingCollateral);
    event HealthFactorUpdated(uint256 newHealthFactor);
    event ProtectionOutcomeCalculated(
        address indexed owner,
        uint256 entryRate,
        uint256 currentRate,
        uint256 depreciationPct,
        uint256 protectionAmount
    );
    event ProtectionSettled(
        address indexed owner,
        uint256 payoutAmount,
        uint256 rateChange
    );
    event InterestAccrued(uint256 accruedInterest, uint256 newDebt);
    event DebtRepaymentProcessed(uint256 principalPaid, uint256 interestPaid, uint256 remainingDebt);
    event OracleFallbackUsed(string reason, uint256 fallbackRate);
    event OracleUnavailable(string reason);
    
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
        (uint256 rate, ) = PriceOracle(_oracle).getPrice(_targetCurrency);
        require(rate > 0, "Oracle rate unavailable");
        entryRate = rate;

        owner = _owner;
        router = _router;
        collateral = _collateral;
        debt = _debt;
        principalDebt = _debt;
        protectionLevel = _level;
        targetCurrency = _targetCurrency;
        oracle = PriceOracle(_oracle);
        createdAt = block.timestamp;
        lastInterestUpdate = block.timestamp;
        isActive = true;
        
        emit PositionOpened(_owner, _collateral, _debt, _level);
    }
    
    function calculateAccruedInterest() public view returns (uint256 accruedInterest) {
        if (principalDebt == 0 || !isActive) return 0;
        
        uint256 timeElapsed = block.timestamp - lastInterestUpdate;
        if (timeElapsed == 0) return 0;
        
        accruedInterest = (principalDebt * INTEREST_RATE * timeElapsed) / (10000 * SECONDS_PER_YEAR);
        
        return accruedInterest;
    }
    
    function updateInterest() public {
        if (!isActive || principalDebt == 0) return;
        
        uint256 accruedInterest = calculateAccruedInterest();
        if (accruedInterest > 0) {
            debt += accruedInterest;
            lastInterestUpdate = block.timestamp;
            emit InterestAccrued(accruedInterest, debt);
        }
    }
    
    function getCurrentDebt() public view returns (uint256) {
        if (!isActive || principalDebt == 0) return debt;
        
        uint256 accruedInterest = calculateAccruedInterest();
        return debt + accruedInterest;
    }
    
    function getSafeExchangeRate() public view returns (uint256 safeRate) {
        (uint256 exchangeRate, bool isStale) = oracle.getPrice(targetCurrency);
        
        if (exchangeRate == 0) {
            safeRate = (entryRate * ORACLE_FALLBACK_PERCENTAGE) / 10000;
            return safeRate;
        }
        
        if (isStale) {
            safeRate = (entryRate * ORACLE_FALLBACK_PERCENTAGE) / 10000;
            return safeRate;
        }
        
        safeRate = exchangeRate;
        return safeRate;
    }
    
    function getHealthFactor() public view returns (uint256) {
        uint256 currentDebt = getCurrentDebt();
        if (currentDebt == 0) return type(uint256).max;
        
        uint256 collateralFactor = 8000;
        
        uint256 exchangeRate = getSafeExchangeRate();
        require(entryRate > 0, "Entry rate not set");
        
        // Adjust health factor based on exchange rate change
        // When currency depreciates (currentRate < entryRate), health factor decreases
        // Formula: HF = (Collateral × Collateral Factor) / (Current Debt × (Entry Rate / Current Rate))
        // This makes health factor sensitive to FX risk - when currency loses value, adjusted debt increases
        uint256 adjustedDebt = (currentDebt * entryRate) / exchangeRate;
        
        return (collateral * collateralFactor) / adjustedDebt;
    }
    
    function getSafetyBuffer() public view returns (uint256) {
        uint256 hf = getHealthFactor();
        if (hf == type(uint256).max || hf <= 10000) return 0;
        
        return (hf - 10000) / 100;
    }
    
    function getRiskStatus() external view returns (uint256) {
        uint256 hf = getHealthFactor();
        
        if (hf >= STRONG_WARNING_THRESHOLD) return 0;
        if (hf >= WARNING_THRESHOLD) return 1;
        if (hf >= LIQUIDATION_THRESHOLD) return 2;
        return 3;
    }
    
    function close() external onlyOwnerOrRouter onlyActive {
        isActive = false;
        emit PositionClosed(owner);
    }
    
    function repay(uint256 amount) external onlyOwnerOrRouter onlyActive {
        require(amount > 0, "Amount must be > 0");
        
        updateInterest();
        
        uint256 currentDebt = debt;
        require(amount <= currentDebt, "Cannot repay more than debt");
        
        uint256 interestPortion = currentDebt - principalDebt;
        uint256 principalPortion;
        
        if (amount <= interestPortion) {
            interestPortion = amount;
            principalPortion = 0;
        } else {
            principalPortion = amount - interestPortion;
        }
        
        if (principalPortion > 0) {
            principalDebt -= principalPortion;
        }
        debt = currentDebt - amount;
        
        if (debt == principalDebt) {
            lastInterestUpdate = block.timestamp;
        }
        
        emit DebtRepaymentProcessed(principalPortion, interestPortion, debt);
        emit DebtRepaid(owner, amount);
        emit HealthFactorUpdated(getHealthFactor());
    }
    
    function reduceCollateral(uint256 amount) external onlyOwnerOrRouter onlyActive {
        require(amount > 0, "Amount must be > 0");
        require(amount <= collateral, "Cannot reduce more than collateral");
        
        collateral -= amount;
        emit CollateralReduced(owner, amount, collateral);
        emit HealthFactorUpdated(getHealthFactor());
    }
    
    function checkDebtRatio() external view returns (bool isSafe, uint256 debtRatio) {
        uint256 currentDebt = getCurrentDebt();
        if (collateral == 0) return (false, type(uint256).max);
        
        debtRatio = (currentDebt * 10000) / collateral;
        isSafe = debtRatio <= MAX_DEBT_RATIO;
        
        return (isSafe, debtRatio);
    }
    
    function calculateProtectionOutcome() external view returns (
        uint256 protectionAmount,
        uint256 depreciationPct,
        uint256 currentRate
    ) {
        require(isActive, "Position not active");
        require(entryRate > 0, "Entry rate not set");
        
        uint256 rate;
        bool isStale;
        (rate, isStale) = oracle.getPrice(targetCurrency);
        
        if (rate == 0) {
            return (0, 0, 0);
        }
        
        if (isStale) {
            currentRate = entryRate;
            return (0, 0, currentRate);
        }
        
        currentRate = rate;
        
        if (currentRate >= entryRate) {
            return (0, 0, currentRate);
        }
        
        depreciationPct = ((entryRate - currentRate) * 10000) / entryRate;
        
        uint256 protectionMultiplier;
        if (protectionLevel == IArcShieldRouter.ProtectionLevel.Low) {
            protectionMultiplier = 2000;
        } else if (protectionLevel == IArcShieldRouter.ProtectionLevel.Medium) {
            protectionMultiplier = 3500;
        } else {
            protectionMultiplier = 5000;
        }
        
        uint256 protectedValue = (collateral * protectionMultiplier) / 10000;
        
        protectionAmount = (depreciationPct * protectedValue) / 10000;
        
        return (protectionAmount, depreciationPct, currentRate);
    }
    
    function settleProtection() external onlyOwnerOrRouter onlyActive returns (uint256 payoutAmount) {
        require(entryRate > 0, "Entry rate not set");
        
        updateInterest();
        
        (uint256 currentRate, bool isStale) = oracle.getPrice(targetCurrency);
        
        if (currentRate == 0) {
            emit OracleUnavailable("Oracle rate unavailable in settleProtection");
            isActive = false;
            emit PositionClosed(owner);
            return 0;
        }
        
        if (isStale) {
            currentRate = entryRate;
            emit OracleFallbackUsed("Oracle price is stale in settleProtection", currentRate);
            isActive = false;
            emit PositionClosed(owner);
            return 0;
        }
        
        uint256 depreciationPct;
        if (currentRate < entryRate) {
            depreciationPct = ((entryRate - currentRate) * 10000) / entryRate;
            
            uint256 protectionMultiplier;
            if (protectionLevel == IArcShieldRouter.ProtectionLevel.Low) {
                protectionMultiplier = 2000;
            } else if (protectionLevel == IArcShieldRouter.ProtectionLevel.Medium) {
                protectionMultiplier = 3500;
            } else {
                protectionMultiplier = 5000;
            }
            
            uint256 protectedValue = (collateral * protectionMultiplier) / 10000;
            payoutAmount = (depreciationPct * protectedValue) / 10000;
            
            emit ProtectionOutcomeCalculated(
                owner,
                entryRate,
                currentRate,
                depreciationPct,
                payoutAmount
            );
        } else {
            payoutAmount = 0;
            depreciationPct = 0;
        }
        
        isActive = false;
        
        emit ProtectionSettled(owner, payoutAmount, entryRate > currentRate ? entryRate - currentRate : 0);
        emit PositionClosed(owner);
        
        return payoutAmount;
    }
    
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
            getCurrentDebt(),
            getHealthFactor(),
            getSafetyBuffer(),
            protectionLevel,
            isActive
        );
    }
    
    function getDebtDetails() external view returns (
        uint256 _principalDebt,
        uint256 _accruedInterest,
        uint256 _totalDebt
    ) {
        _principalDebt = principalDebt;
        _accruedInterest = calculateAccruedInterest();
        _totalDebt = getCurrentDebt();
        
        return (_principalDebt, _accruedInterest, _totalDebt);
    }
    
    function validateOracle() external view returns (bool isValid, string memory reason) {
        (uint256 rate, bool isStale) = oracle.getPrice(targetCurrency);
        
        if (rate == 0) {
            return (false, "Oracle rate is zero");
        }
        
        if (isStale) {
            return (false, "Oracle price is stale");
        }
        
        return (true, "");
    }
}