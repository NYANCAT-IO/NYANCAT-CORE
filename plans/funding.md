# Funding Rate CLI Tool - Implementation Plan

## Overview

A simplified CLI tool to fetch and compare funding rates from Bybit and Hyperliquid testnet exchanges using the CCXT library.

## Architecture

### Core Components

1. **Library Layer** (`src/lib/`)
   - Exchange adapters for Bybit and Hyperliquid
   - Unified funding service
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

### Phase 1: Project Setup
- [x] Create directory structure
- [x] Create implementation plan
- [ ] Create development rules (claude.md)
- [ ] Set up .gitignore
- [ ] Initialize pnpm project
- [ ] Configure TypeScript
- [ ] Install dependencies
- [ ] Create .env.example

### Phase 2: Library Development
- [ ] Define TypeScript interfaces
- [ ] Implement Bybit testnet adapter
- [ ] Implement Hyperliquid testnet adapter
- [ ] Create unified funding service
- [ ] Add error handling

### Phase 3: CLI Implementation
- [ ] Set up commander.js structure
- [ ] Implement default command (show all rates)
- [ ] Add --symbol filter
- [ ] Add --compare mode
- [ ] Add --json output
- [ ] Format output with colors and tables

### Phase 4: Testing & Polish
- [ ] Test TypeScript compilation
- [ ] Test with real testnet credentials
- [ ] Handle edge cases
- [ ] Add helpful error messages
- [ ] Final documentation

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
  favorableExchange: string;
}
```

### Core Service
```typescript
class FundingService {
  constructor(config: ExchangeConfig)
  async fetchRates(symbols: string[]): Promise<FundingRate[]>
  async compareRates(symbol: string): Promise<ComparisonResult>
}
```

## CLI Commands

```bash
# Show all funding rates
pnpm start

# Filter by symbol
pnpm start --symbol BTC/USDT

# Compare rates between exchanges
pnpm start --compare

# JSON output
pnpm start --json

# Help
pnpm start --help
```

## Configuration

Environment variables via `.env`:
```
BYBIT_TESTNET_API_KEY=your_key
BYBIT_TESTNET_API_SECRET=your_secret
HYPERLIQUID_TESTNET_API_KEY=your_key
HYPERLIQUID_TESTNET_API_SECRET=your_secret
SYMBOLS=BTC/USDT,ETH/USDT
```

## Error Handling

- Missing API credentials → Clear error message
- Network failures → Retry with backoff
- Invalid symbols → List valid options
- Exchange errors → Show user-friendly message

## Future Enhancements

- WebSocket support for real-time updates
- Historical funding rate tracking
- APY calculations with fee considerations
- Position size recommendations
- Alert system for rate changes