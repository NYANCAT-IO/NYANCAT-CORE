# Project Context: CCXT Funding Rate Tools

## Project Origin

This project began as a **delta-neutral funding rate arbitrage tool** but evolved into a comprehensive suite of tools for analyzing cryptocurrency funding rates. The original vision was to identify arbitrage opportunities between exchanges by comparing funding rates for delta-neutral positions.

### Development Philosophy

The user specifically requested an **agent-driven development approach** rather than traditional test-driven development. This meant:
- No formal test suites
- Emphasis on rapid iteration and real-world testing
- Commit after every meaningful change
- Continuous manual verification of functionality

## Architecture Decisions

### Library/CLI Split
The codebase was intentionally designed with a clear separation:
- **Library (`src/lib/`)**: Reusable components for other projects
- **CLI (`src/cli/`)**: Command-line interfaces built on top of the library

This architecture enables:
- Integration into trading bots or web applications
- Multiple CLI tools sharing the same core functionality
- Clean separation of concerns

### Simplified Approach
Per user requirements, the implementation follows these principles:
- No database (stateless operation)
- No rate limiting beyond CCXT's built-in limits
- HTTPS only (no WebSocket for initial implementation)
- Environment-based configuration
- TypeScript for type safety

## Key Technical Discoveries

### 1. CCXT TypeScript Limitations
CCXT has no official TypeScript definitions, requiring:
```typescript
// We use 'any' types throughout for CCXT objects
private exchange: any;
const tickers: any = await exchange.fetchTickers();
```

### 2. Bybit API Insights
- **Major Discovery**: Bybit includes funding rates in ticker data
  - This eliminates the need for separate funding rate API calls
  - Significant efficiency improvement over other exchanges
- **Limitation**: `fetchTickers()` cannot mix symbol types
  - Cannot fetch spot and perpetual symbols in the same call
  - Solution: Fetch all tickers without filtering

### 3. Exchange-Specific Details
- **Settlement Currencies**:
  - Bybit: Primarily USDT (some USDC pairs)
  - Hyperliquid: Exclusively USDC
- **Funding Payment Frequency**:
  - Bybit: 3 times daily (every 8 hours)
  - Hyperliquid: 24 times daily (every hour)
- **Symbol Format**: Perpetuals require `BASE/QUOTE:SETTLE` format

## Implemented Tools

### 1. Funding Rate CLI (`pnpm start`)
The main tool for comparing funding rates between exchanges:
- Fetches real-time funding rates
- Supports testnet and mainnet
- Compares rates between Bybit and Hyperliquid
- Calculates annualized rates (APR)

### 2. Bybit Market Data Fetcher (`pnpm fetch-bybit`)
Comprehensive data collection tool:
- Fetches all market specifications
- Retrieves current prices and funding rates
- Generates analysis summaries
- Saves timestamped JSON files
- Mainnet-only implementation

## Important Formulas

### Annualized Funding Rate (APR)
```typescript
// For Bybit (3 payments daily)
const annualizedRate = fundingRate * 3 * 365 * 100;

// For Hyperliquid (24 payments daily)
const annualizedRate = fundingRate * 24 * 365 * 100;
```

## Evolution Timeline

1. **Initial Request**: Delta-neutral arbitrage tool with agent-driven development
2. **Simplification**: No database, REST-only approach per user feedback
3. **Discovery Phase**: Found testnet rates unrealistic (±547.50% APR)
4. **Mainnet Support**: Added network switching capability
5. **Data Collection**: Created separate tool for comprehensive market data

## Future Considerations

While not implemented, the architecture supports:
- WebSocket integration for real-time updates
- Cross-exchange arbitrage calculations
- Historical data tracking (with database)
- Automated trading integration

## Lessons Learned

1. **Testnet Limitations**: Testnet funding rates are often unrealistic
2. **API Efficiency**: Some exchanges (Bybit) bundle data efficiently
3. **Symbol Standards**: Each exchange has unique symbol formatting
4. **Type Safety**: Working with untyped libraries requires careful handling

## Development Rules

The project follows strict guidelines documented in `claude.md`:
- Commit after every task
- Check for sensitive data before commits
- Use pnpm exclusively
- TypeScript compilation must pass
- Test actual functionality, not just compilation