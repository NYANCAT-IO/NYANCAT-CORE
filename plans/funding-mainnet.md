# Mainnet Support Implementation Plan

## Overview

Add mainnet support to the funding rate CLI tool while maintaining testnet functionality. Users can switch between testnet and mainnet using command-line flags or environment configuration.

## Requirements

1. **Dual Environment Support**: Support both testnet and mainnet configurations
2. **Command-Line Switches**: `--testnet` and `--mainnet` flags
3. **Separate Credentials**: Different API keys for testnet vs mainnet
4. **Default Behavior**: Default to testnet for safety
5. **Clear Indication**: Always show which network is being used

## Implementation Details

### 1. Environment Configuration Updates

#### .env.example Structure
```env
# Network Selection (testnet/mainnet)
DEFAULT_NETWORK=testnet

# ===== TESTNET CONFIGURATION =====
# Bybit Testnet
BYBIT_TESTNET_API_KEY=your_testnet_key
BYBIT_TESTNET_API_SECRET=your_testnet_secret

# Hyperliquid Testnet
HYPERLIQUID_TESTNET_API_KEY=your_testnet_key
HYPERLIQUID_TESTNET_API_SECRET=your_testnet_secret

# ===== MAINNET CONFIGURATION =====
# Bybit Mainnet
BYBIT_MAINNET_API_KEY=your_mainnet_key
BYBIT_MAINNET_API_SECRET=your_mainnet_secret

# Hyperliquid Mainnet
HYPERLIQUID_MAINNET_API_KEY=your_mainnet_key
HYPERLIQUID_MAINNET_API_SECRET=your_mainnet_secret

# ===== SYMBOL CONFIGURATION =====
# Exchange-specific symbols (same for testnet/mainnet)
BYBIT_SYMBOLS=BTC/USDT:USDT,ETH/USDT:USDT,SOL/USDT:USDT
HYPERLIQUID_SYMBOLS=BTC/USDC:USDC,ETH/USDC:USDC,SOL/USDC:USDC
```

### 2. Type Updates

```typescript
// src/lib/types.ts
export interface NetworkConfig {
  network: 'testnet' | 'mainnet';
  isDefault: boolean;
}

export interface ExchangeCredentials {
  testnet: {
    apiKey: string;
    apiSecret: string;
  };
  mainnet: {
    apiKey: string;
    apiSecret: string;
  };
}

// Update ExchangeConfig
export interface ExchangeConfig {
  network: 'testnet' | 'mainnet';
  bybit: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
    symbols: string[];
  };
  hyperliquid: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
    symbols: string[];
  };
}
```

### 3. CLI Updates

```typescript
// src/cli/index.ts
program
  .option('-s, --symbol <symbol>', 'Filter by specific symbol or base asset')
  .option('-c, --compare', 'Compare rates between exchanges')
  .option('-j, --json', 'Output as JSON')
  .option('--testnet', 'Use testnet (default)')
  .option('--mainnet', 'Use mainnet (requires mainnet API keys)')
  .action(async (options) => {
    // Determine network
    const network = options.mainnet ? 'mainnet' : 'testnet';
    const config = loadConfig(network);
    
    // Show network in output
    console.log(chalk.cyan(`🌐 Network: ${network.toUpperCase()}\n`));
    
    // Continue with existing logic...
  });
```

### 4. Config Loading Updates

```typescript
function loadConfig(network: 'testnet' | 'mainnet'): ExchangeConfig {
  const envPrefix = network.toUpperCase();
  
  const requiredEnvVars = [
    `BYBIT_${envPrefix}_API_KEY`,
    `BYBIT_${envPrefix}_API_SECRET`,
    `HYPERLIQUID_${envPrefix}_API_KEY`,
    `HYPERLIQUID_${envPrefix}_API_SECRET`,
  ];

  // Check for missing vars
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(chalk.red(`❌ Missing ${network} environment variables:`));
    missing.forEach(key => console.error(chalk.red(`   - ${key}`)));
    console.error(chalk.yellow(`\n💡 Please add ${network} credentials to your .env file`));
    process.exit(1);
  }

  // Parse symbols (same for both networks)
  const bybitSymbols = process.env.BYBIT_SYMBOLS?.split(',').map(s => s.trim()) || ['BTC/USDT:USDT'];
  const hyperliquidSymbols = process.env.HYPERLIQUID_SYMBOLS?.split(',').map(s => s.trim()) || ['BTC/USDC:USDC'];

  return {
    network,
    bybit: {
      apiKey: process.env[`BYBIT_${envPrefix}_API_KEY`]!,
      apiSecret: process.env[`BYBIT_${envPrefix}_API_SECRET`]!,
      testnet: network === 'testnet',
      symbols: bybitSymbols,
    },
    hyperliquid: {
      apiKey: process.env[`HYPERLIQUID_${envPrefix}_API_KEY`]!,
      apiSecret: process.env[`HYPERLIQUID_${envPrefix}_API_SECRET`]!,
      testnet: network === 'testnet',
      symbols: hyperliquidSymbols,
    },
  };
}
```

### 5. Exchange Adapter Updates

```typescript
// src/lib/exchanges/bybit.ts
export class BybitAdapter implements IExchangeAdapter {
  constructor(apiKey: string, apiSecret: string, testnet: boolean = true) {
    this.exchange = new ccxt.bybit({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
        testnet: testnet,
      },
    });

    if (testnet) {
      this.exchange.urls.api = {
        public: 'https://api-testnet.bybit.com',
        private: 'https://api-testnet.bybit.com',
      };
    }
    // Mainnet uses default URLs
  }
}

// src/lib/exchanges/hyperliquid.ts
export class HyperliquidAdapter implements IExchangeAdapter {
  constructor(apiKey: string, apiSecret: string, testnet: boolean = true) {
    this.exchange = new ccxt.hyperliquid({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'swap',
      },
    });

    if (testnet) {
      this.exchange.urls.api = this.exchange.urls.test;
    }
    // Mainnet uses default URLs
  }
}
```

### 6. Display Updates

```typescript
// Update table headers to show network
function displayRatesTable(rates: FundingRate[], network: string) {
  const table = new Table({
    head: [
      chalk.cyan('Exchange'),
      chalk.cyan('Symbol'),
      chalk.cyan('Funding Rate'),
      chalk.cyan('Annualized'),
      chalk.cyan('Interval'),
      chalk.cyan('Next Funding'),
    ],
    style: { head: [] },
    colWidths: [12, 15, 14, 12, 10, 24],
  });

  // Add network indicator to title
  console.log('\n' + chalk.bold(`📊 Current Funding Rates (${network.toUpperCase()})\n`));
  
  // Rest of implementation...
}
```

### 7. Safety Features

1. **Default to Testnet**: If no flag specified, use testnet
2. **Confirmation for Mainnet**: Show warning when using mainnet
3. **Network in Output**: Always display which network is active
4. **Separate Credentials**: Never mix testnet/mainnet keys

### 8. Usage Examples

```bash
# Default (testnet)
pnpm start

# Explicit testnet
pnpm start --testnet

# Mainnet
pnpm start --mainnet

# Mainnet with comparison
pnpm start --mainnet --compare

# Mainnet with specific symbol
pnpm start --mainnet --symbol BTC
```

## Implementation Steps

1. **Update Types** (src/lib/types.ts)
   - Add NetworkConfig interface
   - Update ExchangeConfig to include network

2. **Update CLI** (src/cli/index.ts)
   - Add --testnet and --mainnet options
   - Update loadConfig to accept network parameter
   - Show network in output

3. **Update Adapters** (src/lib/exchanges/)
   - Ensure mainnet URLs are used when testnet=false
   - No hardcoded testnet URLs for mainnet

4. **Update Documentation**
   - Update .env.example with both configs
   - Update README with mainnet usage
   - Add warnings about mainnet usage

5. **Testing**
   - Test testnet functionality (should work as before)
   - Test mainnet with real credentials
   - Verify network switching works correctly
   - Ensure no credential mixing

## Security Considerations

1. **Credential Separation**: Keep testnet and mainnet credentials completely separate
2. **Default Safety**: Always default to testnet to prevent accidental mainnet usage
3. **Clear Indicators**: Make it obvious which network is being used
4. **No Hardcoded Keys**: All credentials must come from environment variables

## Future Enhancements

1. **Network Auto-Detection**: Detect network from API key format (if possible)
2. **Multi-Network Support**: Run both networks simultaneously for comparison
3. **Network-Specific Symbols**: Different symbol lists for testnet vs mainnet
4. **Rate Limit Differences**: Handle different rate limits between networks