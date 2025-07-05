# Delta-Neutral Analyzer Debugging Guide

## Current Status

The delta-neutral analyzer has been implemented but shows suspicious funding rate patterns that need investigation.

## Known Issues

### 1. Funding Rate Clustering
**Symptom**: Large percentages of assets show identical funding rates
- 34.5% of pairs have 0.005% (5.475% APR)
- 22.4% of pairs have 0.01% (10.95% APR)

**Possible Causes**:
1. **Market Reality**: Many assets might genuinely have similar funding rates during certain market conditions
2. **Data Fetching Issue**: The fetcher might be getting default/stale values
3. **CCXT Parsing**: CCXT might be normalizing or defaulting certain values
4. **Exchange API**: Bybit might return default values for low-volume assets

### 2. Futures vs Perpetuals
**Issue**: Despite filtering, some futures contracts might still be included
- Check: Symbols with dates (e.g., BTC/USDT:USDT-250829) should be excluded
- Current filter checks for "-" and 6 digits pattern

### 3. Data Quality Warnings
The analyzer shows warnings when >50% of pairs have identical rates, but this threshold might be too high.

## Testing Commands

```bash
# Fetch fresh data
pnpm fetch-bybit

# Basic analysis
pnpm analyze-delta

# Check specific asset
pnpm analyze-delta --asset BTC

# Include fees (often shows no results)
pnpm analyze-delta --include-fees

# JSON output for debugging
pnpm analyze-delta --json > analysis.json
```

## Code Areas to Investigate

### 1. Bybit Fetcher (`src/lib/market-data/bybit-fetcher.ts`)
```typescript
// Line 77-81: Funding rate parsing
const rateStr = ticker.info.fundingRate;
const rate = rateStr !== undefined && rateStr !== '' && rateStr !== null 
  ? parseFloat(rateStr) 
  : null;
```
**Check**: Is `ticker.info.fundingRate` the correct field? Print raw ticker data to verify.

### 2. Data Loader (`src/lib/delta-neutral/data-loader.ts`)
```typescript
// Line 142-146: Funding rate validation
if (ticker.info?.fundingRate !== undefined && 
    ticker.info?.fundingRate !== '' && 
    ticker.info?.fundingRate !== null) {
  existing.perp = ticker;
}
```
**Check**: Are we too strict? Some valid perpetuals might be excluded.

### 3. Delta-Neutral Analyzer (`src/lib/delta-neutral/analyzer.ts`)
```typescript
// Line 72-85: Funding rate extraction
const fundingRateStr = perp.info?.fundingRate;
let fundingRate: number | null = null;
```
**Check**: Log the raw funding rates before and after parsing.

## Debugging Steps

### Step 1: Verify Raw Data
```bash
# Check raw ticker data structure
cat data/bybit/latest-tickers.json | jq '.tickers[0]' | less

# Count unique funding rates
cat data/bybit/latest-tickers.json | jq '[.tickers[] | select(.symbol | contains(":")) | .info.fundingRate] | unique | length'

# See funding rate distribution
cat data/bybit/latest-tickers.json | jq '[.tickers[] | select(.symbol | contains(":")) | .info.fundingRate] | group_by(.) | map({rate: .[0], count: length}) | sort_by(-.count)'
```

### Step 2: Add Debug Logging
Add console.log statements to:
1. `bybit-fetcher.ts`: Log raw ticker.info object
2. `data-loader.ts`: Log matched pairs and excluded tickers
3. `analyzer.ts`: Log funding rate parsing process

### Step 3: Compare with Exchange
1. Check Bybit website for actual funding rates
2. Use CCXT directly to fetch a single symbol's funding rate
3. Compare with analyzer output

### Step 4: Test Different Times
Funding rates change every 8 hours. Test at different times to see if patterns persist.

## Potential Solutions

### 1. Direct Funding Rate API
Instead of parsing from tickers, use CCXT's `fetchFundingRate()` or `fetchFundingRates()` methods.

### 2. Add Rate Variety Check
Warn users when data shows low variety in funding rates.

### 3. Alternative Data Sources
Consider fetching from multiple exchanges or using different CCXT methods.

### 4. Manual Verification Mode
Add a flag to show raw funding rate data for manual verification.

## Next Actions

1. **Immediate**: Add verbose logging to understand data flow
2. **Short-term**: Verify funding rate parsing against exchange website
3. **Long-term**: Consider architectural changes if CCXT ticker data is unreliable

## Related Files
- `/plans/delta-neutral-analyzer.md` - Original implementation plan
- `/docs/funding-rate-analysis.md` - Detailed rate distribution analysis
- `/src/lib/delta-neutral/*` - Core implementation files