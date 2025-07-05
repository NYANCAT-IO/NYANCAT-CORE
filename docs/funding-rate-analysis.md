# Funding Rate Analysis

## Observed Patterns

### Distribution (Latest Data - July 5, 2025)
```
Funding Rate Distribution:
  0.0050%: 103 pairs (33.9%)
  0.0100%: 55 pairs (18.1%)
  0.0013%: 14 pairs (4.6%)
  0.0025%: 7 pairs (2.3%)
  -0.0044%: 1 pairs (0.3%)
```

### Suspicious Patterns

1. **High Concentration**: Over 50% of pairs have just two funding rates (0.005% and 0.01%)
2. **Round Numbers**: Rates cluster at very round values (0.005%, 0.01%, 0.0025%)
3. **Low Variety**: Only 5 unique rates shown in top distribution

### Annualized Rates
- 0.0050% = 5.475% APR
- 0.0100% = 10.95% APR
- 0.0025% = 2.7375% APR
- 0.0013% = 1.4235% APR

## Possible Explanations

### 1. Market Conditions
- During low volatility, many assets might converge to similar rates
- Market makers might set similar rates across correlated assets
- Exchange might have standard rate tiers

### 2. Data Issues
- CCXT might be returning cached or default values
- Bybit API might return placeholder rates for low-volume assets
- Parsing might be losing precision or normalizing values

### 3. Implementation Issues
- We might be fetching data incorrectly
- Funding rate field might be wrong
- Type conversion might be causing precision loss

## Verification Methods

### 1. Direct Exchange Comparison
```javascript
// Check specific symbol on Bybit website
// Navigate to: https://www.bybit.com/trade/usdt/BTCUSDT
// Look for funding rate in contract details
```

### 2. CCXT Direct Test
```javascript
import ccxt from 'ccxt';

const exchange = new ccxt.bybit({
  apiKey: process.env.BYBIT_MAINNET_API_KEY,
  secret: process.env.BYBIT_MAINNET_API_SECRET,
});

// Test single symbol
const ticker = await exchange.fetchTicker('BTC/USDT:USDT');
console.log('Ticker funding info:', ticker.info);

// Test funding rate method
const funding = await exchange.fetchFundingRate('BTC/USDT:USDT');
console.log('Direct funding rate:', funding);
```

### 3. Historical Pattern Check
- Fetch data at different times (funding rates update every 8 hours)
- Compare patterns across multiple days
- Check if patterns persist or change

## Red Flags

1. **Identical Rates Across Uncorrelated Assets**: BTC and small altcoins shouldn't have identical rates
2. **No Negative Rates**: Market should have mix of positive and negative
3. **Too Many Round Numbers**: Real rates should have more variety

## Recommendations

### Short Term
1. Add raw data logging to see exactly what Bybit returns
2. Test `fetchFundingRate()` vs ticker data
3. Compare with other exchanges (Binance, OKX)

### Long Term
1. Implement multiple data sources for verification
2. Add data quality metrics to the analyzer
3. Create historical tracking to identify patterns

## Sample Debug Code

```typescript
// Add to analyzer.ts for debugging
console.log('Raw perp ticker:', JSON.stringify(perp, null, 2));
console.log('Funding rate field:', perp.info?.fundingRate);
console.log('Parsed rate:', fundingRate);
console.log('APR calculation:', fundingRate * 3 * 365 * 100);
```

## Related Documentation
- `/docs/delta-neutral-analyzer-debugging.md` - Main debugging guide
- `/plans/delta-neutral-analyzer.md` - Implementation plan
- `/src/lib/market-data/bybit-fetcher.ts` - Data fetching logic