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

## Understanding Funding Rates

- **Positive funding rate** (red): Longs pay shorts
- **Negative funding rate** (green): Shorts pay longs
- **Funding intervals**:
  - Bybit: Every 8 hours
  - Hyperliquid: Every 1 hour

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
- `pnpm start` - Run the CLI
- `pnpm dev` - Build and run
- `pnpm typecheck` - Check types without building
- `pnpm clean` - Remove build artifacts

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

## License

MIT