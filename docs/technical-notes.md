# Technical Notes

## API Limitations Discovered

### Bybit

1. **fetchTickers() Symbol Type Restriction**
   - Cannot mix spot and perpetual symbols in a single call
   - Error: "bybit fetchTickers can only accept a list of symbols of the same type"
   - Solution: Fetch all tickers without filtering, or separate calls by type

2. **Ticker Data Includes Funding**
   - Major efficiency gain: funding rates are included in ticker responses
   - No need for separate funding rate API calls
   - Example ticker response:
   ```json
   {
     "symbol": "BTCUSDT",
     "lastPrice": "17216.00",
     "fundingRate": "-0.000212",
     "nextFundingTime": "1673280000000"
   }
   ```

### Hyperliquid

1. **Testnet URL Handling**
   - Must use `exchange.urls.test` instead of manually setting URLs
   - Manual URL override causes 404 errors

2. **Settlement Currency**
   - All perpetuals use USDC settlement (not USDT)
   - Important for cross-exchange comparisons

### CCXT Library

1. **No TypeScript Definitions**
   - CCXT has no official TypeScript support
   - Must use `any` types throughout:
   ```typescript
   private exchange: any;
   const markets: any[] = await exchange.fetchMarkets();
   ```

2. **Symbol Format Requirements**
   - Spot: `BASE/QUOTE` (e.g., "BTC/USDT")
   - Perpetual: `BASE/QUOTE:SETTLE` (e.g., "BTC/USDT:USDT")
   - Incorrect format causes "contract markets only" errors

## Funding Rate Formulas

### Annualized Percentage Rate (APR) Calculation

```typescript
// Generic formula
const annualizedAPR = fundingRate * paymentsPerDay * 365 * 100;

// Bybit (8-hour intervals, 3 payments per day)
const bybitAPR = fundingRate * 3 * 365 * 100;

// Hyperliquid (1-hour intervals, 24 payments per day)
const hyperliquidAPR = fundingRate * 24 * 365 * 100;
```

### Example Calculations

If funding rate = 0.01% (0.0001):
- Bybit APR: 0.0001 * 3 * 365 * 100 = 10.95%
- Hyperliquid APR: 0.0001 * 24 * 365 * 100 = 87.6%

### Understanding the Numbers
- Positive funding: Longs pay shorts
- Negative funding: Shorts pay longs
- Higher payment frequency = higher annualized rate

## Performance Optimizations

### REST vs WebSocket Decision Matrix

| Scenario | Best Choice | Reason |
|----------|-------------|---------|
| One-time data fetch | REST | Simple, synchronous |
| Continuous monitoring | WebSocket | Real-time, no polling |
| Multiple symbols | REST (batch) | Single API call |
| Low-latency trading | WebSocket | <1ms updates |

### Bybit Efficiency Tips

1. **Use fetchTickers() for Everything**
   - Includes prices AND funding rates
   - More efficient than separate calls

2. **Batch Operations**
   - Can fetch 100+ symbols in one call
   - Rate limit: 20 requests/second

3. **Market Discovery**
   - Use fetchMarkets() once at startup
   - Cache results for symbol validation

## Error Handling Patterns

### Common Errors and Solutions

1. **Missing Credentials**
   ```typescript
   if (!process.env.BYBIT_MAINNET_API_KEY) {
     throw new Error('Missing BYBIT_MAINNET_API_KEY');
   }
   ```

2. **Symbol Not Found**
   - Verify symbol format matches exchange requirements
   - Check if market is active
   - Use exact symbol from fetchMarkets()

3. **Rate Limiting**
   - CCXT has built-in rate limiting
   - Enable with `enableRateLimit: true`
   - No additional limiting needed

## Data Structures

### Market Object (CCXT Standard)
```typescript
{
  id: string;              // Exchange-specific (e.g., "BTCUSDT")
  symbol: string;          // CCXT unified (e.g., "BTC/USDT:USDT")
  base: string;            // Base currency
  quote: string;           // Quote currency
  settle: string;          // Settlement currency
  active: boolean;         // Is trading active
  swap: boolean;           // Is perpetual swap
  linear: boolean;         // Linear contract
  inverse: boolean;        // Inverse contract
  contractSize: number;    // Contract size
}
```

### Ticker Object (with Funding)
```typescript
{
  symbol: string;          // CCXT symbol
  last: number;            // Last price
  bid: number;             // Best bid
  ask: number;             // Best ask
  info: {
    fundingRate: string;   // Current funding rate
    nextFundingTime: string; // Next payment timestamp
  }
}
```

## Network Differences

### Testnet vs Mainnet

| Aspect | Testnet | Mainnet |
|--------|---------|---------|
| Funding Rates | Unrealistic (±500%+) | Realistic |
| Liquidity | Low | High |
| API URLs | Different endpoints | Production endpoints |
| Rate Limits | Same as mainnet | Standard limits |
| Use Case | Development only | Real trading |

## Symbol Mapping

### Cross-Exchange Comparison
When comparing between exchanges with different settlement currencies:

```typescript
// Bybit: BTC/USDT:USDT
// Hyperliquid: BTC/USDC:USDC

// Map by base asset
const baseAsset = 'BTC';
const bybitSymbol = symbols.find(s => s.startsWith(baseAsset + '/'));
const hyperliquidSymbol = symbols.find(s => s.startsWith(baseAsset + '/'));
```

## Future Technical Considerations

1. **WebSocket Implementation**
   - Use CCXT Pro for WebSocket support
   - Automatic reconnection handling
   - Separate connections for spot/derivatives

2. **Database Integration**
   - Store historical funding rates
   - Track arbitrage opportunities
   - Performance metrics

3. **Multi-Exchange Scaling**
   - Standardize symbol mapping
   - Handle exchange-specific quirks
   - Unified error handling