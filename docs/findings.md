# Funding Rate CLI Tool - Implementation Findings

## Date: 2025-01-04

### Key Discoveries

#### 1. Symbol Format Differences
- **Spot vs Perpetual**: CCXT requires perpetual contract symbols in the format `BASE/QUOTE:SETTLE`
- **Bybit**: Uses `BTC/USDT:USDT` format for USDT-margined perpetuals
- **Hyperliquid**: Uses `BTC/USDC:USDC` format for USDC-margined contracts

#### 2. Settlement Currency Differences
- **Bybit**: Primarily uses USDT as settlement currency
- **Hyperliquid**: Uses USDC as settlement currency
- **Impact**: Cannot directly compare the same symbol across exchanges; must map by base asset

#### 3. Funding Interval Differences
- **Bybit**: Funding payments every 8 hours (3x daily at 00:00, 08:00, 16:00 UTC)
- **Hyperliquid**: Funding payments every hour (24x daily)
- **Annualized Calculation**: Must account for different payment frequencies

#### 4. Testnet Configuration
- **Bybit Testnet**: Works with standard CCXT testnet option
- **Hyperliquid Testnet**: Requires manual URL override to `hyperliquid-testnet.xyz`

### Implementation Solutions

#### 1. Exchange-Specific Symbols
Created separate environment variables for each exchange:
```env
BYBIT_SYMBOLS=BTC/USDT:USDT,ETH/USDT:USDT,SOL/USDT:USDT
HYPERLIQUID_SYMBOLS=BTC/USDC:USDC,ETH/USDC:USDC,SOL/USDC:USDC
```

#### 2. Smart Comparison Logic
- Compare by base asset (BTC, ETH, SOL) rather than full symbol
- Automatically finds matching pairs across exchanges
- Calculates spread in annualized percentage points

#### 3. Flexible CLI Interface
- `--symbol BTC` filters by base asset across all exchanges
- `--symbol BTC/USDT:USDT` filters by exact symbol
- `--compare` mode maps between different quote currencies

### Testnet Observations

#### Bybit Testnet
- Returns test funding rates (±0.5%) for demonstration
- All major perpetual pairs available
- Stable and reliable API

#### Hyperliquid Testnet
- Returns realistic funding rates
- Limited to USDC-settled contracts
- Requires proper authentication even for public endpoints

### Technical Notes

1. **CCXT Type Definitions**: No official TypeScript types available; used `any` type for exchange instances
2. **Error Handling**: Each exchange can fail independently; system continues with available data
3. **Rate Limiting**: Built into CCXT with `enableRateLimit: true`

### Future Considerations

1. **Mainnet Migration**: Change testnet flags and remove test URLs
2. **More Exchanges**: Architecture supports easy addition of new exchanges
3. **WebSocket Support**: For real-time funding rate updates
4. **Historical Data**: Store funding rates over time for analysis