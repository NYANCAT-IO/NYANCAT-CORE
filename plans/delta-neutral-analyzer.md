# Delta-Neutral Strategy Analyzer Implementation Plan

## Overview
Create a CLI tool that analyzes Bybit market data to identify delta-neutral arbitrage opportunities between spot and derivative markets.

## Phase 1: Fix Data Collection (Prerequisite)

### Update bybit-fetcher.ts
1. Remove `defaultType: 'swap'` restriction to fetch all market types
2. Handle mixed ticker types (spot + perpetual) in the same response
3. Update ticker processing to handle spot tickers without funding rates
4. Ensure summary correctly categorizes spot vs perpetual markets

### Expected Data Structure After Fix
- Markets file: Already contains 660 spot + 591 perpetual definitions
- Tickers file: Will contain ~1250+ entries (spot + perpetual)
- Spot tickers: Price data only, no funding rates
- Perpetual tickers: Price data + funding rates

## Phase 2: Delta-Neutral Analyzer Tool

### File Structure
```
src/lib/delta-neutral/
├── types.ts              # Strategy types and interfaces
├── analyzer.ts           # Core analysis logic
├── strategies.ts         # Strategy implementations
└── data-loader.ts        # JSON file loading utilities

src/cli/
└── analyze-delta-neutral.ts  # CLI interface
```

### Core Features

1. **Data Loading**
   - Load latest market, ticker, and summary files
   - Parse and validate JSON data
   - Match spot and derivative pairs

2. **Strategy Types**
   - **Long Spot + Short Perpetual**: Classic cash-and-carry
   - **Short Spot (Margin) + Long Perpetual**: Reverse arbitrage
   - **Cross-Settlement Arbitrage**: USDT perp vs USDC perp
   - **Inverse Arbitrage**: Linear vs inverse perpetuals

3. **Analysis Calculations**
   - **Basis**: (Perpetual Price - Spot Price) / Spot Price * 100
   - **Funding APR**: From existing data
   - **Net APR**: Funding APR - Basis decay rate
   - **Capital Requirements**: Position sizes for delta neutrality
   - **Fee Impact**: Maker/taker fees for both legs

4. **Opportunity Ranking**
   - Sort by net APR
   - Filter by minimum volume/liquidity
   - Consider settlement currency differences
   - Account for margin requirements

### CLI Options
```bash
# Analyze all strategies
pnpm analyze-delta

# Filter by strategy type
pnpm analyze-delta --strategy long-spot-short-perp
pnpm analyze-delta --strategy short-spot-long-perp

# Filter by minimum APR
pnpm analyze-delta --min-apr 10

# Filter by base asset
pnpm analyze-delta --asset BTC

# Output formats
pnpm analyze-delta --json
pnpm analyze-delta --csv

# Include fee analysis
pnpm analyze-delta --include-fees
```

### Output Format
```
Delta-Neutral Opportunities (2025-07-04)
========================================

Strategy: Long Spot + Short Perpetual
--------------------------------------
Symbol: BTC
  Spot: BTC/USDT @ $43,250.00
  Perp: BTC/USDT:USDT @ $43,380.00
  
  Basis: 0.30% ($130)
  Funding APR: 15.33%
  Net APR: 14.23% (after basis decay)
  
  Capital Required:
    Spot: $43,250 (1 BTC)
    Perp Margin: $4,325 (10x leverage)
    Total: $47,575
  
  Daily Return: $18.51
  Monthly Return: $555.30
```

### Special Considerations

1. **Margin Trading on Spot**
   - Bybit allows 3x leverage on certain spot pairs
   - Calculate margin requirements
   - Consider borrowing costs

2. **Settlement Currency Differences**
   - USDT vs USDC spreads
   - Cross-currency hedging costs
   - Stablecoin depegging risks

3. **Inverse Perpetuals**
   - BTC/USD settled in BTC
   - Non-linear P&L calculations
   - Different margin requirements

## Phase 3: Testing & Validation

1. Test with actual data files
2. Verify calculations match exchange displays
3. Handle edge cases (missing pairs, zero funding, etc.)
4. Performance test with full dataset

## Implementation Order

1. Fix bybit-fetcher to include spot data
2. Create type definitions for strategies
3. Implement data loader for JSON files
4. Build core analyzer with basic strategies
5. Add CLI interface with filtering options
6. Implement advanced strategies (margin, cross-settlement)
7. Add comprehensive output formatting
8. Test and refine

## Success Criteria

- Tool identifies profitable delta-neutral opportunities
- Calculations account for all fees and costs
- Output is clear and actionable
- Performance is fast (<1 second analysis)
- No API calls required (pure data analysis)

## Technical Notes

### Matching Spot and Perpetual Pairs
```typescript
// Example matching logic
const spotSymbol = "BTC/USDT";
const perpSymbol = "BTC/USDT:USDT";

// Extract base currency for matching
const getBaseCurrency = (symbol: string) => symbol.split('/')[0];
```

### Basis Calculation
```typescript
// Positive basis = perp > spot (contango)
// Negative basis = perp < spot (backwardation)
const basis = (perpPrice - spotPrice) / spotPrice * 100;

// Annualized basis assuming linear decay to expiry
// For perpetuals, use a standard period (e.g., 30 days)
const annualizedBasisDecay = basis * (365 / 30);
```

### Net APR Calculation
```typescript
// For long spot + short perp:
// You earn funding (if positive) but lose basis (if positive)
const netAPR = fundingAPR - annualizedBasisDecay;

// For short spot + long perp:
// You pay funding (if positive) but gain basis (if positive)
const netAPR = annualizedBasisDecay - fundingAPR;
```

### Capital Efficiency
```typescript
// Consider leverage available
const spotCapital = spotPrice * quantity;
const perpMargin = perpPrice * quantity / leverage;
const totalCapital = spotCapital + perpMargin;

// Return on capital
const dailyReturn = (netAPR / 365) * spotCapital;
const returnOnCapital = (dailyReturn / totalCapital) * 100;
```