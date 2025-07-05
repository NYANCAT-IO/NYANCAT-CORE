# Delta Neutral Funding Rate Arbitrage Tool - Implementation Plan

## Overview

This tool will implement a delta neutral strategy to farm funding rates across Bybit and Hyperliquid perpetual markets. The strategy involves taking opposite positions (long/short) on perpetual contracts to remain market-neutral while collecting funding payments.

## Project Location

- **Implementation Directory**: `/Users/bioharz/git/2025_2/cannes/stable-coin/ccxt-funding`
- **CCXT Library Location**: `/Users/bioharz/git/2025_2/cannes/stable-coin/ccxt` (read-only reference)

## Architecture

### Directory Structure
```
ccxt-funding/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
├── src/
│   ├── index.ts                    # Main entry point
│   ├── config/
│   │   ├── exchanges.ts            # Exchange configuration
│   │   └── symbols.ts              # Trading pairs configuration
│   ├── services/
│   │   ├── FundingRateService.ts   # Fetches funding rates
│   │   ├── PositionCalculator.ts   # Position size calculations
│   │   └── APYCalculator.ts        # APY calculations
│   ├── exchanges/
│   │   ├── BaseExchange.ts         # Abstract base class
│   │   ├── BybitClient.ts          # Bybit-specific implementation
│   │   └── HyperliquidClient.ts    # Hyperliquid-specific implementation
│   ├── strategies/
│   │   └── DeltaNeutralStrategy.ts # Main strategy implementation
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   └── utils/
│       ├── logger.ts               # Logging utility
│       └── helpers.ts              # Helper functions
├── tests/
│   └── ...                         # Test files
└── examples/
    ├── basic-funding-monitor.ts    # Simple funding rate monitor
    └── apy-calculator.ts           # Standalone APY calculator
```

## Key Components

### 1. Exchange Clients

**BaseExchange.ts**
```typescript
interface IExchangeClient {
  fetchFundingRates(symbols: string[]): Promise<FundingRates>;
  fetchFundingRateHistory(symbol: string, since?: number, limit?: number): Promise<FundingRateHistory[]>;
  fetchTicker(symbol: string): Promise<Ticker>;
  fetchBalance(): Promise<Balance>;
  watchTicker(symbol: string): Promise<void>;
  createOrder(symbol: string, side: 'buy' | 'sell', amount: number): Promise<Order>;
}
```

### 2. Data Types

```typescript
interface FundingData {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
  interval: string; // '8h' for Bybit, '1h' for Hyperliquid
  markPrice: number;
  indexPrice: number;
}

interface ArbitrageOpportunity {
  longExchange: string;
  shortExchange: string;
  symbol: string;
  fundingRateDiff: number;
  estimatedAPY: number;
  requiredCapital: number;
  risks: string[];
}

interface PositionPair {
  longPosition: Position;
  shortPosition: Position;
  netExposure: number;
  fundingPnL: number;
  totalPnL: number;
}
```

## Implementation Details

### Exchange Differences

#### Bybit
- Funding interval: 8 hours (3x daily)
- Funding times: 00:00, 08:00, 16:00 UTC
- REST API: fetchFundingRates, fetchFundingRateHistory
- WebSocket: ticker updates (includes funding in ticker)
- Testnet: `testnet.bybit.com`

#### Hyperliquid
- Funding interval: 1 hour (24x daily)
- Funding times: Every hour on the hour
- REST API: fetchFundingRates, fetchFundingRateHistory
- WebSocket: ticker updates
- Testnet: `api.hyperliquid-testnet.xyz`

### APY Calculation Formula

```typescript
// For a single funding period
fundingPayment = positionSize * fundingRate

// Annualized calculation
// Bybit (8h intervals): 3 payments per day
bybitAPY = fundingRate * 3 * 365 * 100

// Hyperliquid (1h intervals): 24 payments per day
hyperliquidAPY = fundingRate * 24 * 365 * 100

// Delta neutral APY (simplified)
// Assumes equal position sizes on both sides
deltaNeutralAPY = (longFundingAPY - shortFundingAPY) - costs

// Where costs include:
// - Trading fees (maker/taker)
// - Spread costs
// - Rebalancing costs
// - Slippage
```

### Core Features

1. **Funding Rate Monitor**
   - Poll funding rates every minute
   - Store historical data
   - Calculate moving averages
   - Detect rate anomalies

2. **Opportunity Scanner**
   - Compare funding rates across exchanges
   - Calculate potential APY
   - Factor in trading costs
   - Risk assessment

3. **Position Manager**
   - Calculate optimal position sizes
   - Monitor delta neutrality
   - Rebalancing logic
   - Risk limits

4. **Performance Tracker**
   - Track realized funding payments
   - Calculate actual vs theoretical APY
   - Performance metrics

## Implementation Steps

### Phase 1: Basic Setup (Day 1)
1. Initialize project with TypeScript
2. Install dependencies (ccxt, dotenv, winston)
3. Set up basic exchange connections
4. Implement funding rate fetching

### Phase 2: Core Functionality (Day 2-3)
1. Implement FundingRateService
2. Build APYCalculator
3. Create comparison logic
4. Add WebSocket connections for real-time data

### Phase 3: Strategy Implementation (Day 4-5)
1. Implement DeltaNeutralStrategy
2. Add position sizing logic
3. Build opportunity scanner
4. Create execution simulation

### Phase 4: Testing & Refinement (Day 6-7)
1. Unit tests for calculators
2. Integration tests with testnet
3. Performance optimization
4. Documentation

## Configuration

### Environment Variables (.env)
```bash
# Bybit Testnet
BYBIT_TESTNET_API_KEY=your_key
BYBIT_TESTNET_API_SECRET=your_secret

# Hyperliquid Testnet
HYPERLIQUID_TESTNET_API_KEY=your_key
HYPERLIQUID_TESTNET_API_SECRET=your_secret

# Trading Configuration
TRADING_PAIRS=BTC/USDT,ETH/USDT
MAX_POSITION_SIZE=10000
MIN_APY_THRESHOLD=10

# Risk Management
MAX_DELTA_EXPOSURE=100
REBALANCE_THRESHOLD=0.05
```

## Usage Example

```typescript
import { DeltaNeutralStrategy } from './src/strategies/DeltaNeutralStrategy';
import { BybitClient, HyperliquidClient } from './src/exchanges';

async function main() {
  // Initialize exchanges
  const bybit = new BybitClient({ testnet: true });
  const hyperliquid = new HyperliquidClient({ testnet: true });
  
  // Create strategy
  const strategy = new DeltaNeutralStrategy({
    exchanges: [bybit, hyperliquid],
    symbols: ['BTC/USDT:USDT', 'ETH/USDT:USDT'],
    minAPY: 10, // 10% minimum APY
  });
  
  // Start monitoring
  await strategy.start();
  
  // Monitor opportunities
  strategy.on('opportunity', (opp) => {
    console.log(`Opportunity found: ${opp.estimatedAPY}% APY`);
  });
}
```

## Testing Approach

1. **Unit Tests**
   - APY calculations
   - Position sizing
   - Risk calculations

2. **Integration Tests**
   - Testnet API connections
   - Order placement simulation
   - Funding payment tracking

3. **Backtesting**
   - Historical funding rate analysis
   - Strategy performance simulation
   - Risk scenario testing

## Risk Considerations

1. **Market Risk**
   - Delta drift during volatile markets
   - Liquidation risk if not properly balanced

2. **Execution Risk**
   - Slippage during entry/exit
   - Failed orders disrupting neutrality

3. **Funding Risk**
   - Sudden funding rate changes
   - Different funding intervals between exchanges

4. **Operational Risk**
   - API downtime
   - Network issues
   - Exchange-specific risks

## Next Steps

1. Copy this plan to `/Users/bioharz/git/2025_2/cannes/stable-coin/ccxt-funding/plan.md`
2. Initialize the new project directory
3. Begin implementation following the phases outlined above
4. Use testnet credentials for safe development
5. Monitor both REST and WebSocket data streams

## Dependencies

```json
{
  "dependencies": {
    "ccxt": "^4.4.92",
    "dotenv": "^16.0.0",
    "winston": "^3.8.0",
    "eventemitter3": "^5.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
```