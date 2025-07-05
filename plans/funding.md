# Funding Rate CLI Tool - Implementation Plan

## Overview

A simplified CLI tool to fetch and compare funding rates from Bybit and Hyperliquid testnet exchanges using the CCXT library.

## Architecture

### Core Components

1. **Library Layer** (`src/lib/`)
   - Exchange adapters for Bybit and Hyperliquid
   - Unified funding service with exchange-specific symbol support
   - Type definitions

2. **CLI Layer** (`src/cli/`)
   - Command-line interface using commander.js
   - Formatted output with tables and colors

### Technology Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Package Manager**: pnpm
- **Dependencies**:
  - ccxt: Exchange connectivity
  - commander: CLI argument parsing
  - chalk: Terminal colors
  - cli-table3: Table formatting
  - ora: Loading spinners
  - dotenv: Environment configuration

## Implementation Phases

### Phase 1: Project Setup ✅
- [x] Create directory structure
- [x] Create implementation plan
- [x] Create development rules (claude.md)
- [x] Set up .gitignore
- [x] Initialize pnpm project
- [x] Configure TypeScript
- [x] Install dependencies
- [x] Create .env.example

### Phase 2: Library Development ✅
- [x] Define TypeScript interfaces
- [x] Implement Bybit testnet adapter
- [x] Implement Hyperliquid testnet adapter
- [x] Create unified funding service with exchange-specific symbols
- [x] Add error handling

### Phase 3: CLI Implementation ✅
- [x] Set up commander.js structure
- [x] Implement default command (show all rates)
- [x] Add --symbol filter (supports base asset or full symbol)
- [x] Add --compare mode
- [x] Add --json output
- [x] Format output with colors and tables

### Phase 4: Testing & Polish ✅
- [x] Test TypeScript compilation
- [x] Test with real testnet credentials
- [x] Handle edge cases (different settlement currencies)
- [x] Add helpful error messages
- [x] Final documentation

## API Design

### Types
```typescript
interface FundingRate {
  exchange: 'bybit' | 'hyperliquid';
  symbol: string;
  rate: number;
  timestamp: number;
  nextFundingTime: number;
  interval: string;
  annualizedRate: number;
}

interface ComparisonResult {
  symbol: string;
  bybit: FundingRate | null;
  hyperliquid: FundingRate | null;
  spread: number;
  favorableExchange: Exchange | 'none';
}

interface ExchangeConfig {
  bybit: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
    symbols: string[];  // Exchange-specific symbols
  };
  hyperliquid: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
    symbols: string[];  // Exchange-specific symbols
  };
}
```

### Core Service
```typescript
class FundingService {
  constructor(config: ExchangeConfig)
  async fetchRates(): Promise<FundingRate[]>
  async fetchRatesForSymbol(symbol: string): Promise<FundingRate[]>
  async compareRates(baseAsset: string): Promise<ComparisonResult>
  async compareAllRates(): Promise<ComparisonResult[]>
  getConfiguredSymbols(): Record<string, string[]>
}
```

## CLI Commands

```bash
# Show all funding rates
pnpm start

# Filter by base asset (e.g., BTC)
pnpm start --symbol BTC

# Filter by full symbol (if configured)
pnpm start --symbol BTC/USDT:USDT

# Compare rates between exchanges
pnpm start --compare

# Compare specific asset
pnpm start --compare --symbol BTC

# JSON output
pnpm start --json

# Help
pnpm start --help
```

## Configuration

Environment variables via `.env`:
```
# Bybit Testnet
BYBIT_TESTNET_API_KEY=your_key
BYBIT_TESTNET_API_SECRET=your_secret

# Hyperliquid Testnet
HYPERLIQUID_TESTNET_API_KEY=your_key
HYPERLIQUID_TESTNET_API_SECRET=your_secret

# Exchange-specific symbols (perpetual contracts)
# Bybit uses USDT settlement
BYBIT_SYMBOLS=BTC/USDT:USDT,ETH/USDT:USDT,SOL/USDT:USDT

# Hyperliquid uses USDC settlement
HYPERLIQUID_SYMBOLS=BTC/USDC:USDC,ETH/USDC:USDC,SOL/USDC:USDC
```

## Key Implementation Details

### Exchange Differences Handled
- **Symbol Format**: Perpetual contracts use `BASE/QUOTE:SETTLE` format
- **Settlement Currency**: Bybit uses USDT, Hyperliquid uses USDC
- **Funding Intervals**: Bybit 8h, Hyperliquid 1h
- **API URLs**: Testnet URLs properly configured for each exchange

### Comparison Logic
- Maps between different quote currencies (USDT vs USDC)
- Compares by base asset (BTC, ETH, etc.)
- Calculates spread in annualized percentage points
- Identifies favorable exchange for long positions

## Error Handling

- Missing API credentials → Clear error message with setup instructions
- Invalid symbols → Exchange reports specific error
- Network failures → Error logged, continues with other exchanges
- Missing .env → Helpful message to create from .env.example

## Completed Features

✅ Real-time funding rate fetching from both exchanges
✅ Exchange-specific symbol configuration
✅ Side-by-side rate comparison with spread calculation
✅ Color-coded output (green = favorable, red = unfavorable)
✅ Annualized rate calculations
✅ Table and JSON output formats
✅ Base asset filtering (e.g., filter all BTC pairs)
✅ Proper testnet configuration

## Future Enhancements

- WebSocket support for real-time updates
- Historical funding rate tracking
- Database storage for rate history
- Position size recommendations
- Alert system for rate changes
- Delta neutral strategy automation
- More exchanges (Binance, OKX, etc.)