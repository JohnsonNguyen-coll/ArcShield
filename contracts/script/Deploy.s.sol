// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../src/PriceOracle.sol";
import "../src/HedgePositionFactory.sol";
import "../src/FundingPool.sol";
import "../src/ArcShieldRouter.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy PriceOracle first
        PriceOracle oracle = new PriceOracle();
        console.log("PriceOracle deployed at:", address(oracle));
        
        // 2. Deploy HedgePositionFactory with oracle address
        HedgePositionFactory factory = new HedgePositionFactory(address(oracle));
        console.log("HedgePositionFactory deployed at:", address(factory));
        
        // 3. Deploy FundingPool
        FundingPool fundingPool = new FundingPool();
        console.log("FundingPool deployed at:", address(fundingPool));
        
        // 4. Deploy ArcShieldRouter with factory and funding pool addresses
        ArcShieldRouter router = new ArcShieldRouter(address(factory), address(fundingPool));
        console.log("ArcShieldRouter deployed at:", address(router));
        
        // 5. Set router address in FundingPool (must be done by owner)
        fundingPool.setRouter(address(router));
        console.log("Router set in FundingPool");
        
        // 6. Initialize oracle with initial prices (example rates in 8 decimals)
        // 1 BRL = 0.2 USD = 20000000 (20,000,000 / 100,000,000 = 0.2)
        // 1 MXN = 0.06 USD = 6000000 (6,000,000 / 100,000,000 = 0.06)
        // 1 EUR = 1.1 USD = 110000000 (110,000,000 / 100,000,000 = 1.1)
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
        
        // 7. Set fallback rates for oracle reliability
        oracle.setFallbackRate("BRL", 20000000);
        oracle.setFallbackRate("MXN", 6000000);
        oracle.setFallbackRate("EUR", 110000000);
        console.log("Fallback rates set");
        
        // 8. Optional: Add initial liquidity to FundingPool for testing
        // Uncomment if you want to add initial funds
        // uint256 initialLiquidity = 100000 * 1e6; // 100,000 USDC
        // IERC20(fundingPool.USDC()).approve(address(fundingPool), initialLiquidity);
        // fundingPool.deposit(initialLiquidity);
        // console.log("Initial liquidity added to FundingPool");
        
        console.log("\n=== Deployment Summary ===");
        console.log("PriceOracle:", address(oracle));
        console.log("HedgePositionFactory:", address(factory));
        console.log("FundingPool:", address(fundingPool));
        console.log("ArcShieldRouter:", address(router));
        console.log("========================\n");
        
        vm.stopBroadcast();
    }
}