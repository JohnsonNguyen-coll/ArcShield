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
    
    // Oracle dependency parameters
    uint256 public constant PRICE_STALE_THRESHOLD = 24 hours; // Prices older than 24h are stale
    uint256 public constant MAX_PRICE_CHANGE = 2000; // 20% max change in basis points (circuit breaker)
    bool public oraclePaused; // Emergency pause for oracle
    
    // Fallback rates (used when oracle is unavailable)
    mapping(string => uint256) public fallbackRates;
    
    event PriceUpdated(string indexed currency, uint256 rate, uint256 timestamp);
    event OraclePaused(bool paused);
    event FallbackRateSet(string indexed currency, uint256 rate);
    event PriceChangeExceedsLimit(string indexed currency, uint256 oldRate, uint256 newRate);
    
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
     * @dev Includes circuit breaker to prevent extreme price changes
     */
    function updatePrice(string memory currency, uint256 rate) external onlyOwner {
        require(!oraclePaused, "Oracle is paused");
        require(rate > 0, "Rate must be > 0");
        
        uint256 oldRate = exchangeRates[currency];
        
        // Circuit breaker: check if price change exceeds limit
        if (oldRate > 0) {
            uint256 changePct;
            if (rate > oldRate) {
                changePct = ((rate - oldRate) * 10000) / oldRate;
            } else {
                changePct = ((oldRate - rate) * 10000) / oldRate;
            }
            
            if (changePct > MAX_PRICE_CHANGE) {
                emit PriceChangeExceedsLimit(currency, oldRate, rate);
                // Still update, but emit warning
            }
        }
        
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
     * @return rate Exchange rate in 8 decimals (uses fallback if stale/unavailable)
     * @return isStale True if price is older than threshold
     * @dev Oracle dependency: returns fallback rate if main rate is stale
     */
    function getPrice(string memory currency) external view returns (uint256 rate, bool isStale) {
        rate = exchangeRates[currency];
        uint256 lastUpdate = lastUpdated[currency];
        
        // Check if price is stale
        isStale = (block.timestamp - lastUpdate) > PRICE_STALE_THRESHOLD;
        
        // Oracle dependency handling: use fallback if stale or zero
        if (rate == 0 || (isStale && fallbackRates[currency] > 0)) {
            rate = fallbackRates[currency];
            // If using fallback, still mark as stale
            isStale = true;
        }
    }
    
    /**
     * @notice Set fallback rate for a currency (used when oracle is unavailable)
     * @param currency Currency code
     * @param rate Fallback exchange rate in 8 decimals
     */
    function setFallbackRate(string memory currency, uint256 rate) external onlyOwner {
        require(rate > 0, "Rate must be > 0");
        fallbackRates[currency] = rate;
        emit FallbackRateSet(currency, rate);
    }
    
    /**
     * @notice Pause/unpause oracle updates (emergency function)
     * @param paused True to pause, false to unpause
     */
    function setOraclePaused(bool paused) external onlyOwner {
        oraclePaused = paused;
        emit OraclePaused(paused);
    }
    
    /**
     * @notice Check oracle health for a currency
     * @param currency Currency code
     * @return isHealthy True if oracle is healthy
     * @return lastUpdateTime Timestamp of last update
     * @return age Age of price in seconds
     */
    function checkOracleHealth(string memory currency) external view returns (
        bool isHealthy,
        uint256 lastUpdateTime,
        uint256 age
    ) {
        lastUpdateTime = lastUpdated[currency];
        age = block.timestamp - lastUpdateTime;
        isHealthy = exchangeRates[currency] > 0 && 
                   age <= PRICE_STALE_THRESHOLD && 
                   !oraclePaused;
        
        return (isHealthy, lastUpdateTime, age);
    }
    
    /**
     * @notice Transfer ownership
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }
}

















