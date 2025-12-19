// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/PriceOracle.sol";
import "../src/HedgePositionFactory.sol";
import "../src/ArcShieldRouter.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy PriceOracle first
        PriceOracle oracle = new PriceOracle();
        console.log("PriceOracle deployed at:", address(oracle));
        
        // Deploy factory with oracle address
        HedgePositionFactory factory = new HedgePositionFactory(address(oracle));
        console.log("HedgePositionFactory deployed at:", address(factory));
        
        // Deploy router with factory address
        ArcShieldRouter router = new ArcShieldRouter(address(factory));
        console.log("ArcShieldRouter deployed at:", address(router));
        
        // Initialize oracle with initial prices (example rates in 8 decimals)
        // 1 BRL = 0.2 USD = 20000000
        // 1 MXN = 0.06 USD = 6000000
        // 1 EUR = 1.1 USD = 110000000
        string[] memory currencies = new string[](3);
        uint256[] memory rates = new uint256[](3);
        
        currencies[0] = "BRL";
        rates[0] = 20000000; // 0.2 USD
        
        currencies[1] = "MXN";
        rates[1] = 6000000; // 0.06 USD
        
        currencies[2] = "EUR";
        rates[2] = 110000000; // 1.1 USD
        
        oracle.updatePrices(currencies, rates);
        console.log("Oracle initialized with initial prices");
        
        vm.stopBroadcast();
    }
}

