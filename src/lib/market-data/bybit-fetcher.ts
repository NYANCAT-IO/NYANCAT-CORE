import ccxt from 'ccxt';
import { MarketSummary, FetchOptions } from './types';

export class BybitDataFetcher {
  private exchange: any;
  
  constructor(_options: FetchOptions = {}) {
    // Get mainnet credentials from env
    const apiKey = process.env.BYBIT_MAINNET_API_KEY;
    const apiSecret = process.env.BYBIT_MAINNET_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('Missing BYBIT_MAINNET_API_KEY or BYBIT_MAINNET_API_SECRET');
    }
    
    this.exchange = new ccxt.bybit({
      apiKey,
      secret: apiSecret,
      enableRateLimit: true,
    });
  }

  async fetchAllMarkets(): Promise<any[]> {
    const markets = await this.exchange.fetchMarkets();
    return markets;
  }

  async fetchAllTickers(symbols?: string[]): Promise<any[]> {
    try {
      // Try to fetch all tickers at once
      if (symbols && symbols.length > 0) {
        const tickers = await this.exchange.fetchTickers(symbols);
        return Object.values(tickers);
      } else {
        // For Bybit, we need to fetch spot and derivatives separately
        const allTickers: any[] = [];
        
        // Save current type
        const originalType = this.exchange.options.defaultType;
        
        try {
          // Fetch spot tickers
          this.exchange.options.defaultType = 'spot';
          const spotTickers = await this.exchange.fetchTickers();
          allTickers.push(...Object.values(spotTickers));
        } catch (spotError: any) {
          console.log('Note: Could not fetch spot tickers:', spotError.message);
        }
        
        try {
          // Fetch derivative tickers
          this.exchange.options.defaultType = 'swap';
          const swapTickers = await this.exchange.fetchTickers();
          allTickers.push(...Object.values(swapTickers));
        } catch (swapError: any) {
          console.log('Note: Could not fetch swap tickers:', swapError.message);
        }
        
        // Restore original type
        this.exchange.options.defaultType = originalType;
        
        return allTickers;
      }
    } catch (error) {
      // Fallback to simple fetch if the above fails
      const tickers = await this.exchange.fetchTickers();
      return Object.values(tickers);
    }
  }

  private analyzeFundingRates(tickers: any[]): any {
    const perpetualTickers = tickers.filter(t => 
      t.info && t.info.fundingRate !== undefined
    );

    const fundingRates = perpetualTickers.map(ticker => {
      // Parse funding rate more carefully
      const rateStr = ticker.info.fundingRate;
      const rate = rateStr !== undefined && rateStr !== '' && rateStr !== null 
        ? parseFloat(rateStr) 
        : null;
      
      if (rate === null) {
        return null; // Skip tickers without valid funding rates
      }
      
      const paymentsPerDay = 3; // Bybit pays 3x daily
      const annualizedRate = rate * paymentsPerDay * 365 * 100;
      
      return {
        symbol: ticker.symbol,
        fundingRate: rate,
        fundingRatePercent: rate * 100, // Show as percentage
        annualizedAPR: annualizedRate,
        price: ticker.last,
        nextFundingTime: ticker.info.nextFundingTime
      };
    }).filter(item => item !== null);

    const sortedRates = [...fundingRates].sort((a, b) => b.annualizedAPR - a.annualizedAPR);
    
    const positiveRates = fundingRates.filter(r => r.fundingRate > 0);
    const negativeRates = fundingRates.filter(r => r.fundingRate < 0);
    
    const averageAPR = fundingRates.length > 0 
      ? fundingRates.reduce((sum, r) => sum + r.annualizedAPR, 0) / fundingRates.length
      : 0;
    
    return {
      count: fundingRates.length,
      positive: positiveRates.length,
      negative: negativeRates.length,
      averageAPR,
      topPositive: sortedRates.filter(r => r.fundingRate > 0).slice(0, 10),
      topNegative: sortedRates.filter(r => r.fundingRate < 0).slice(-10).reverse()
    };
  }

  generateSummary(markets: any[], tickers: any[]): MarketSummary {
    const activeMarkets = markets.filter(m => m.active);
    
    const spotMarkets = activeMarkets.filter(m => m.spot);
    const perpetualMarkets = activeMarkets.filter(m => m.swap);
    const futuresMarkets = activeMarkets.filter(m => m.future);
    const linearPerps = perpetualMarkets.filter(m => m.linear);
    const inversePerps = perpetualMarkets.filter(m => m.inverse);
    
    // Count tickers by type
    const spotTickers = tickers.filter(t => !t.symbol.includes(':'));
    const perpTickers = tickers.filter(t => t.symbol.includes(':'));
    
    const settlementCurrencies: {[key: string]: number} = {};
    perpetualMarkets.forEach(m => {
      const settle = m.settle || 'unknown';
      settlementCurrencies[settle] = (settlementCurrencies[settle] || 0) + 1;
    });
    
    const fundingRateStats = this.analyzeFundingRates(tickers);
    
    return {
      timestamp: new Date().toISOString(),
      totalMarkets: markets.length,
      marketBreakdown: {
        spot: spotMarkets.length,
        perpetual: perpetualMarkets.length,
        futures: futuresMarkets.length,
        linearPerpetuals: linearPerps.length,
        inversePerpetuals: inversePerps.length,
      },
      settlementCurrencies,
      fundingRateStats,
      tickerCounts: {
        total: tickers.length,
        spot: spotTickers.length,
        perpetual: perpTickers.length
      }
    };
  }
}