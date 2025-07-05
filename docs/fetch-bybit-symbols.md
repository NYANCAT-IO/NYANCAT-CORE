# Fetching All Bybit Symbols with CCXT

## Overview

CCXT provides a unified `fetchMarkets()` method to retrieve all available trading symbols from Bybit. This is essential for:
- Discovering available trading pairs
- Understanding market specifications (contract size, precision, limits)
- Filtering markets for specific strategies (like delta neutral with funding rates)
- Building dynamic symbol lists for your application

## Basic Usage

```typescript
import ccxt from 'ccxt';

// Create exchange instance
const exchange = new ccxt.bybit({
    apiKey: 'YOUR_API_KEY',      // Optional for public data
    secret: 'YOUR_API_SECRET',   // Optional for public data
    testnet: true,               // Use false for mainnet
});

// Fetch all markets
const markets = await exchange.fetchMarkets();
console.log(`Total markets: ${markets.length}`);
```

## Market Object Structure

Each market object returned contains the following key fields:

```typescript
interface Market {
    // Identifiers
    id: string;              // Exchange-specific ID (e.g., "BTCUSDT")
    symbol: string;          // CCXT unified symbol (e.g., "BTC/USDT:USDT")
    
    // Currency components
    base: string;            // Base currency (e.g., "BTC")
    quote: string;           // Quote currency (e.g., "USDT")
    settle: string;          // Settlement currency for derivatives (e.g., "USDT")
    baseId: string;          // Exchange-specific base currency ID
    quoteId: string;         // Exchange-specific quote currency ID
    settleId: string;        // Exchange-specific settlement currency ID
    
    // Market type flags
    spot: boolean;           // Is spot market
    margin: boolean;         // Supports margin trading
    swap: boolean;           // Is perpetual swap (has funding)
    future: boolean;         // Is futures contract
    option: boolean;         // Is options contract
    contract: boolean;       // Is any derivative (swap/future/option)
    
    // Contract specifications
    linear: boolean;         // Linear contract (settled in quote currency)
    inverse: boolean;        // Inverse contract (settled in base currency)
    contractSize: number;    // Contract size (1 for linear, varies for inverse)
    
    // Status
    active: boolean;         // Whether market is currently trading
    
    // Trading specifications
    precision: {
        amount: number;      // Decimal places for amount
        price: number;       // Decimal places for price
        cost?: number;       // Decimal places for cost
    };
    
    limits: {
        amount?: { min: number, max: number };
        price?: { min: number, max: number };
        cost?: { min: number, max: number };
        leverage?: { min: number, max: number };
    };
    
    // Fees (if available)
    taker?: number;          // Taker fee rate
    maker?: number;          // Maker fee rate
    
    // Raw exchange data
    info: any;               // Original exchange response
}
```

## Filtering Markets

### By Market Type

```typescript
// Fetch all markets
const markets = await exchange.fetchMarkets();

// Filter by type
const spotMarkets = markets.filter(m => m.spot);
const perpetualSwaps = markets.filter(m => m.swap && m.linear);
const inversePerps = markets.filter(m => m.swap && m.inverse);
const futures = markets.filter(m => m.future);
const options = markets.filter(m => m.option);

console.log(`Spot markets: ${spotMarkets.length}`);
console.log(`Linear perpetuals: ${perpetualSwaps.length}`);
console.log(`Inverse perpetuals: ${inversePerps.length}`);
```

### By Base Asset

```typescript
// Find all BTC markets
const btcMarkets = markets.filter(m => m.base === 'BTC');

// Find all BTC perpetuals
const btcPerpetuals = markets.filter(m => 
    m.base === 'BTC' && 
    m.swap === true
);

// Find all ETH markets with USDT settlement
const ethUsdtMarkets = markets.filter(m => 
    m.base === 'ETH' && 
    m.settle === 'USDT'
);
```

### By Settlement Currency

```typescript
// Find all USDT-settled perpetuals
const usdtPerpetuals = markets.filter(m => 
    m.swap === true && 
    m.settle === 'USDT'
);

// Find all USDC-settled perpetuals  
const usdcPerpetuals = markets.filter(m => 
    m.swap === true && 
    m.settle === 'USDC'
);

// Find all inverse (coin-margined) perpetuals
const inversePerpetuals = markets.filter(m => 
    m.swap === true && 
    m.inverse === true
);
```

### Finding Funding-Enabled Markets

Only perpetual swaps have funding rates:

```typescript
// All markets with funding rates
const fundingMarkets = markets.filter(m => m.swap === true);

// Active perpetuals only
const activePerpetuals = markets.filter(m => 
    m.swap === true && 
    m.active === true
);

// Group by settlement currency
const perpetualsBySettlement = activePerpetuals.reduce((acc, market) => {
    const settle = market.settle || 'unknown';
    if (!acc[settle]) acc[settle] = [];
    acc[settle].push(market);
    return acc;
}, {} as Record<string, typeof markets>);

console.log('Perpetuals by settlement:');
Object.entries(perpetualsBySettlement).forEach(([settle, markets]) => {
    console.log(`${settle}: ${markets.length} markets`);
});
```

## Symbol Format Understanding

### CCXT Unified Format

CCXT uses a unified symbol format across all exchanges:

- **Spot**: `BASE/QUOTE` (e.g., "BTC/USDT")
- **Linear Perpetual**: `BASE/QUOTE:SETTLE` (e.g., "BTC/USDT:USDT")
- **Inverse Perpetual**: `BASE/QUOTE:SETTLE` (e.g., "BTC/USD:BTC")
- **Futures**: `BASE/QUOTE:SETTLE-EXPIRY` (e.g., "BTC/USDT:USDT-240329")
- **Options**: `BASE/QUOTE:SETTLE-EXPIRY-STRIKE-TYPE` (e.g., "BTC/USD:BTC-240329-50000-C")

### Symbol vs ID

```typescript
const btcPerp = markets.find(m => m.id === 'BTCUSDT' && m.swap);
console.log(`ID: ${btcPerp.id}`);           // "BTCUSDT" (exchange-specific)
console.log(`Symbol: ${btcPerp.symbol}`);   // "BTC/USDT:USDT" (CCXT unified)
```

## Practical Examples for Delta Neutral Strategies

### Finding Suitable Perpetual Pairs

```typescript
async function findDeltaNeutralPairs(baseAssets: string[] = ['BTC', 'ETH']) {
    const markets = await exchange.fetchMarkets();
    
    // Get all active perpetuals for specified assets
    const perpetuals = markets.filter(m => 
        m.swap === true && 
        m.active === true &&
        baseAssets.includes(m.base)
    );
    
    // Group by base asset and settlement
    const grouped = perpetuals.reduce((acc, market) => {
        const key = `${market.base}_${market.settle}`;
        if (!acc[key]) {
            acc[key] = {
                base: market.base,
                settle: market.settle,
                symbol: market.symbol,
                linear: market.linear,
                inverse: market.inverse,
                contractSize: market.contractSize,
            };
        }
        return acc;
    }, {} as Record<string, any>);
    
    return Object.values(grouped);
}

// Usage
const pairs = await findDeltaNeutralPairs(['BTC', 'ETH', 'SOL']);
console.log('Available perpetual pairs:', pairs);
```

### Checking Market Specifications

```typescript
function checkMarketSpecs(market: any) {
    console.log(`\n=== ${market.symbol} ===`);
    console.log(`Type: ${market.linear ? 'Linear' : 'Inverse'}`);
    console.log(`Settlement: ${market.settle}`);
    console.log(`Contract Size: ${market.contractSize}`);
    console.log(`Min Amount: ${market.limits.amount?.min}`);
    console.log(`Max Amount: ${market.limits.amount?.max}`);
    console.log(`Price Precision: ${market.precision.price} decimals`);
    console.log(`Amount Precision: ${market.precision.amount} decimals`);
    
    // Check if suitable for funding arbitrage
    if (market.swap && market.active) {
        console.log(`✅ Suitable for funding arbitrage`);
    }
}

// Check BTC/USDT perpetual
const btcUsdt = markets.find(m => m.symbol === 'BTC/USDT:USDT');
if (btcUsdt) checkMarketSpecs(btcUsdt);
```

## Performance Considerations

### Caching Strategy

```typescript
class MarketCache {
    private markets: any[] = [];
    private lastUpdate: number = 0;
    private cacheTime: number = 3600000; // 1 hour in ms
    
    async getMarkets(exchange: any, forceRefresh = false): Promise<any[]> {
        const now = Date.now();
        
        if (forceRefresh || 
            this.markets.length === 0 || 
            (now - this.lastUpdate) > this.cacheTime) {
            
            console.log('Fetching fresh market data...');
            this.markets = await exchange.fetchMarkets();
            this.lastUpdate = now;
        }
        
        return this.markets;
    }
    
    // Get perpetuals with optional refresh
    async getPerpetuals(exchange: any, forceRefresh = false): Promise<any[]> {
        const markets = await this.getMarkets(exchange, forceRefresh);
        return markets.filter(m => m.swap === true);
    }
}

// Usage
const marketCache = new MarketCache();
const perpetuals = await marketCache.getPerpetuals(exchange);
```

### Rate Limiting

Bybit's `fetchMarkets()` is a public endpoint with generous rate limits, but consider:

```typescript
// Add delay between multiple exchange queries
async function fetchMultipleExchanges() {
    const exchanges = ['bybit', 'binance', 'okx'];
    const allMarkets = {};
    
    for (const exchangeName of exchanges) {
        const exchange = new ccxt[exchangeName]();
        allMarkets[exchangeName] = await exchange.fetchMarkets();
        
        // Add small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return allMarkets;
}
```

## Integration with Funding Rate Tool

```typescript
// Extend the existing FundingService
class EnhancedFundingService extends FundingService {
    private marketCache = new Map<string, any[]>();
    
    async getAvailableSymbols(exchange: 'bybit' | 'hyperliquid'): Promise<string[]> {
        // Check cache first
        if (!this.marketCache.has(exchange)) {
            const client = exchange === 'bybit' ? this.bybit : this.hyperliquid;
            const markets = await client.fetchMarkets();
            this.marketCache.set(exchange, markets);
        }
        
        const markets = this.marketCache.get(exchange)!;
        
        // Return only active perpetual symbols
        return markets
            .filter(m => m.swap && m.active)
            .map(m => m.symbol);
    }
    
    async validateSymbols(symbols: string[]): Promise<{
        valid: string[];
        invalid: string[];
    }> {
        const bybitSymbols = await this.getAvailableSymbols('bybit');
        const hyperliquidSymbols = await this.getAvailableSymbols('hyperliquid');
        
        const allSymbols = new Set([...bybitSymbols, ...hyperliquidSymbols]);
        
        const valid = symbols.filter(s => allSymbols.has(s));
        const invalid = symbols.filter(s => !allSymbols.has(s));
        
        return { valid, invalid };
    }
}
```

## Common Patterns

### 1. Get All Funding-Eligible Symbols

```typescript
async function getFundingSymbols(): Promise<string[]> {
    const markets = await exchange.fetchMarkets();
    return markets
        .filter(m => m.swap && m.active && m.linear)
        .map(m => m.symbol)
        .sort();
}
```

### 2. Find Cross-Exchange Arbitrage Opportunities

```typescript
async function findArbitrageSymbols(exchange1: any, exchange2: any) {
    const [markets1, markets2] = await Promise.all([
        exchange1.fetchMarkets(),
        exchange2.fetchMarkets()
    ]);
    
    const perps1 = new Set(
        markets1
            .filter(m => m.swap && m.active)
            .map(m => m.base)
    );
    
    const perps2 = new Set(
        markets2
            .filter(m => m.swap && m.active)
            .map(m => m.base)
    );
    
    // Find common base assets
    const common = [...perps1].filter(base => perps2.has(base));
    
    return common;
}
```

### 3. Market Summary Report

```typescript
async function generateMarketSummary() {
    const markets = await exchange.fetchMarkets();
    
    const summary = {
        total: markets.length,
        active: markets.filter(m => m.active).length,
        spot: markets.filter(m => m.spot).length,
        perpetuals: markets.filter(m => m.swap).length,
        linearPerps: markets.filter(m => m.swap && m.linear).length,
        inversePerps: markets.filter(m => m.swap && m.inverse).length,
        futures: markets.filter(m => m.future).length,
        options: markets.filter(m => m.option).length,
        settlementCurrencies: [...new Set(
            markets
                .filter(m => m.settle)
                .map(m => m.settle)
        )],
        baseAssets: [...new Set(markets.map(m => m.base))].length,
    };
    
    return summary;
}
```

## Error Handling

```typescript
async function safelyFetchMarkets(exchange: any, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            return await exchange.fetchMarkets();
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error.message);
            
            if (i === retries - 1) throw error;
            
            // Wait before retry (exponential backoff)
            await new Promise(resolve => 
                setTimeout(resolve, Math.pow(2, i) * 1000)
            );
        }
    }
}
```

## Conclusion

The `fetchMarkets()` method is your gateway to discovering all available trading opportunities on Bybit. For delta neutral strategies:

1. Focus on perpetual swaps (`swap === true`)
2. Check settlement currencies match your needs
3. Verify markets are active
4. Understand the difference between linear and inverse contracts
5. Cache market data appropriately to reduce API calls

Remember that market specifications can change, so periodic updates are recommended, especially for limits and precision values.