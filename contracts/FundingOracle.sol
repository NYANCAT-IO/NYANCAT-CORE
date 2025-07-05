// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title FundingOracle
 * @dev Lightweight Oracle contract for publishing delta-neutral funding arbitrage results
 * @dev Optimized for Oasis Sapphire with privacy-preserving features
 */
contract FundingOracle {
    
    struct TradingResult {
        uint256 timestamp;
        int256 totalReturn;        // Return in basis points (e.g., 34 = 0.34%)
        uint256 winRate;           // Win rate in basis points (e.g., 1000 = 10%)
        uint256 maxDrawdown;       // Max drawdown in basis points
        uint256 tradesCount;       // Number of trades executed
        uint256 fundingCollected;  // Funding collected in wei
        uint256 mlAccuracy;        // ML accuracy in basis points
        bytes32 resultHash;        // Hash of full result data
    }
    
    struct MarketData {
        uint256 timestamp;
        string symbol;
        int256 fundingRate;        // Funding rate in basis points
        uint256 volatility;        // Volatility in basis points
        uint256 spotPrice;         // Spot price in wei
        uint256 perpPrice;         // Perpetual price in wei
    }
    
    // Events
    event ResultPublished(
        uint256 indexed timestamp,
        int256 totalReturn,
        uint256 winRate,
        uint256 tradesCount,
        bytes32 resultHash
    );
    
    event MarketDataUpdated(
        uint256 indexed timestamp,
        string symbol,
        int256 fundingRate,
        uint256 volatility
    );
    
    event AuthorizedROFLUpdated(address indexed roflAddress, bool authorized);
    
    // State variables
    address public owner;
    mapping(address => bool) public authorizedROFL;
    
    TradingResult[] public tradingResults;
    mapping(string => MarketData) public latestMarketData;
    mapping(bytes32 => bool) public publishedHashes;
    
    uint256 public constant MAX_RESULTS = 1000;
    uint256 public constant UPDATE_COOLDOWN = 1 hours;
    
    mapping(address => uint256) public lastUpdateTime;
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier onlyAuthorizedROFL() {
        require(authorizedROFL[msg.sender], "Only authorized ROFL can call this function");
        _;
    }
    
    modifier rateLimited() {
        require(
            block.timestamp >= lastUpdateTime[msg.sender] + UPDATE_COOLDOWN,
            "Update cooldown not met"
        );
        _;
    }
    
    constructor() {
        owner = msg.sender;
        authorizedROFL[msg.sender] = true;
    }
    
    /**
     * @dev Authorize a ROFL address to publish results
     * @param roflAddress Address of the ROFL application
     * @param authorized Whether to authorize or revoke authorization
     */
    function setAuthorizedROFL(address roflAddress, bool authorized) external onlyOwner {
        authorizedROFL[roflAddress] = authorized;
        emit AuthorizedROFLUpdated(roflAddress, authorized);
    }
    
    /**
     * @dev Publish trading results from ROFL application
     * @param totalReturn Total return in basis points
     * @param winRate Win rate in basis points
     * @param maxDrawdown Max drawdown in basis points
     * @param tradesCount Number of trades executed
     * @param fundingCollected Funding collected in wei
     * @param mlAccuracy ML accuracy in basis points
     * @param resultHash Hash of the complete result data
     */
    function publishResult(
        int256 totalReturn,
        uint256 winRate,
        uint256 maxDrawdown,
        uint256 tradesCount,
        uint256 fundingCollected,
        uint256 mlAccuracy,
        bytes32 resultHash
    ) external onlyAuthorizedROFL rateLimited {
        require(!publishedHashes[resultHash], "Result already published");
        require(resultHash != bytes32(0), "Invalid result hash");
        
        // Validate data ranges
        require(winRate <= 10000, "Win rate cannot exceed 100%");
        require(maxDrawdown <= 10000, "Max drawdown cannot exceed 100%");
        require(mlAccuracy <= 10000, "ML accuracy cannot exceed 100%");
        
        TradingResult memory result = TradingResult({
            timestamp: block.timestamp,
            totalReturn: totalReturn,
            winRate: winRate,
            maxDrawdown: maxDrawdown,
            tradesCount: tradesCount,
            fundingCollected: fundingCollected,
            mlAccuracy: mlAccuracy,
            resultHash: resultHash
        });
        
        tradingResults.push(result);
        publishedHashes[resultHash] = true;
        lastUpdateTime[msg.sender] = block.timestamp;
        
        // Maintain max results limit
        if (tradingResults.length > MAX_RESULTS) {
            // Remove oldest result
            for (uint256 i = 0; i < tradingResults.length - 1; i++) {
                tradingResults[i] = tradingResults[i + 1];
            }
            tradingResults.pop();
        }
        
        emit ResultPublished(
            block.timestamp,
            totalReturn,
            winRate,
            tradesCount,
            resultHash
        );
    }
    
    /**
     * @dev Update market data for a specific symbol
     * @param symbol Trading symbol (e.g., "BTC/USDT")
     * @param fundingRate Current funding rate in basis points
     * @param volatility Current volatility in basis points
     * @param spotPrice Current spot price in wei
     * @param perpPrice Current perpetual price in wei
     */
    function updateMarketData(
        string memory symbol,
        int256 fundingRate,
        uint256 volatility,
        uint256 spotPrice,
        uint256 perpPrice
    ) external onlyAuthorizedROFL {
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(spotPrice > 0, "Spot price must be positive");
        require(perpPrice > 0, "Perpetual price must be positive");
        
        latestMarketData[symbol] = MarketData({
            timestamp: block.timestamp,
            symbol: symbol,
            fundingRate: fundingRate,
            volatility: volatility,
            spotPrice: spotPrice,
            perpPrice: perpPrice
        });
        
        emit MarketDataUpdated(
            block.timestamp,
            symbol,
            fundingRate,
            volatility
        );
    }
    
    /**
     * @dev Get the latest trading result
     * @return Latest TradingResult struct
     */
    function getLatestResult() external view returns (TradingResult memory) {
        require(tradingResults.length > 0, "No results available");
        return tradingResults[tradingResults.length - 1];
    }
    
    /**
     * @dev Get the number of published results
     * @return Number of trading results
     */
    function getResultsCount() external view returns (uint256) {
        return tradingResults.length;
    }
    
    /**
     * @dev Get trading result by index
     * @param index Index of the result to retrieve
     * @return TradingResult struct at the specified index
     */
    function getResult(uint256 index) external view returns (TradingResult memory) {
        require(index < tradingResults.length, "Index out of bounds");
        return tradingResults[index];
    }
    
    /**
     * @dev Get market data for a symbol
     * @param symbol Trading symbol to query
     * @return MarketData struct for the symbol
     */
    function getMarketData(string memory symbol) external view returns (MarketData memory) {
        require(latestMarketData[symbol].timestamp > 0, "No data for symbol");
        return latestMarketData[symbol];
    }
    
    /**
     * @dev Emergency function to transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        owner = newOwner;
    }
    
    /**
     * @dev Get contract information
     * @return Contract version and stats
     */
    function getContractInfo() external view returns (
        string memory version,
        uint256 resultsCount,
        uint256 maxResults,
        uint256 updateCooldown
    ) {
        return (
            "1.0.0",
            tradingResults.length,
            MAX_RESULTS,
            UPDATE_COOLDOWN
        );
    }
}