// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title PriceOracle
 * @notice Oracle contract for FX rates (BRL/USD, MXN/USD, EUR/USD)
 * @dev Stores exchange rates with timestamps for price freshness checks
 */
contract PriceOracle {
    address public owner;
    
    // Currency codes: "BRL", "MXN", "EUR"
    mapping(string => uint256) public exchangeRates; // Rate in 8 decimals (e.g., 1 BRL = 0.2 USD = 20000000)
    mapping(string => uint256) public lastUpdated; // Timestamp of last update
    
    uint256 public constant PRICE_STALE_THRESHOLD = 24 hours; // Prices older than 24h are stale
    
    event PriceUpdated(string indexed currency, uint256 rate, uint256 timestamp);
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    constructor() {
        owner = msg.sender;
    }
    
    /**
     * @notice Update exchange rate for a currency
     * @param currency Currency code (e.g., "BRL", "MXN", "EUR")
     * @param rate Exchange rate in 8 decimals (e.g., 0.2 USD = 20000000)
     */
    function updatePrice(string memory currency, uint256 rate) external onlyOwner {
        require(rate > 0, "Rate must be > 0");
        exchangeRates[currency] = rate;
        lastUpdated[currency] = block.timestamp;
        emit PriceUpdated(currency, rate, block.timestamp);
    }
    
    /**
     * @notice Batch update multiple prices
     * @param currencies Array of currency codes
     * @param rates Array of exchange rates (8 decimals)
     */
    function updatePrices(string[] memory currencies, uint256[] memory rates) external onlyOwner {
        require(currencies.length == rates.length, "Arrays length mismatch");
        for (uint256 i = 0; i < currencies.length; i++) {
            require(rates[i] > 0, "Rate must be > 0");
            exchangeRates[currencies[i]] = rates[i];
            lastUpdated[currencies[i]] = block.timestamp;
            emit PriceUpdated(currencies[i], rates[i], block.timestamp);
        }
    }
    
    /**
     * @notice Get exchange rate for a currency
     * @param currency Currency code
     * @return rate Exchange rate in 8 decimals
     * @return isStale True if price is older than threshold
     */
    function getPrice(string memory currency) external view returns (uint256 rate, bool isStale) {
        rate = exchangeRates[currency];
        isStale = (block.timestamp - lastUpdated[currency]) > PRICE_STALE_THRESHOLD;
    }
    
    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}













