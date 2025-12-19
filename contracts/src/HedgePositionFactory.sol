// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "./HedgePosition.sol";
import "./IArcShieldRouter.sol";

/**
 * @title HedgePositionFactory
 * @notice Factory contract for creating new HedgePosition instances
 */
contract HedgePositionFactory {
    address public immutable oracle;
    
    event PositionCreated(address indexed position, address indexed owner);
    
    constructor(address _oracle) {
        oracle = _oracle;
    }
    
    function createPosition(
        address owner,
        uint256 collateral,
        uint256 debt,
        IArcShieldRouter.ProtectionLevel level,
        string memory targetCurrency,
        address router
    ) external returns (HedgePosition) {
        HedgePosition position = new HedgePosition(
            owner,
            collateral,
            debt,
            level,
            targetCurrency,
            oracle,
            router
        );
        
        emit PositionCreated(address(position), owner);
        return position;
    }
}

