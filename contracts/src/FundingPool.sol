// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./IERC20.sol";

/**
 * @title FundingPool 
 * @notice Manages funding pool for protection payouts with enhanced security
 * @dev Fixed: Reentrancy, precision loss, access control, debt tracking, fee distribution edge cases
 */
contract FundingPool {
    address public owner;
    address public router;
    address public constant USDC = 0x3600000000000000000000000000000000000000;

    // Reentrancy protection
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _status;

    // Pool state
    bool public paused;
    uint256 private constant SHARE_PRECISION = 1e18;
    uint256 public totalFunds;
    uint256 public reservedFunds;
    uint256 public availableFunds;

    // FIX #4 & #1: Debt tracking
    uint256 public totalBorrowedAmount;
    mapping(address => uint256) public userBorrowedAmount;

    // FIX #5: Pending LP fees when no LP exists
    uint256 public pendingLPFees;

    // LP (Liquidity Provider) variables
    uint256 public totalLPShares;
    uint256 public totalLPCapital;
    mapping(address => uint256) public lpShares;
    mapping(address => uint256) public lpDepositTime;
    mapping(address => uint256) public lpDepositedAmount;

    // LP parameters
    uint256 public lpLockPeriod = 7 days;
    uint256 public lpFeeShare = 8000; // 80%
    uint256 public minLPDeposit = 1000 * 1e6;
    uint256 public constant MAX_LP_FEE_SHARE = 9500;
    uint256 public constant MAX_LOCK_PERIOD = 365 days;

    // Fee and reserve variables
    uint256 public fundingRate = 100; // 1%
    uint256 public minReserveRatio = 10000;
    uint256 public totalFeesCollected;
    uint256 public totalPayouts;
    uint256 public totalProtocolFees;

    event FundsDeposited(address indexed depositor, uint256 amount);
    event FundsWithdrawn(address indexed recipient, uint256 amount);
    event PayoutFunded(address indexed recipient, uint256 amount);
    event ReserveUpdated(uint256 reserved, uint256 available);
    event FundingRateUpdated(uint256 newRate);
    event LPDeposited(address indexed lp, uint256 amount, uint256 shares);
    event LPWithdrawn(address indexed lp, uint256 amount, uint256 shares, uint256 profit);
    event FeesDistributedToLPs(uint256 totalFees, uint256 lpShare);
    event PendingLPFeesAccumulated(uint256 amount);
    event PendingLPFeesClaimed(uint256 amount);
    event LPParametersUpdated(uint256 lockPeriod, uint256 feeShare, uint256 minDeposit);
    event EmergencyPaused(address indexed by);
    event EmergencyUnpaused(address indexed by);
    event RouterUpdated(address indexed oldRouter, address indexed newRouter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event BorrowedAmountRecorded(address indexed user, uint256 amount);
    event BorrowedAmountReduced(address indexed user, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyOwnerOrRouter() {
        require(msg.sender == owner || msg.sender == router, "Not authorized");
        _;
    }

    // Reentrancy guard
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

    constructor() {
        owner = msg.sender;
        _status = _NOT_ENTERED;
    }

    /// @notice Deposit USDC into the pool (increases availableFunds)
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be > 0");
        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );
        totalFunds += amount;
        availableFunds += amount;
        emit FundsDeposited(msg.sender, amount);
        emit ReserveUpdated(reservedFunds, availableFunds);
    }

    /// @notice LP deposits USDC and receives shares proportional to pool value
    /// @param amount USDC amount to deposit
    /// @return shares Number of shares minted
    function lpDeposit(uint256 amount) external nonReentrant whenNotPaused returns (uint256 shares) {
        require(amount >= minLPDeposit, "Amount below minimum");
        require(amount <= type(uint256).max / SHARE_PRECISION, "Amount too large");
        
        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        // Calculate shares: if pool is empty, 1:1 ratio; otherwise proportional to current value
        if (totalLPShares == 0 || totalLPCapital == 0) {
            shares = amount * SHARE_PRECISION;
        } else {
            uint256 currentLPCapital = calculateCurrentLPCapital();
            require(currentLPCapital > 0, "LP capital is zero");
            shares = (amount * totalLPShares) / currentLPCapital;
        }

        require(shares > 0, "Shares must be > 0");

        lpShares[msg.sender] += shares;
        lpDepositTime[msg.sender] = block.timestamp;
        lpDepositedAmount[msg.sender] += amount;
        totalLPShares += shares;
        totalLPCapital += amount;
        totalFunds += amount;
        availableFunds += amount;

        // FIX #5: When first LP deposits, distribute pending LP fees
        if (pendingLPFees > 0 && totalLPShares > 0) {
            totalLPCapital += pendingLPFees;
            emit PendingLPFeesClaimed(pendingLPFees);
            pendingLPFees = 0;
        }

        emit LPDeposited(msg.sender, amount, shares);
        emit ReserveUpdated(reservedFunds, availableFunds);
        return shares;
    }

    /// @notice LP withdraws their funds after lock period expires
    /// @param shares Number of shares to burn
    /// @return amount USDC amount received
    function lpWithdraw(uint256 shares) external nonReentrant whenNotPaused returns (uint256 amount) {
        require(shares > 0, "Shares must be > 0");
        require(lpShares[msg.sender] >= shares, "Insufficient shares");
        require(
            block.timestamp >= lpDepositTime[msg.sender] + lpLockPeriod,
            "Lock period not expired"
        );

        uint256 currentLPCapital = calculateCurrentLPCapital();
        require(currentLPCapital > 0 && totalLPShares > 0, "Invalid pool state");

        // Calculate withdrawal amount based on share percentage
        amount = (shares * currentLPCapital) / totalLPShares;
        require(amount > 0, "Withdrawal amount must be > 0");
        require(amount <= availableFunds, "Insufficient available funds");

        // Calculate profit/loss
        uint256 originalDeposit = (lpDepositedAmount[msg.sender] * shares) / lpShares[msg.sender];
        uint256 profit = amount > originalDeposit ? amount - originalDeposit : 0;

        // Update LP state
        lpShares[msg.sender] -= shares;
        totalLPShares -= shares;
        if (totalLPCapital >= amount) {
            totalLPCapital -= amount;
        } else {
            totalLPCapital = 0;
        }
        if (lpDepositedAmount[msg.sender] >= originalDeposit) {
            lpDepositedAmount[msg.sender] -= originalDeposit;
        } else {
            lpDepositedAmount[msg.sender] = 0;
        }

        totalFunds -= amount;
        availableFunds -= amount;

        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transfer(msg.sender, amount),
            "USDC transfer failed"
        );

        emit LPWithdrawn(msg.sender, amount, shares, profit);
        emit ReserveUpdated(reservedFunds, availableFunds);
        return amount;
    }

    /// @notice Get current LP capital (can be overridden for dynamic calculations)
    /// @return currentCapital Total LP capital in the pool
    function calculateCurrentLPCapital() public view returns (uint256 currentCapital) {
        return totalLPCapital;
    }

    /// @notice Get LP position details
    /// @param lpAddress Address of the LP
    /// @return shares Number of shares held
    /// @return depositTime Timestamp of deposit
    /// @return currentValue Current value of the position
    /// @return canWithdraw Whether LP can withdraw now
    function getLPPosition(address lpAddress) external view returns (
        uint256 shares,
        uint256 depositTime,
        uint256 currentValue,
        bool canWithdraw
    ) {
        shares = lpShares[lpAddress];
        depositTime = lpDepositTime[lpAddress];

        if (shares == 0 || totalLPShares == 0) {
            currentValue = 0;
            canWithdraw = false;
        } else {
            uint256 currentLPCapital = calculateCurrentLPCapital();
            currentValue = (shares * currentLPCapital) / totalLPShares;
            canWithdraw = block.timestamp >= depositTime + lpLockPeriod;
        }

        return (shares, depositTime, currentValue, canWithdraw);
    }

    /// @notice Owner withdraws funds from the pool
    /// @param amount USDC amount to withdraw
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(amount <= availableFunds, "Insufficient available funds");

        totalFunds -= amount;
        availableFunds -= amount;

        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transfer(msg.sender, amount),
            "USDC transfer failed"
        );

        emit FundsWithdrawn(msg.sender, amount);
        emit ReserveUpdated(reservedFunds, availableFunds);
    }

    /// @notice Fund a payout from available funds
    /// @param recipient Address to receive the payout
    /// @param amount USDC amount to pay out
    function fundPayout(address recipient, uint256 amount) external onlyOwnerOrRouter nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(amount <= availableFunds, "Insufficient funds in pool");
        require(recipient != address(0), "Invalid recipient");

        // Deduct from LP capital proportionally
        if (totalLPCapital > 0 && totalFunds > 0) {
            uint256 lpShareOfPayout = (amount * totalLPCapital) / totalFunds;
            if (lpShareOfPayout > totalLPCapital) {
                totalLPCapital = 0;
            } else {
                totalLPCapital -= lpShareOfPayout;
            }
        }

        // Deduct from reserved funds first
        if (amount <= reservedFunds) {
            reservedFunds -= amount;
        } else {
            uint256 excess = amount - reservedFunds;
            reservedFunds = 0;
            if (excess <= availableFunds) {
                availableFunds -= excess;
            } else {
                availableFunds = 0;
            }
        }

        totalFunds -= amount;
        totalPayouts += amount;

        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transfer(recipient, amount),
            "USDC transfer failed"
        );

        emit PayoutFunded(recipient, amount);
        emit ReserveUpdated(reservedFunds, availableFunds);
    }

    /// @notice Reserve funds for future payouts
    /// @param amount Amount to reserve from available funds
    function reserveFunds(uint256 amount) external onlyOwner {
        require(amount <= availableFunds, "Insufficient available funds");
        reservedFunds += amount;
        availableFunds -= amount;
        emit ReserveUpdated(reservedFunds, availableFunds);
    }

    /// @notice Release reserved funds back to available
    /// @param amount Amount to release
    function releaseReservedFunds(uint256 amount) external onlyOwner {
        require(amount <= reservedFunds, "Insufficient reserved funds");
        reservedFunds -= amount;
        availableFunds += amount;
        emit ReserveUpdated(reservedFunds, availableFunds);
    }

    /// @notice Record a funding fee and distribute to LPs
    /// @param amount Total fee amount collected
    function recordFundingFee(uint256 amount) external onlyOwnerOrRouter nonReentrant {
        require(amount > 0, "Amount must be > 0");

        totalFeesCollected += amount;

        // Split fee: lpFeeShare goes to LPs, rest to protocol
        uint256 lpFeeAmount = (amount * lpFeeShare) / 10000;
        uint256 protocolFeeAmount = amount - lpFeeAmount;

        totalFunds += amount;
        availableFunds += amount;
        totalProtocolFees += protocolFeeAmount;

        // FIX #5: Add LP fee to LP capital (increases their stake) or accumulate as pending
        if (lpFeeAmount > 0) {
            if (totalLPShares > 0) {
                // LP exists, distribute fee immediately
                totalLPCapital += lpFeeAmount;
                emit FeesDistributedToLPs(amount, lpFeeAmount);
            } else {
                // No LP yet, accumulate pending fees
                pendingLPFees += lpFeeAmount;
                emit PendingLPFeesAccumulated(lpFeeAmount);
            }
        }

        emit FundsDeposited(msg.sender, amount);
        emit ReserveUpdated(reservedFunds, availableFunds);
    }

    /// @notice FIX #1: Record borrowed amount from router
    /// @param amount Borrowed amount to track
    function recordBorrowedAmount(uint256 amount) external onlyOwnerOrRouter nonReentrant {
        require(amount > 0, "Amount must be > 0");
        
        totalBorrowedAmount += amount;
        userBorrowedAmount[msg.sender] = amount;
        
        emit BorrowedAmountRecorded(msg.sender, amount);
    }

    /// @notice FIX #1: Reduce borrowed amount when debt is repaid
    /// @param user User address
    /// @param amount Amount to reduce
    function reduceBorrowedAmount(address user, uint256 amount) external onlyOwnerOrRouter nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(user != address(0), "Invalid user");
        
        if (userBorrowedAmount[user] >= amount) {
            userBorrowedAmount[user] -= amount;
            totalBorrowedAmount -= amount;
        } else {
            totalBorrowedAmount -= userBorrowedAmount[user];
            userBorrowedAmount[user] = 0;
        }
        
        emit BorrowedAmountReduced(user, amount);
    }

    /// @notice Set the router address
    /// @param _router New router address
    function setRouter(address _router) external onlyOwner {
        require(_router != address(0), "Invalid router");
        address oldRouter = router;
        router = _router;
        emit RouterUpdated(oldRouter, _router);
    }

    /// @notice Collect funding fee from external source
    /// @param amount Base amount to calculate fee from
    /// @return feeAmount Calculated fee amount
    function collectFundingFee(uint256 amount) external onlyOwner nonReentrant returns (uint256 feeAmount) {
        feeAmount = (amount * fundingRate) / 10000;
        if (feeAmount > 0) {
            IERC20 usdc = IERC20(USDC);
            require(
                usdc.transferFrom(msg.sender, address(this), feeAmount),
                "USDC transfer failed"
            );
            totalFunds += feeAmount;
            availableFunds += feeAmount;
            emit FundsDeposited(msg.sender, feeAmount);
            emit ReserveUpdated(reservedFunds, availableFunds);
        }
        return feeAmount;
    }

    /// @notice Check if pool has sufficient funds for a payout
    /// @param amount Amount to check
    /// @return hasFunds True if available funds >= amount
    function hasSufficientFunds(uint256 amount) external view returns (bool hasFunds) {
        return availableFunds >= amount;
    }

    /// @notice FIX #3: Get available funds (public view for router)
    /// @return _availableFunds Current available funds
    function getAvailableFunds() external view returns (uint256 _availableFunds) {
        return availableFunds;
    }

    /// @notice Get overall pool status
    function getPoolStatus() external view returns (
        uint256 _totalFunds,
        uint256 _reservedFunds,
        uint256 _availableFunds,
        uint256 _fundingRate,
        uint256 _totalLPCapital,
        uint256 _totalLPShares,
        uint256 _currentLPCapital,
        uint256 _totalBorrowedAmount
    ) {
        return (
            totalFunds,
            reservedFunds,
            availableFunds,
            fundingRate,
            totalLPCapital,
            totalLPShares,
            calculateCurrentLPCapital(),
            totalBorrowedAmount
        );
    }

    /// @notice Get utilization metrics
    function getUtilizationMetrics() external view returns (
        uint256 _totalPayouts,
        uint256 _totalProtocolFees,
        uint256 _totalFeesCollected,
        uint256 _totalBorrowedAmount,
        uint256 _pendingLPFees,
        uint256 utilizationRate
    ) {
        utilizationRate = totalFunds > 0 ? (reservedFunds * 10000) / totalFunds : 0;
        return (totalPayouts, totalProtocolFees, totalFeesCollected, totalBorrowedAmount, pendingLPFees, utilizationRate);
    }

    /// @notice Get borrowed amount for specific user
    /// @param user User address
    /// @return _borrowedAmount User's borrowed amount
    function getUserBorrowedAmount(address user) external view returns (uint256 _borrowedAmount) {
        return userBorrowedAmount[user];
    }

    /// @notice Update LP parameters
    /// @param lockPeriod New lock period for LP withdrawals
    /// @param feeShare New fee share percentage (0-9500)
    /// @param minDeposit New minimum deposit amount
    function setLPParameters(
        uint256 lockPeriod,
        uint256 feeShare,
        uint256 minDeposit
    ) external onlyOwner {
        require(feeShare <= MAX_LP_FEE_SHARE, "Fee share too high");
        require(minDeposit > 0, "Min deposit must be > 0");
        require(lockPeriod <= MAX_LOCK_PERIOD, "Lock period too long");

        lpLockPeriod = lockPeriod;
        lpFeeShare = feeShare;
        minLPDeposit = minDeposit;

        emit LPParametersUpdated(lockPeriod, feeShare, minDeposit);
    }

    /// @notice Set funding rate (0-1000 = 0-10%)
    /// @param newRate New funding rate
    function setFundingRate(uint256 newRate) external onlyOwner {
        require(newRate <= 1000, "Rate too high");
        fundingRate = newRate;
        emit FundingRateUpdated(newRate);
    }

    /// @notice Set minimum reserve ratio
    /// @param newRatio New ratio (0-10000)
    function setMinReserveRatio(uint256 newRatio) external onlyOwner {
        require(newRatio <= 10000, "Ratio cannot exceed 100%");
        minReserveRatio = newRatio;
    }

    /// @notice Emergency pause contract
    function pause() external onlyOwner {
        paused = true;
        emit EmergencyPaused(msg.sender);
    }

    /// @notice Emergency unpause contract
    function unpause() external onlyOwner {
        paused = false;
        emit EmergencyUnpaused(msg.sender);
    }

    /// @notice Transfer ownership to new owner
    /// @param newOwner Address of new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /// @notice Emergency withdraw any token when paused
    /// @param token Token address to withdraw
    /// @param amount Amount to withdraw
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(paused, "Must be paused");
        require(token != address(0), "Invalid token");
        IERC20(token).transfer(owner, amount);
    }
}