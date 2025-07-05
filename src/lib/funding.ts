import { 
  FundingRate, 
  ComparisonResult, 
  ExchangeConfig, 
  IExchangeAdapter,
  FundingError 
} from './types.js';
import { BybitAdapter } from './exchanges/bybit.js';
import { HyperliquidAdapter } from './exchanges/hyperliquid.js';

/**
 * Main service for fetching and comparing funding rates
 */
export class FundingService {
  private adapters: Map<string, IExchangeAdapter>;
  private symbols: string[];

  constructor(config: ExchangeConfig, symbols: string[]) {
    this.symbols = symbols;
    this.adapters = new Map();

    // Initialize exchange adapters
    this.adapters.set(
      'bybit',
      new BybitAdapter(
        config.bybit.apiKey,
        config.bybit.apiSecret,
        config.bybit.testnet
      )
    );

    this.adapters.set(
      'hyperliquid',
      new HyperliquidAdapter(
        config.hyperliquid.apiKey,
        config.hyperliquid.apiSecret,
        config.hyperliquid.testnet
      )
    );
  }

  /**
   * Initialize connections to all exchanges
   */
  async connect(): Promise<void> {
    const connectPromises = Array.from(this.adapters.values()).map(adapter =>
      adapter.connect()
    );

    const results = await Promise.allSettled(connectPromises);
    const failures = results.filter(r => r.status === 'rejected');

    if (failures.length === this.adapters.size) {
      throw new FundingError('Failed to connect to all exchanges');
    }
  }

  /**
   * Fetch funding rates from all exchanges for all configured symbols
   */
  async fetchRates(): Promise<FundingRate[]> {
    const allRates: FundingRate[] = [];

    for (const [name, adapter] of this.adapters) {
      try {
        const rates = await adapter.fetchFundingRates(this.symbols);
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
   */
  async fetchRatesForSymbol(symbol: string): Promise<FundingRate[]> {
    const rates: FundingRate[] = [];

    for (const [name, adapter] of this.adapters) {
      try {
        const rate = await adapter.fetchFundingRate(symbol);
        rates.push(rate);
      } catch (error) {
        console.error(`Error fetching ${symbol} from ${name}:`, error);
        // Continue with other exchanges
      }
    }

    return rates;
  }

  /**
   * Compare funding rates between exchanges for a specific symbol
   */
  async compareRates(symbol: string): Promise<ComparisonResult> {
    const rates = await this.fetchRatesForSymbol(symbol);
    
    const bybitRate = rates.find(r => r.exchange === 'bybit') || null;
    const hyperliquidRate = rates.find(r => r.exchange === 'hyperliquid') || null;

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

    return {
      symbol,
      bybit: bybitRate,
      hyperliquid: hyperliquidRate,
      spread,
      favorableExchange,
    };
  }

  /**
   * Compare funding rates for all configured symbols
   */
  async compareAllRates(): Promise<ComparisonResult[]> {
    const comparisons: ComparisonResult[] = [];

    for (const symbol of this.symbols) {
      try {
        const comparison = await this.compareRates(symbol);
        comparisons.push(comparison);
      } catch (error) {
        console.error(`Error comparing rates for ${symbol}:`, error);
      }
    }

    return comparisons;
  }

  /**
   * Disconnect from all exchanges
   */
  async disconnect(): Promise<void> {
    const disconnectPromises = Array.from(this.adapters.values()).map(adapter =>
      adapter.disconnect()
    );

    await Promise.allSettled(disconnectPromises);
  }
}