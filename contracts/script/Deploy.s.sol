// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/HedgePositionFactory.sol";
import "../src/ArcShieldRouter.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy factory first
        HedgePositionFactory factory = new HedgePositionFactory();
        console.log("HedgePositionFactory deployed at:", address(factory));
        
        // Deploy router with factory address
        ArcShieldRouter router = new ArcShieldRouter(address(factory));
        console.log("ArcShieldRouter deployed at:", address(router));
        
        vm.stopBroadcast();
    }
}

