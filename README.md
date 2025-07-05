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

Create a `.env` file with your testnet API credentials:

```env
# Bybit Testnet
BYBIT_TESTNET_API_KEY=your_key_here
BYBIT_TESTNET_API_SECRET=your_secret_here

# Hyperliquid Testnet
HYPERLIQUID_TESTNET_API_KEY=your_key_here
HYPERLIQUID_TESTNET_API_SECRET=your_secret_here

# Trading pairs (comma-separated)
SYMBOLS=BTC/USDT,ETH/USDT,SOL/USDT
```

### Getting Testnet API Keys

- **Bybit Testnet**: https://testnet.bybit.com/
- **Hyperliquid Testnet**: https://app.hyperliquid-testnet.xyz/

## Usage

### Show all funding rates
```bash
pnpm start
```

### Filter by specific symbol
```bash
pnpm start --symbol BTC/USDT
```

### Compare rates between exchanges
```bash
pnpm start --compare
```

### Output as JSON
```bash
pnpm start --json
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
  bybit: { apiKey: '...', apiSecret: '...', testnet: true },
  hyperliquid: { apiKey: '...', apiSecret: '...', testnet: true }
};

const service = new FundingService(config, ['BTC/USDT']);
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
Make sure the symbol format matches what the exchanges expect (e.g., `BTC/USDT` not `BTCUSDT`).

## License

MIT