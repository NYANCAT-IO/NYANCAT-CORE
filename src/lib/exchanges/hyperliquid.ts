import ccxt from 'ccxt';
import { FundingRate, IExchangeAdapter, FundingError } from '../types.js';

export class HyperliquidAdapter implements IExchangeAdapter {
  readonly name = 'hyperliquid' as const;
  private exchange: ccxt.hyperliquid;

  constructor(apiKey: string, apiSecret: string, testnet: boolean = true) {
    this.exchange = new ccxt.hyperliquid({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
      options: {
        defaultType: 'swap', // Use perpetual futures
      },
    });

    if (testnet) {
      // Set testnet URLs for Hyperliquid
      this.exchange.urls.api = {
        public: 'https://api.hyperliquid-testnet.xyz/info',
        private: 'https://api.hyperliquid-testnet.xyz/exchange',
      };
    }
  }

  async connect(): Promise<void> {
    try {
      await this.exchange.loadMarkets();
    } catch (error) {
      throw new FundingError(
        `Failed to connect to Hyperliquid: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'hyperliquid',
        undefined,
        error instanceof Error ? error : undefined
      );
    }
  }

  async fetchFundingRate(symbol: string): Promise<FundingRate> {
    try {
      // Fetch current funding rate
      const fundingRate = await this.exchange.fetchFundingRate(symbol);
      
      if (!fundingRate) {
        throw new FundingError(`No funding rate data for ${symbol}`, 'hyperliquid', symbol);
      }

      // Calculate annualized rate
      // Hyperliquid funding is paid every hour (24 times per day)
      const paymentsPerYear = 24 * 365;
      const annualizedRate = fundingRate.fundingRate * paymentsPerYear * 100;

      return {
        exchange: 'hyperliquid',
        symbol: fundingRate.symbol,
        rate: fundingRate.fundingRate,
        timestamp: fundingRate.timestamp,
        nextFundingTime: fundingRate.fundingDatetime 
          ? new Date(fundingRate.fundingDatetime).getTime() 
          : Date.now() + 60 * 60 * 1000, // Default to 1 hour from now
        interval: '1h',
        annualizedRate,
      };
    } catch (error) {
      if (error instanceof FundingError) throw error;
      
      throw new FundingError(
        `Failed to fetch funding rate for ${symbol}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'hyperliquid',
        symbol,
        error instanceof Error ? error : undefined
      );
    }
  }

  async fetchFundingRates(symbols: string[]): Promise<FundingRate[]> {
    const results: FundingRate[] = [];
    const errors: Error[] = [];

    // Fetch rates in parallel with some concurrency limit
    const batchSize = 5;
    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const batchPromises = batch.map(symbol => 
        this.fetchFundingRate(symbol).catch(error => {
          errors.push(error);
          return null;
        })
      );

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter((r): r is FundingRate => r !== null));
    }

    if (errors.length > 0 && results.length === 0) {
      throw new FundingError(
        `Failed to fetch any funding rates. First error: ${errors[0]?.message}`,
        'hyperliquid'
      );
    }

    return results;
  }

  async disconnect(): Promise<void> {
    // CCXT doesn't require explicit disconnect
    // This method is here for interface compliance
  }
}