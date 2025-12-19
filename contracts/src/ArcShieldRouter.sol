// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./HedgePosition.sol";
import "./HedgePositionFactory.sol";
import "./IArcShieldRouter.sol";
import "./IERC20.sol";

/**
 * @title ArcShieldRouter
 * @notice Main router contract for creating and managing hedge positions
 * @dev Handles 1-click protection activation with borrowed liquidity
 */
contract ArcShieldRouter is IArcShieldRouter {
    // Arc Testnet USDC address (native token with ERC-20 interface)
    address public constant USDC = 0x3600000000000000000000000000000000000000;
    
    // LTV mappings
    mapping(ProtectionLevel => uint256) public ltvLimits;
    
    // User positions
    mapping(address => HedgePosition) public userPositions;
    mapping(address => bool) public hasPosition;
    
    // Events
    event ProtectionActivated(
        address indexed user,
        address indexed position,
        ProtectionLevel level,
        uint256 collateral,
        uint256 borrowedAmount
    );
    
    event ProtectionClosed(address indexed user, address indexed position);
    event ProtectionReduced(address indexed user, uint256 amount);
    
    HedgePositionFactory public immutable positionFactory;
    
    constructor(address _positionFactory) {
        positionFactory = HedgePositionFactory(_positionFactory);
        
        // Set LTV limits (in basis points, e.g., 2000 = 20%)
        ltvLimits[ProtectionLevel.Low] = 2000;    // 20%
        ltvLimits[ProtectionLevel.Medium] = 3500; // 35%
        ltvLimits[ProtectionLevel.High] = 5000;    // 50%
    }
    
    /**
     * @notice Activate protection with 1-click
     * @param collateralAmount Amount of USDC to use as collateral
     * @param targetCurrency Currency to hedge against (for future use)
     * @param level Protection level (Low/Medium/High)
     */
    function activateProtection(
        uint256 collateralAmount,
        string memory targetCurrency,
        ProtectionLevel level
    ) external returns (address positionAddress) {
        require(collateralAmount > 0, "Collateral must be > 0");
        require(!hasPosition[msg.sender], "Position already exists");
        
        // Calculate max borrow amount based on LTV
        uint256 maxBorrow = (collateralAmount * ltvLimits[level]) / 10000;
        
        // Transfer collateral from user to this contract
        // On Arc, USDC is native but has ERC-20 interface
        // User must approve this contract first
        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transferFrom(msg.sender, address(this), collateralAmount),
            "USDC transfer failed. Please approve USDC first."
        );
        
        // Create new hedge position with target currency
        HedgePosition position = positionFactory.createPosition(
            msg.sender,
            collateralAmount,
            maxBorrow,
            level,
            targetCurrency,
            address(this)
        );
        
        positionAddress = address(position);
        userPositions[msg.sender] = position;
        hasPosition[msg.sender] = true;
        
        emit ProtectionActivated(
            msg.sender,
            positionAddress,
            level,
            collateralAmount,
            maxBorrow
        );
        
        return positionAddress;
    }
    
    /**
     * @notice Close entire hedge position
     */
    function closeProtection() external {
        require(hasPosition[msg.sender], "No position exists");
        
        HedgePosition position = userPositions[msg.sender];
        require(position.isActive(), "Position already closed");
        
        // Get position details
        (address positionOwner, uint256 collateral, uint256 debt, , , , bool isActive) = 
            position.getPositionDetails();
        require(positionOwner == msg.sender, "Not position owner");
        require(isActive, "Position not active");
        
        // Close the position
        position.close();
        
        // Return collateral to user (simplified - in production would handle debt repayment)
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
    
    /**
     * @notice Reduce protection by repaying part of debt
     * @param repayAmount Amount to repay
     */
    function reduceProtection(uint256 repayAmount) external {
        require(hasPosition[msg.sender], "No position exists");
        require(repayAmount > 0, "Repay amount must be > 0");
        
        HedgePosition position = userPositions[msg.sender];
        
        // Get current debt
        (, , uint256 debt, , , , ) = position.getPositionDetails();
        require(repayAmount <= debt, "Cannot repay more than debt");
        
        // Transfer repayment from user
        IERC20 usdc = IERC20(USDC);
        require(
            usdc.transferFrom(msg.sender, address(this), repayAmount),
            "USDC transfer failed"
        );
        
        // Repay debt
        position.repay(repayAmount);
        
        emit ProtectionReduced(msg.sender, repayAmount);
    }
    
    /**
     * @notice Get user's position address
     */
    function getPosition(address user) external view returns (address) {
        return address(userPositions[user]);
    }
    
    /**
     * @notice Get position health factor
     */
    function getHealthFactor(address user) external view returns (uint256) {
        if (!hasPosition[user]) return type(uint256).max;
        return userPositions[user].getHealthFactor();
    }
}

