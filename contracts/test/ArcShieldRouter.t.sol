// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../src/HedgePositionFactory.sol";
import "../src/ArcShieldRouter.sol";
import "../src/HedgePosition.sol";
import "../src/IArcShieldRouter.sol";

contract ArcShieldRouterTest is Test {
    HedgePositionFactory factory;
    ArcShieldRouter router;
    address user = address(1);
    
    function setUp() public {
        factory = new HedgePositionFactory();
        router = new ArcShieldRouter(address(factory));
    }
    
    function testActivateProtection() public {
        vm.startPrank(user);
        
        uint256 collateral = 1000e6; // 1000 USDC (6 decimals)
        
        address position = router.activateProtection(
            collateral,
            "BRL",
            IArcShieldRouter.ProtectionLevel.Medium
        );
        
        assertTrue(position != address(0));
        assertTrue(router.hasPosition(user));
        assertEq(router.getPosition(user), position);
        
        vm.stopPrank();
    }
    
    function testGetHealthFactor() public {
        vm.startPrank(user);
        
        uint256 collateral = 1000e6;
        router.activateProtection(
            collateral,
            "BRL",
            IArcShieldRouter.ProtectionLevel.Medium
        );
        
        uint256 hf = router.getHealthFactor(user);
        assertGt(hf, 0);
        
        vm.stopPrank();
    }
    
    function testCloseProtection() public {
        vm.startPrank(user);
        
        uint256 collateral = 1000e6;
        router.activateProtection(
            collateral,
            "BRL",
            IArcShieldRouter.ProtectionLevel.Low
        );
        
        router.closeProtection();
        
        assertFalse(router.hasPosition(user));
        
        vm.stopPrank();
    }
}

