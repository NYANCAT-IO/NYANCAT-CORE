# Discover All Tradeable Delta-Neutral Pairs

## Executive Summary

This plan addresses the critical issue discovered during backtesting: many perpetual contracts (especially meme coins) don't have corresponding spot markets, making delta-neutral trading impossible. We'll implement a comprehensive discovery system to identify ALL valid tradeable pairs on Bybit.

## Problem Analysis

### Current Issues
1. **Invalid Pairs in Backtest**
   - Perpetuals like `1000000BABYDOGE/USDT:USDT` exist
   - But spot markets like `1000000BABYDOGE/USDT` don't exist
   - Current code uses perp prices for both legs (unrealistic)
   
2. **Impact on Results**
   - 30-day backtest: -7.17% return (-87.2% annualized)
   - Error spam during data fetching
   - Unrealistic P&L calculations
   - Poor user experience

3. **Root Cause**
   - No validation of spot market availability
   - Assumption that all perpetuals have spot counterparts
   - Include many untradeable meme coins in analysis

## Solution Architecture

### Market Discovery System
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Bybit Markets  │────▶│ Market Validator │────▶│ Valid Pairs DB  │
│   (via CCXT)    │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │                           │
                               ▼                           ▼
                        ┌──────────────┐          ┌──────────────┐
                        │ Liquidity    │          │ Data Fetcher │
                        │ Validator    │          │ (Updated)    │
                        └──────────────┘          └──────────────┘
```

### Data Flow
1. Fetch all markets from Bybit
2. Identify perpetual contracts
3. Match with spot markets
4. Validate liquidity
5. Save valid pairs
6. Use for all operations

## Technical Implementation

### Phase 1: Market Discovery Core

#### 1.1 Types Definition
**File**: `src/lib/exchanges/types.ts`
```typescript
export interface MarketInfo {
  symbol: string;
  type: 'spot' | 'swap';
  active: boolean;
  quote: string;
  base: string;
  settle?: string;
  volume24h?: number;
  volumeUSD24h?: number;
}

export interface ValidatedPair {
  symbol: string;           // "BTC/USDT:USDT"
  spotSymbol: string;       // "BTC/USDT"
  perpSymbol: string;       // "BTC/USDT:USDT"
  base: string;             // "BTC"
  quote: string;            // "USDT"
  spotVolume24h: number;    // in USD
  perpVolume24h: number;    // in USD
  hasLiquidSpot: boolean;   // volume > threshold
  hasLiquidPerp: boolean;   // volume > threshold
  isValid: boolean;         // both markets exist and liquid
  discoveredAt: Date;
}

export interface DiscoveryResult {
  totalPerpetuals: number;
  totalSpots: number;
  validPairs: ValidatedPair[];
  invalidPerpetuals: string[]; // perps without spot
  lowLiquidityPairs: string[]; // exists but low volume
  timestamp: Date;
}
```

#### 1.2 Market Validator Implementation
**File**: `src/lib/exchanges/market-validator.ts`
```typescript
import ccxt from 'ccxt';
import { MarketInfo, ValidatedPair, DiscoveryResult } from './types';

export class MarketValidator {
  private exchange: any;
  private minSpotVolumeUSD = 1_000_000; // $1M daily volume
  private minPerpVolumeUSD = 5_000_000; // $5M daily volume

  constructor() {
    this.exchange = new ccxt.bybit({
      enableRateLimit: true,
      options: {
        defaultType: 'unified',
      }
    });
  }

  async discoverAllValidPairs(): Promise<DiscoveryResult> {
    console.log('🔍 Discovering all tradeable delta-neutral pairs on Bybit...');
    
    // Step 1: Load all markets
    await this.exchange.loadMarkets();
    const allMarkets = Object.values(this.exchange.markets);
    
    // Step 2: Separate spots and perpetuals
    const spotMarkets = this.filterSpotMarkets(allMarkets);
    const perpMarkets = this.filterPerpetualMarkets(allMarkets);
    
    console.log(`Found ${spotMarkets.length} spot markets`);
    console.log(`Found ${perpMarkets.length} perpetual markets`);
    
    // Step 3: Match perpetuals with spots
    const validatedPairs = await this.matchAndValidatePairs(
      spotMarkets, 
      perpMarkets
    );
    
    // Step 4: Analyze results
    const result = this.analyzeResults(
      spotMarkets,
      perpMarkets,
      validatedPairs
    );
    
    return result;
  }

  private filterSpotMarkets(markets: any[]): MarketInfo[] {
    return markets
      .filter(m => m.spot && m.active && m.quote === 'USDT')
      .map(m => ({
        symbol: m.symbol,
        type: 'spot' as const,
        active: m.active,
        base: m.base,
        quote: m.quote,
        volume24h: m.info?.volume_24h ? parseFloat(m.info.volume_24h) : 0,
        volumeUSD24h: m.info?.turnover_24h ? parseFloat(m.info.turnover_24h) : 0
      }));
  }

  private filterPerpetualMarkets(markets: any[]): MarketInfo[] {
    return markets
      .filter(m => m.swap && m.linear && m.active && m.settle === 'USDT')
      .map(m => ({
        symbol: m.symbol,
        type: 'swap' as const,
        active: m.active,
        base: m.base,
        quote: m.quote,
        settle: m.settle,
        volume24h: m.info?.volume_24h ? parseFloat(m.info.volume_24h) : 0,
        volumeUSD24h: m.info?.turnover_24h ? parseFloat(m.info.turnover_24h) : 0
      }));
  }

  private async matchAndValidatePairs(
    spots: MarketInfo[], 
    perps: MarketInfo[]
  ): Promise<ValidatedPair[]> {
    const validPairs: ValidatedPair[] = [];
    const spotMap = new Map(spots.map(s => [s.base, s]));
    
    for (const perp of perps) {
      const matchingSpot = spotMap.get(perp.base);
      
      if (matchingSpot) {
        const validPair: ValidatedPair = {
          symbol: perp.symbol,
          spotSymbol: matchingSpot.symbol,
          perpSymbol: perp.symbol,
          base: perp.base,
          quote: perp.quote,
          spotVolume24h: matchingSpot.volumeUSD24h || 0,
          perpVolume24h: perp.volumeUSD24h || 0,
          hasLiquidSpot: (matchingSpot.volumeUSD24h || 0) >= this.minSpotVolumeUSD,
          hasLiquidPerp: (perp.volumeUSD24h || 0) >= this.minPerpVolumeUSD,
          isValid: false, // will set below
          discoveredAt: new Date()
        };
        
        // Pair is valid if both markets exist and are liquid
        validPair.isValid = validPair.hasLiquidSpot && validPair.hasLiquidPerp;
        
        validPairs.push(validPair);
      }
    }
    
    // Sort by total volume (best opportunities first)
    validPairs.sort((a, b) => 
      (b.spotVolume24h + b.perpVolume24h) - (a.spotVolume24h + a.perpVolume24h)
    );
    
    return validPairs;
  }

  private analyzeResults(
    spots: MarketInfo[],
    perps: MarketInfo[],
    validatedPairs: ValidatedPair[]
  ): DiscoveryResult {
    const validPairs = validatedPairs.filter(p => p.isValid);
    const invalidPerpetuals = perps
      .filter(p => !validatedPairs.find(vp => vp.perpSymbol === p.symbol))
      .map(p => p.symbol);
    const lowLiquidityPairs = validatedPairs
      .filter(p => !p.isValid)
      .map(p => p.symbol);
    
    const result: DiscoveryResult = {
      totalPerpetuals: perps.length,
      totalSpots: spots.length,
      validPairs,
      invalidPerpetuals,
      lowLiquidityPairs,
      timestamp: new Date()
    };
    
    // Print summary
    console.log('\n📊 Discovery Summary:');
    console.log(`Total perpetual markets: ${result.totalPerpetuals}`);
    console.log(`Total spot markets: ${result.totalSpots}`);
    console.log(`Valid delta-neutral pairs: ${result.validPairs.length}`);
    console.log(`Perpetuals without spot: ${result.invalidPerpetuals.length}`);
    console.log(`Low liquidity pairs: ${result.lowLiquidityPairs.length}`);
    
    // Show top 10 by volume
    console.log('\n🏆 Top 10 Pairs by Volume:');
    result.validPairs.slice(0, 10).forEach((pair, i) => {
      const totalVolume = pair.spotVolume24h + pair.perpVolume24h;
      console.log(`${i + 1}. ${pair.base} - $${(totalVolume / 1_000_000).toFixed(1)}M`);
    });
    
    return result;
  }

  async saveDiscoveryResults(result: DiscoveryResult): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Save full results
    const fullPath = path.join(dataDir, 'discovery-results.json');
    await fs.writeFile(
      fullPath,
      JSON.stringify(result, null, 2)
    );
    
    // Save just the valid pairs for easy loading
    const validPairsPath = path.join(dataDir, 'valid-pairs.json');
    await fs.writeFile(
      validPairsPath,
      JSON.stringify({
        pairs: result.validPairs.map(p => p.symbol),
        count: result.validPairs.length,
        timestamp: result.timestamp
      }, null, 2)
    );
    
    console.log(`\n✅ Results saved to ${validPairsPath}`);
  }
}
```

### Phase 2: CLI Integration

#### 2.1 Discovery Command
**File**: `src/cli/discover-pairs.ts`
```typescript
#!/usr/bin/env node

import { Command } from 'commander';
import { MarketValidator } from '../lib/exchanges/market-validator';

const program = new Command();

program
  .name('discover-pairs')
  .description('Discover all valid delta-neutral trading pairs on Bybit')
  .option('--min-spot-volume <amount>', 'Minimum spot volume in USD', '1000000')
  .option('--min-perp-volume <amount>', 'Minimum perp volume in USD', '5000000')
  .option('--save', 'Save results to file', true)
  .action(async (options) => {
    try {
      console.log('🚀 Starting market discovery...\n');
      
      const validator = new MarketValidator();
      
      // Override volume thresholds if provided
      if (options.minSpotVolume) {
        validator.minSpotVolumeUSD = parseFloat(options.minSpotVolume);
      }
      if (options.minPerpVolume) {
        validator.minPerpVolumeUSD = parseFloat(options.minPerpVolume);
      }
      
      // Discover all valid pairs
      const result = await validator.discoverAllValidPairs();
      
      // Save results
      if (options.save) {
        await validator.saveDiscoveryResults(result);
      }
      
      // Show actionable summary
      console.log('\n💡 Next Steps:');
      console.log('1. Run: pnpm fetch-historical --valid-only');
      console.log('2. Run: pnpm backtest --days 90 --report comprehensive');
      console.log('3. Analyze results to find best performing pairs');
      
    } catch (error) {
      console.error('❌ Discovery failed:', error);
      process.exit(1);
    }
  });

program.parse();
```

### Phase 3: Data Fetcher Integration

#### 3.1 Update Historical Data Fetcher
**Modifications to**: `src/lib/historical/data-fetcher.ts`

Add these methods:
```typescript
private validPairs: Set<string> | null = null;

async loadValidPairs(): Promise<Set<string>> {
  if (this.validPairs) return this.validPairs;
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const validPairsPath = path.join(process.cwd(), 'data', 'valid-pairs.json');
    
    const data = await fs.readFile(validPairsPath, 'utf-8');
    const parsed = JSON.parse(data);
    this.validPairs = new Set(parsed.pairs);
    
    console.log(`✅ Loaded ${this.validPairs.size} valid pairs`);
    return this.validPairs;
  } catch (error) {
    console.warn('⚠️ No valid pairs file found, using all pairs');
    return new Set();
  }
}

async fetchValidPairsOnly(options: FetchOptions): Promise<HistoricalData> {
  const validPairs = await this.loadValidPairs();
  
  if (validPairs.size === 0) {
    throw new Error('No valid pairs found. Run "pnpm discover-pairs" first.');
  }
  
  // Filter symbols to only valid pairs
  const validSymbols = options.symbols
    ? options.symbols.filter(s => validPairs.has(s))
    : Array.from(validPairs);
  
  console.log(`📊 Fetching data for ${validSymbols.length} valid pairs`);
  
  return this.fetchHistoricalData({
    ...options,
    symbols: validSymbols
  });
}

// Update fetchSymbolData to skip invalid pairs gracefully
private async fetchSymbolData(symbol: string, ...): Promise<...> {
  if (this.validPairs && !this.validPairs.has(symbol)) {
    console.log(`⏭️ Skipping ${symbol} - not a valid delta-neutral pair`);
    return null;
  }
  
  // ... existing logic but with better error handling
}
```

### Phase 4: Testing & Validation

#### 4.1 Test Script
**File**: `scripts/test-discovery.ts`
```typescript
import { MarketValidator } from '../src/lib/exchanges/market-validator';

async function testDiscovery() {
  console.log('🧪 Testing market discovery...\n');
  
  const validator = new MarketValidator();
  const result = await validator.discoverAllValidPairs();
  
  // Validate results
  console.log('\n✅ Validation Checks:');
  console.log(`- Found pairs: ${result.validPairs.length > 0 ? '✓' : '✗'}`);
  console.log(`- All have spot markets: ${
    result.validPairs.every(p => p.spotSymbol) ? '✓' : '✗'
  }`);
  console.log(`- All have perp markets: ${
    result.validPairs.every(p => p.perpSymbol) ? '✓' : '✗'
  }`);
  console.log(`- All are liquid: ${
    result.validPairs.every(p => p.isValid) ? '✓' : '✗'
  }`);
  
  // Show some problem coins we fixed
  console.log('\n🚫 Example Invalid Perpetuals (no spot):');
  result.invalidPerpetuals.slice(0, 5).forEach(p => {
    console.log(`  - ${p}`);
  });
}

testDiscovery().catch(console.error);
```

## Expected Outcomes

### Discovery Results
- **Total Perpetuals**: ~180-200 markets
- **Valid Pairs**: 70-100 pairs (with liquid spot markets)
- **Invalid Perpetuals**: 80-100 (meme coins without spot)
- **Coverage**: All major coins + many altcoins

### Performance Improvements
- **Before**: -7.17% return (30 days)
- **After**: +15-25% APR expected
- **Win Rate**: 70-80% expected
- **Clean Execution**: Zero errors during fetch

### Top Expected Pairs
Based on analysis, expect these to perform well:
1. BTC/USDT - Highest liquidity
2. ETH/USDT - Consistent funding
3. SOL/USDT - High funding periods
4. DOGE/USDT - Volatile funding
5. MATIC/USDT - Good risk/reward
6. AVAX/USDT - Stable performer
7. ARB/USDT - DeFi correlation
8. OP/USDT - L2 narrative
9. INJ/USDT - Trading volume
10. BLUR/USDT - NFT correlation

## Implementation Timeline

1. **Hour 1**: Implement market validator and types
2. **Hour 2**: Create CLI command and test discovery
3. **Hour 3**: Update data fetcher and run clean backtest
4. **Hour 4**: Analyze results and create rankings

## Success Criteria

1. ✅ Discover 70+ valid delta-neutral pairs
2. ✅ Zero errors during data fetching
3. ✅ Positive backtest returns (15%+ APR)
4. ✅ Clean, professional output
5. ✅ Complete market coverage
6. ✅ Data-driven pair selection

## Risk Mitigation

1. **API Rate Limits**: Use enableRateLimit in CCXT
2. **Market Changes**: Re-run discovery periodically
3. **Volume Spikes**: Use rolling averages if available
4. **Edge Cases**: Handle markets with missing data

This comprehensive approach ensures we discover ALL tradeable opportunities and let the market data reveal the best performers.