import { 
  FundingRate, 
  ComparisonResult, 
  ExchangeConfig, 
  IExchangeAdapter,
  FundingError 
} from './types.js';
import { BybitAdapter } from './exchanges/bybit.js';
import { HyperliquidAdapter } from './exchanges/hyperliquid.js';

interface ExchangeAdapterWithSymbols {
  adapter: IExchangeAdapter;
  symbols: string[];
}

/**
 * Main service for fetching and comparing funding rates
 */
export class FundingService {
  private exchanges: Map<string, ExchangeAdapterWithSymbols>;

  constructor(config: ExchangeConfig) {
    this.exchanges = new Map();

    // Initialize exchange adapters with their specific symbols
    this.exchanges.set('bybit', {
      adapter: new BybitAdapter(
        config.bybit.apiKey,
        config.bybit.apiSecret,
        config.bybit.testnet
      ),
      symbols: config.bybit.symbols
    });

    this.exchanges.set('hyperliquid', {
      adapter: new HyperliquidAdapter(
        config.hyperliquid.apiKey,
        config.hyperliquid.apiSecret,
        config.hyperliquid.testnet
      ),
      symbols: config.hyperliquid.symbols
    });
  }

  /**
   * Initialize connections to all exchanges
   */
  async connect(): Promise<void> {
    const connectPromises = Array.from(this.exchanges.values()).map(({ adapter }) =>
      adapter.connect()
    );

    const results = await Promise.allSettled(connectPromises);
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length === this.exchanges.size) {
      throw new FundingError('Failed to connect to all exchanges');
    }
  }

  /**
   * Fetch funding rates from all exchanges for their configured symbols
   */
  async fetchRates(): Promise<FundingRate[]> {
    const allRates: FundingRate[] = [];

    for (const [name, { adapter, symbols }] of this.exchanges) {
      try {
        const rates = await adapter.fetchFundingRates(symbols);
        allRates.push(...rates);
      } catch (error) {
        console.error(`Error fetching rates from ${name}:`, error);
        // Continue with other exchanges even if one fails
      }
    }

    return allRates;
  }

  /**
   * Fetch funding rates for a specific symbol from all exchanges
   * Note: Symbol must exist in the exchange's configured symbols
   */
  async fetchRatesForSymbol(symbol: string): Promise<FundingRate[]> {
    const rates: FundingRate[] = [];

    for (const [name, { adapter, symbols }] of this.exchanges) {
      // Only fetch if this symbol is configured for this exchange
      if (symbols.includes(symbol)) {
        try {
          const rate = await adapter.fetchFundingRate(symbol);
          rates.push(rate);
        } catch (error) {
          console.error(`Error fetching ${symbol} from ${name}:`, error);
          // Continue with other exchanges
        }
      }
    }

    return rates;
  }

  /**
   * Compare funding rates between exchanges for equivalent trading pairs
   * Maps between different quote currencies (USDT vs USDC)
   */
  async compareRates(baseAsset: string): Promise<ComparisonResult> {
    // Find symbols for each exchange that match the base asset
    const bybitSymbol = this.exchanges.get('bybit')?.symbols.find(s => s.startsWith(baseAsset + '/'));
    const hyperliquidSymbol = this.exchanges.get('hyperliquid')?.symbols.find(s => s.startsWith(baseAsset + '/'));

    let bybitRate: FundingRate | null = null;
    let hyperliquidRate: FundingRate | null = null;

    if (bybitSymbol) {
      try {
        bybitRate = await this.exchanges.get('bybit')!.adapter.fetchFundingRate(bybitSymbol);
      } catch (error) {
        console.error(`Error fetching ${bybitSymbol} from Bybit:`, error);
      }
    }

    if (hyperliquidSymbol) {
      try {
        hyperliquidRate = await this.exchanges.get('hyperliquid')!.adapter.fetchFundingRate(hyperliquidSymbol);
      } catch (error) {
        console.error(`Error fetching ${hyperliquidSymbol} from Hyperliquid:`, error);
      }
    }

    let spread = 0;
    let favorableExchange: 'bybit' | 'hyperliquid' | 'none' = 'none';

    if (bybitRate && hyperliquidRate) {
      // Calculate spread in percentage points
      spread = Math.abs(bybitRate.annualizedRate - hyperliquidRate.annualizedRate);
      
      // For long positions, lower funding rate is better
      if (bybitRate.rate < hyperliquidRate.rate) {
        favorableExchange = 'bybit';
      } else if (hyperliquidRate.rate < bybitRate.rate) {
        favorableExchange = 'hyperliquid';
      }
    }

    // Use the base asset as the symbol for comparison
    return {
      symbol: baseAsset,
      bybit: bybitRate,
      hyperliquid: hyperliquidRate,
      spread,
      favorableExchange,
    };
  }

  /**
   * Compare funding rates for all configured base assets
   */
  async compareAllRates(): Promise<ComparisonResult[]> {
    // Extract unique base assets from all configured symbols
    const baseAssets = new Set<string>();
    
    for (const { symbols } of this.exchanges.values()) {
      for (const symbol of symbols) {
        const base = symbol.split('/')[0];
        if (base) {
          baseAssets.add(base);
        }
      }
    }

    const comparisons: ComparisonResult[] = [];

    for (const baseAsset of baseAssets) {
      try {
        const comparison = await this.compareRates(baseAsset);
        comparisons.push(comparison);
      } catch (error) {
        console.error(`Error comparing rates for ${baseAsset}:`, error);
      }
    }

    return comparisons;
  }

  /**
   * Get all configured symbols grouped by exchange
   */
  getConfiguredSymbols(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    
    for (const [exchange, { symbols }] of this.exchanges) {
      result[exchange] = symbols;
    }
    
    return result;
  }

  /**
   * Disconnect from all exchanges
   */
  async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.exchanges.values()).map(({ adapter }) =>
      adapter.disconnect()
    );

    await Promise.allSettled(disconnectPromises);
  }
}