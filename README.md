# CCXT Funding Rate CLI

A command-line tool for fetching and comparing perpetual futures funding rates from Bybit and Hyperliquid testnet exchanges.

## Features

- 📊 Real-time funding rate fetching from multiple exchanges
- 🔄 Side-by-side comparison of rates
- 🎨 Color-coded output (green = favorable, red = unfavorable for longs)
- 📈 Annualized rate calculations
- 🔧 Support for multiple trading pairs
- 📋 Table and JSON output formats

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ccxt-funding
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the TypeScript code:
```bash
pnpm build
```

4. Configure your API keys:
```bash
cp .env.example .env
# Edit .env with your testnet API credentials
```

## Configuration

Create a `.env` file with your API credentials. The tool supports both testnet and mainnet:

```env
# ========== TESTNET CONFIGURATION ==========
# Bybit Testnet
BYBIT_TESTNET_API_KEY=your_testnet_key_here
BYBIT_TESTNET_API_SECRET=your_testnet_secret_here

# Hyperliquid Testnet
HYPERLIQUID_TESTNET_API_KEY=your_testnet_key_here
HYPERLIQUID_TESTNET_API_SECRET=your_testnet_secret_here

# ========== MAINNET CONFIGURATION ==========
# Bybit Mainnet
BYBIT_MAINNET_API_KEY=your_mainnet_key_here
BYBIT_MAINNET_API_SECRET=your_mainnet_secret_here

# Hyperliquid Mainnet
HYPERLIQUID_MAINNET_API_KEY=your_mainnet_key_here
HYPERLIQUID_MAINNET_API_SECRET=your_mainnet_secret_here

# ========== SYMBOL CONFIGURATION ==========
# Exchange-specific symbols (same for testnet/mainnet)
# Bybit uses USDT settlement
BYBIT_SYMBOLS=BTC/USDT:USDT,ETH/USDT:USDT,SOL/USDT:USDT

# Hyperliquid uses USDC settlement
HYPERLIQUID_SYMBOLS=BTC/USDC:USDC,ETH/USDC:USDC,SOL/USDC:USDC
```

### Getting API Keys

#### Testnet (for testing)
- **Bybit Testnet**: https://testnet.bybit.com/
- **Hyperliquid Testnet**: https://app.hyperliquid-testnet.xyz/

#### Mainnet (real trading)
- **Bybit**: https://www.bybit.com/
- **Hyperliquid**: https://app.hyperliquid.xyz/

## Usage

### Network Selection

By default, the tool uses **testnet** for safety. To use mainnet, add the `--mainnet` flag:

```bash
# Default (testnet)
pnpm start

# Explicit testnet
pnpm start --testnet

# Mainnet (requires mainnet credentials)
pnpm start --mainnet
```

### Show all funding rates
```bash
# Testnet rates
pnpm start

# Mainnet rates
pnpm start --mainnet
```

### Filter by specific symbol or base asset
```bash
# Filter by base asset (e.g., BTC)
pnpm start --symbol BTC
pnpm start --mainnet --symbol BTC

# Filter by full symbol (if configured)
pnpm start --symbol BTC/USDT:USDT
```

### Compare rates between exchanges
```bash
# Testnet comparison
pnpm start --compare

# Mainnet comparison
pnpm start --mainnet --compare

# Compare specific asset
pnpm start --mainnet --compare --symbol BTC
```

### Output as JSON
```bash
pnpm start --json
pnpm start --mainnet --json
```

### Get help
```bash
pnpm start --help
```

## Bybit Market Data Fetcher

A separate tool for fetching comprehensive market data from Bybit mainnet:

### Usage
```bash
# Fetch all data (markets + tickers + summary)
pnpm fetch-bybit

# Fetch only market specifications
pnpm fetch-bybit --markets-only

# Fetch only tickers (includes funding rates)
pnpm fetch-bybit --tickers-only

# Include inactive markets
pnpm fetch-bybit --include-inactive
```

### Output
Data is saved to timestamped JSON files in the `data/bybit/` directory:
- `[timestamp]-markets.json` - All market specifications
- `[timestamp]-tickers.json` - Current prices and funding rates
- `[timestamp]-summary.json` - Analysis summary with funding rate statistics

### Features
- Fetches 2600+ markets from Bybit mainnet
- Calculates annualized funding rates (APR)
- Identifies top positive/negative funding opportunities
- No database required - saves to JSON files

**Note**: This tool requires BYBIT_MAINNET_API_KEY and BYBIT_MAINNET_API_SECRET in your .env file.

## Understanding Funding Rates

- **Positive funding rate** (red): Longs pay shorts
- **Negative funding rate** (green): Shorts pay longs
- **Funding intervals**:
  - Bybit: Every 8 hours (3x daily)
  - Hyperliquid: Every 1 hour (24x daily)

## Development

### Project Structure
```
ccxt-funding/
├── src/
│   ├── lib/              # Core library
│   │   ├── exchanges/    # Exchange adapters
│   │   ├── types.ts      # TypeScript interfaces
│   │   └── funding.ts    # Main service
│   └── cli/              # CLI application
├── plans/                # Implementation plans
├── docs/                 # Documentation
└── dist/                 # Compiled output
```

### Scripts
- `pnpm build` - Compile TypeScript
- `pnpm start` - Run the funding rate CLI
- `pnpm dev` - Build and run
- `pnpm typecheck` - Check types without building
- `pnpm clean` - Remove build artifacts
- `pnpm fetch-bybit` - Fetch comprehensive Bybit market data

### Using as a Library

The funding service can also be imported as a library:

```typescript
import { FundingService, ExchangeConfig } from './dist/lib/index.js';

const config: ExchangeConfig = {
  bybit: { 
    apiKey: '...', 
    apiSecret: '...', 
    testnet: true,
    symbols: ['BTC/USDT:USDT', 'ETH/USDT:USDT']
  },
  hyperliquid: { 
    apiKey: '...', 
    apiSecret: '...', 
    testnet: true,
    symbols: ['BTC/USDC:USDC', 'ETH/USDC:USDC']
  }
};

const service = new FundingService(config);
await service.connect();

const rates = await service.fetchRates();
console.log(rates);
```

## Troubleshooting

### Missing Environment Variables
If you see an error about missing environment variables, make sure you've created a `.env` file based on `.env.example`.

### Connection Errors
- Ensure you're using testnet API keys (not mainnet)
- Check your internet connection
- Verify the exchanges' testnet services are operational

### Symbol Not Found
- For perpetual contracts, use the format `BASE/QUOTE:SETTLE` (e.g., `BTC/USDT:USDT`)
- Bybit uses USDT settlement for most pairs
- Hyperliquid uses USDC settlement
- When using `--compare`, just specify the base asset (e.g., `BTC`)

## Delta-Neutral Analyzer

A tool for identifying delta-neutral arbitrage opportunities using spot and perpetual markets:

### Usage
```bash
# Analyze all opportunities
pnpm analyze-delta

# Filter by strategy
pnpm analyze-delta --strategy short-spot-long-perp

# Filter by minimum APR
pnpm analyze-delta --min-apr 10

# Filter by specific asset
pnpm analyze-delta --asset BTC

# Include fee calculations
pnpm analyze-delta --include-fees

# Output as JSON or CSV
pnpm analyze-delta --json
pnpm analyze-delta --csv
```

### Strategies
- **Long Spot + Short Perpetual**: Classic cash-and-carry trade
- **Short Spot + Long Perpetual**: Reverse arbitrage (requires margin)

### Example Output
The analyzer shows:
- Spot and perpetual prices
- Basis (price difference)
- Funding rate APR
- Net expected returns
- Capital requirements
- Risk warnings

## Troubleshooting

### Delta-Neutral Analyzer Issues

**Problem**: Many assets show identical funding rates (0.005% or 0.01%)
- This might be legitimate market data or a parsing issue
- Check `/docs/delta-neutral-analyzer-debugging.md` for detailed debugging steps
- Verify rates against Bybit website

**Problem**: No opportunities when including fees
- Current fee model (0.1% maker/taker) might be too conservative
- Try without fees first: `pnpm analyze-delta`
- Real opportunities might require VIP fee tiers

**Problem**: Futures contracts appearing in results
- Check for symbols with dates (e.g., -250829)
- These should be filtered out automatically
- Report specific symbols if they slip through

## FAQ: Funding Rate Convergence

### Why do many assets show identical funding rates?

This is **normal market behavior**, not a bug. Here's why:

1. **Market Efficiency**: Arbitrageurs quickly exploit funding rate differences between similar assets, causing rates to converge to common values.

2. **Low Volatility Periods**: When markets are calm, the premium between spot and perpetual prices narrows across many assets simultaneously.

3. **Exchange Mechanics**: Bybit's funding rate formula includes dampeners and clamps that create natural clustering around certain values (0.005%, 0.01%, 0.025%).

4. **Liquidity Cascades**: High-liquidity pairs (like BTC/USDT) set the "market rate" that lower-liquidity pairs tend to follow.

### How can I verify this is real data?

1. **Check Bybit's Official Rates**: Visit https://www.bybit.com/en/announcement-info/fund-rate/
2. **Compare Major Assets**: BTC, ETH, and SOL often show different rates than smaller assets
3. **Monitor During Volatility**: Rate dispersion increases during market volatility

### What does this mean for trading?

- **Fewer Obvious Opportunities**: When rates converge, arbitrage opportunities become scarce
- **Focus on Outliers**: Look for assets with unique funding rates
- **Time Your Entry**: Best opportunities appear during market transitions
- **Consider Fees**: With tight spreads, fee optimization becomes crucial

### Academic Research

For detailed analysis with academic sources, see `/docs/funding-rate-clustering-research.md`

Key findings from research:
- Perpetual futures use funding rates to maintain price convergence (Wharton Finance, 2023)
- Arbitrage mechanisms naturally cause rate clustering (arXiv, 2024)
- Industry reports confirm market-wide convergence in 2025 (Gate.io, 2025)

### Debug Commands

```bash
# Check raw data quality
cat data/bybit/*-tickers.json | jq '.tickers[0]'

# Verify funding rate distribution
pnpm analyze-delta --json | jq '.stats'

# Test specific asset
pnpm analyze-delta --asset BTC
```

For detailed debugging information, see:
- `/docs/delta-neutral-analyzer-debugging.md` - Comprehensive debugging guide
- `/docs/funding-rate-analysis.md` - Funding rate patterns analysis
- `/docs/context-reset-summary.md` - Quick reference after context reset

## License

MIT