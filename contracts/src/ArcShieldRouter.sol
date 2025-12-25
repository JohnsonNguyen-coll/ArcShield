// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./HedgePosition.sol";
import "./HedgePositionFactory.sol";
import "./IArcShieldRouter.sol";
import "./IERC20.sol";
import "./FundingPool.sol";

/**
 * @title ArcShieldRouter 
 * @notice Main router contract for creating and managing hedge positions
 * @dev Fixed: Reentrancy, liquidation logic, settlement edge cases, access control, debt tracking
 */
contract ArcShieldRouter is IArcShieldRouter {
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    address public owner;
    
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;
    
    bool public paused;
    
    mapping(ProtectionLevel => uint256) public ltvLimits;
    mapping(address => HedgePosition) public userPositions;
    mapping(address => bool) public hasPosition;
    mapping(address => uint256) public userBorrowedAmount; // Track borrowed amount per user
    
    HedgePositionFactory public immutable positionFactory;
    FundingPool public fundingPool;
    
    uint256 public fundingFeeRate = 100;
    uint256 public constant MAX_FUNDING_FEE_RATE = 1000;
    uint256 public constant LIQUIDATION_BONUS = 500;
    uint256 public constant LIQUIDATION_THRESHOLD = 11500;
    uint256 public constant MAX_LIQUIDATION_CLOSE_FACTOR = 5000;
    
    uint256 public totalPositionsCreated;
    uint256 public totalPositionsLiquidated;
    uint256 public totalPositionsSettled;
    uint256 public totalBorrowedAmount; // Track total system debt
    
    event ProtectionActivated(
        address indexed user,
        address indexed position,
        ProtectionLevel level,
        uint256 collateral,
        uint256 borrowedAmount
    );
    
    event ProtectionClosed(address indexed user, address indexed position);
    event ProtectionReduced(address indexed user, uint256 amount);
    event ProtectionSettled(
        address indexed user,
        address indexed position,
        uint256 payoutAmount,
        uint256 collateralReturned
    );
    
    event PositionLiquidated(
        address indexed user,
        address indexed position,
        address indexed liquidator,
        uint256 collateralSeized,
        uint256 debtRepaid,
        uint256 liquidationBonus
    );
    
    event DebtRepaidToPool(address indexed user, uint256 principalAmount, uint256 interestAmount);
    event FundingPoolSet(address indexed fundingPool);
    event FundingFeeCollected(address indexed user, uint256 amount);
    event FundingFeeRateUpdated(uint256 newRate);
    event EmergencyPaused(address indexed by);
    event EmergencyUnpaused(address indexed by);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BorrowedAmountRecorded(address indexed user, uint256 amount);
    event BorrowedAmountReduced(address indexed user, uint256 amount);
    event PoolInsufficientFunds(address indexed user, uint256 requested, uint256 available);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier nonReentrant() {
        require(_status != _ENTERED, "Reentrant call");
        _status = _ENTERED;
        _;
        _status = _NOT_ENTERED;
    }
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    constructor(address _positionFactory, address _fundingPool) {
        require(_positionFactory != address(0), "Invalid factory");
        require(_fundingPool != address(0), "Invalid funding pool");
        
        owner = msg.sender;
        positionFactory = HedgePositionFactory(_positionFactory);
        fundingPool = FundingPool(_fundingPool);
        _status = _NOT_ENTERED;
        
        fundingPool.setRouter(address(this));
        
        ltvLimits[ProtectionLevel.Low] = 2000;
        ltvLimits[ProtectionLevel.Medium] = 3500;
        ltvLimits[ProtectionLevel.High] = 5000;
    }
    
    function setFundingPool(address _fundingPool) external onlyOwner {
        require(_fundingPool != address(0), "Invalid funding pool");
        fundingPool = FundingPool(_fundingPool);
        emit FundingPoolSet(_fundingPool);
    }
    
    function activateProtection(
        uint256 collateralAmount,
        string memory targetCurrency,
        ProtectionLevel level
    ) external nonReentrant whenNotPaused returns (address positionAddress) {
        require(collateralAmount > 0, "Collateral must be > 0");
        require(!hasPosition[msg.sender], "Position already exists");
        require(bytes(targetCurrency).length > 0, "Invalid currency");
        
        uint256 maxBorrow = (collateralAmount * ltvLimits[level]) / 10000;
        uint256 fundingFee = (collateralAmount * fundingFeeRate) / 10000;
        require(fundingFee < collateralAmount, "Fee exceeds collateral");
        uint256 netCollateral = collateralAmount - fundingFee;
        
        require(netCollateral > 0, "Net collateral must be > 0");
        
        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transferFrom(msg.sender, address(this), collateralAmount),
            "USDC transfer failed"
        );
        
        if (fundingFee > 0) {
            require(
                usdc.transfer(address(fundingPool), fundingFee),
                "Fee transfer failed"
            );
            fundingPool.recordFundingFee(fundingFee);
            emit FundingFeeCollected(msg.sender, fundingFee);
        }
        
        HedgePosition position = positionFactory.createPosition(
            msg.sender,
            netCollateral,
            maxBorrow,
            level,
            targetCurrency,
            address(this)
        );
        
        positionAddress = address(position);
        userPositions[msg.sender] = position;
        hasPosition[msg.sender] = true;
        
        // FIX #1: Track borrowed amount in router
        userBorrowedAmount[msg.sender] = maxBorrow;
        totalBorrowedAmount += maxBorrow;
        
        // FIX #1: Notify funding pool about new borrowed amount
        fundingPool.recordBorrowedAmount(maxBorrow);
        
        totalPositionsCreated++;
        
        emit BorrowedAmountRecorded(msg.sender, maxBorrow);
        emit ProtectionActivated(
            msg.sender,
            positionAddress,
            level,
            netCollateral,
            maxBorrow
        );
        
        return positionAddress;
    }
    
    function closeProtection() external nonReentrant whenNotPaused {
        require(hasPosition[msg.sender], "No position exists");
        
        HedgePosition position = userPositions[msg.sender];
        require(position.isActive(), "Position already closed");
        
        (address positionOwner, uint256 collateral, , , , , bool isActive) = 
            position.getPositionDetails();
        require(positionOwner == msg.sender, "Not position owner");
        require(isActive, "Position not active");
        
        (, , uint256 totalDebt) = position.getDebtDetails();
        require(totalDebt == 0, "Must repay debt first");
        
        position.close();
        
        // FIX #1: Update total borrowed tracking and notify pool
        if (userBorrowedAmount[msg.sender] > 0) {
            fundingPool.reduceBorrowedAmount(msg.sender, userBorrowedAmount[msg.sender]);
            totalBorrowedAmount -= userBorrowedAmount[msg.sender];
            emit BorrowedAmountReduced(msg.sender, userBorrowedAmount[msg.sender]);
            userBorrowedAmount[msg.sender] = 0;
        }
        
        if (collateral > 0) {
            IERC20 usdc = IERC20(USDC);
            require(
                usdc.transfer(msg.sender, collateral),
                "USDC return failed"
            );
        }
        
        hasPosition[msg.sender] = false;
        delete userPositions[msg.sender];
        
        emit ProtectionClosed(msg.sender, address(position));
    }
    
    function reduceProtection(uint256 repayAmount) external nonReentrant whenNotPaused {
        require(hasPosition[msg.sender], "No position exists");
        require(repayAmount > 0, "Repay amount must be > 0");
        
        HedgePosition position = userPositions[msg.sender];
        
        (uint256 principalDebt, uint256 accruedInterest, uint256 totalDebt) = position.getDebtDetails();
        require(repayAmount <= totalDebt, "Cannot repay more than debt");
        
        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transferFrom(msg.sender, address(this), repayAmount),
            "USDC transfer failed"
        );
        
        uint256 interestPortion;
        uint256 principalPortion;
        
        if (repayAmount <= accruedInterest) {
            interestPortion = repayAmount;
            principalPortion = 0;
        } else {
            interestPortion = accruedInterest;
            principalPortion = repayAmount - accruedInterest;
        }
        
        position.repay(repayAmount);
        
        // FIX #1: Update borrowed amount tracking when repaying principal and notify pool
        if (principalPortion > 0) {
            uint256 amountToReduce = principalPortion;
            if (userBorrowedAmount[msg.sender] >= amountToReduce) {
                fundingPool.reduceBorrowedAmount(msg.sender, amountToReduce);
                userBorrowedAmount[msg.sender] -= amountToReduce;
                totalBorrowedAmount -= amountToReduce;
                emit BorrowedAmountReduced(msg.sender, amountToReduce);
            }
        }
        
        if (repayAmount > 0) {
            require(
                usdc.transfer(address(fundingPool), repayAmount),
                "Transfer to pool failed"
            );
            fundingPool.recordFundingFee(repayAmount);
        }
        
        emit DebtRepaidToPool(msg.sender, principalPortion, interestPortion);
        emit ProtectionReduced(msg.sender, repayAmount);
    }
    
    function getPosition(address user) external view returns (address) {
        return address(userPositions[user]);
    }
    
    function getHealthFactor(address user) external view returns (uint256) {
        if (!hasPosition[user]) return type(uint256).max;
        return userPositions[user].getHealthFactor();
    }
    
    function calculateProtectionOutcome(address user) external view returns (
        uint256 protectionAmount,
        uint256 depreciationPct,
        uint256 currentRate
    ) {
        require(hasPosition[user], "No position exists");
        HedgePosition position = userPositions[user];
        return position.calculateProtectionOutcome();
    }
    
    function liquidate(address user) external nonReentrant whenNotPaused {
        require(hasPosition[user], "No position exists");
        require(user != msg.sender, "Cannot liquidate own position");
        
        HedgePosition position = userPositions[user];
        require(position.isActive(), "Position already closed");
        
        uint256 healthFactor = position.getHealthFactor();
        // FIX #2: Validate health factor properly
        require(healthFactor != type(uint256).max, "Position has no debt");
        require(healthFactor < LIQUIDATION_THRESHOLD, "Position is healthy");
        
        (address positionOwner, uint256 collateral, , , , , bool isActive) = 
            position.getPositionDetails();
        require(positionOwner == user, "Position owner mismatch");
        require(isActive, "Position not active");
        
        (, , uint256 totalDebt) = position.getDebtDetails();
        require(totalDebt > 0, "No debt to liquidate");
        
        uint256 maxLiquidatableDebt = (totalDebt * MAX_LIQUIDATION_CLOSE_FACTOR) / 10000;
        uint256 debtToLiquidate = totalDebt > maxLiquidatableDebt ? maxLiquidatableDebt : totalDebt;
        
        uint256 liquidationBonus = (debtToLiquidate * LIQUIDATION_BONUS) / 10000;
        uint256 collateralToSeize = debtToLiquidate + liquidationBonus;
        
        require(collateral >= collateralToSeize, "Insufficient collateral");
        
        IERC20 usdc = IERC20(USDC);
        
        bool shouldClosePosition = (collateral - collateralToSeize) < (totalDebt - debtToLiquidate);
        
        if (shouldClosePosition) {
            // Close position completely
            position.close();
            
            require(
                usdc.transfer(msg.sender, collateralToSeize),
                "Liquidation payment failed"
            );
            
            uint256 remainingCollateral = collateral - collateralToSeize;
            if (remainingCollateral > 0) {
                require(
                    usdc.transfer(user, remainingCollateral),
                    "Remaining collateral return failed"
                );
            }
            
            // FIX #1: Update borrowed tracking when closing position and notify pool
            if (userBorrowedAmount[user] > 0) {
                fundingPool.reduceBorrowedAmount(user, userBorrowedAmount[user]);
                totalBorrowedAmount -= userBorrowedAmount[user];
                emit BorrowedAmountReduced(user, userBorrowedAmount[user]);
                userBorrowedAmount[user] = 0;
            }
            
            hasPosition[user] = false;
            delete userPositions[user];
        } else {
            // Partial liquidation - reduce debt and collateral
            position.repay(debtToLiquidate);
            
            // FIX #2: CRITICAL - Reduce position collateral when partial liquidation
            position.reduceCollateral(collateralToSeize);
            
            require(
                usdc.transfer(msg.sender, collateralToSeize),
                "Liquidation payment failed"
            );
            
            require(
                usdc.transfer(address(fundingPool), debtToLiquidate),
                "Debt repayment failed"
            );
            fundingPool.recordFundingFee(debtToLiquidate);
            
            // FIX #1: Update borrowed amount and notify pool
            if (userBorrowedAmount[user] >= debtToLiquidate) {
                fundingPool.reduceBorrowedAmount(user, debtToLiquidate);
                userBorrowedAmount[user] -= debtToLiquidate;
                totalBorrowedAmount -= debtToLiquidate;
                emit BorrowedAmountReduced(user, debtToLiquidate);
            }
        }
        
        totalPositionsLiquidated++;
        
        emit PositionLiquidated(
            user,
            address(position),
            msg.sender,
            collateralToSeize,
            debtToLiquidate,
            liquidationBonus
        );
    }
    
    function settleProtection() external nonReentrant whenNotPaused {
        require(hasPosition[msg.sender], "No position exists");
        
        HedgePosition position = userPositions[msg.sender];
        require(position.isActive(), "Position already closed");
        
        (address positionOwner, uint256 collateral, , , , , bool isActive) = 
            position.getPositionDetails();
        require(positionOwner == msg.sender, "Not position owner");
        require(isActive, "Position not active");
        
        (uint256 principalDebt, uint256 accruedInterest, uint256 currentDebt) = position.getDebtDetails();
        
        uint256 payoutAmount = position.settleProtection();
        
        IERC20 usdc = IERC20(USDC);
        uint256 availableCollateral = collateral;
        uint256 actualPayout = 0;
        
        if (payoutAmount > 0) {
            bool hasFunds = fundingPool.hasSufficientFunds(payoutAmount);
            if (hasFunds) {
                fundingPool.fundPayout(address(this), payoutAmount);
                actualPayout = payoutAmount;
            } else {
                // FIX #3: Log when pool doesn't have sufficient funds
                emit PoolInsufficientFunds(msg.sender, payoutAmount, fundingPool.getAvailableFunds());
            }
        }
        
        uint256 totalAvailable = availableCollateral + actualPayout;
        uint256 debtRepaid = 0;
        uint256 principalRepaid = 0;
        uint256 interestRepaid = 0;
        
        if (currentDebt > 0) {
            if (totalAvailable >= currentDebt) {
                debtRepaid = currentDebt;
                principalRepaid = principalDebt;
                interestRepaid = accruedInterest;
            } else {
                debtRepaid = totalAvailable;
                if (debtRepaid <= accruedInterest) {
                    interestRepaid = debtRepaid;
                    principalRepaid = 0;
                } else {
                    interestRepaid = accruedInterest;
                    principalRepaid = debtRepaid - accruedInterest;
                }
            }
            
            if (debtRepaid > 0) {
                require(
                    usdc.transfer(address(fundingPool), debtRepaid),
                    "Debt repayment failed"
                );
                fundingPool.recordFundingFee(debtRepaid);
                emit DebtRepaidToPool(msg.sender, principalRepaid, interestRepaid);
            }
        }
        
        uint256 totalToUser = totalAvailable > debtRepaid ? totalAvailable - debtRepaid : 0;
        if (totalToUser > 0) {
            require(
                usdc.transfer(msg.sender, totalToUser),
                "User payment failed"
            );
        }
        
        // FIX #1: Update borrowed tracking when settling and notify pool
        if (userBorrowedAmount[msg.sender] > 0) {
            fundingPool.reduceBorrowedAmount(msg.sender, userBorrowedAmount[msg.sender]);
            totalBorrowedAmount -= userBorrowedAmount[msg.sender];
            emit BorrowedAmountReduced(msg.sender, userBorrowedAmount[msg.sender]);
            userBorrowedAmount[msg.sender] = 0;
        }
        
        hasPosition[msg.sender] = false;
        delete userPositions[msg.sender];
        totalPositionsSettled++;
        
        emit ProtectionSettled(
            msg.sender,
            address(position),
            actualPayout,
            collateral
        );
    }
    
    function setFundingFeeRate(uint256 newRate) external onlyOwner {
        require(newRate <= MAX_FUNDING_FEE_RATE, "Rate too high");
        fundingFeeRate = newRate;
        emit FundingFeeRateUpdated(newRate);
    }
    
    function setLTVLimit(ProtectionLevel level, uint256 newLimit) external onlyOwner {
        require(newLimit <= 10000, "LTV cannot exceed 100%");
        require(newLimit >= 1000, "LTV too low");
        ltvLimits[level] = newLimit;
    }
    
    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPaused(msg.sender);
    }
    
    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpaused(msg.sender);
    }
    
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    function getRouterStats() external view returns (
        uint256 _totalPositionsCreated,
        uint256 _totalPositionsLiquidated,
        uint256 _totalPositionsSettled,
        uint256 _activePositions,
        uint256 _totalBorrowedAmount
    ) {
        return (
            totalPositionsCreated,
            totalPositionsLiquidated,
            totalPositionsSettled,
            totalPositionsCreated - totalPositionsLiquidated - totalPositionsSettled,
            totalBorrowedAmount
        );
    }
    
    function getUserBorrowedAmount(address user) external view returns (uint256) {
        return userBorrowedAmount[user];
    }
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(paused, "Must be paused");
        require(token != address(0), "Invalid token");
        
        IERC20(token).transfer(owner, amount);
    }
}