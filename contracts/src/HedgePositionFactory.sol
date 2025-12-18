// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./HedgePosition.sol";
import "./IArcShieldRouter.sol";

/**
 * @title HedgePositionFactory
 * @notice Factory contract for creating new HedgePosition instances
 */
contract HedgePositionFactory {
    event PositionCreated(address indexed position, address indexed owner);
    
    function createPosition(
        address owner,
        uint256 collateral,
        uint256 debt,
        IArcShieldRouter.ProtectionLevel level
    ) external returns (HedgePosition) {
        HedgePosition position = new HedgePosition(
            owner,
            collateral,
            debt,
            level
        );
        
        emit PositionCreated(address(position), owner);
        return position;
    }
}

