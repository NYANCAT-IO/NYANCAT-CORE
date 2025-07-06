import ccxt from 'ccxt';
import { HistoricalData, HistoricalFundingRate, HistoricalOHLCV, FetchOptions } from './types.js';
import { DataStorage } from './data-storage.js';

export class HistoricalDataFetcher {
  private exchange: any; // CCXT doesn't have proper TypeScript types
  private storage: DataStorage;
  private maxRetries = 3;
  private retryDelay = 1000; // ms
  private validPairs: Set<string> | null = null;

  constructor(dataPath?: string) {
    this.exchange = new ccxt.bybit({
      enableRateLimit: true,
      rateLimit: 50, // 20 requests per second max
      options: {
        defaultType: 'future', // for perpetuals
      },
    });
    // Use environment variable or provided path, fallback to default
    const basePath = dataPath || process.env.DATA_DIR || 'data/historical';
    this.storage = new DataStorage(basePath);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        console.warn(`${operationName} attempt ${attempt} failed:`, error);
        
        if (attempt < this.maxRetries) {
          await this.sleep(this.retryDelay * attempt);
        }
      }
    }
    
    throw lastError;
  }

  async fetchFundingRateHistory(
    symbol: string,
    startTime: number,
    endTime: number
  ): Promise<HistoricalFundingRate[]> {
    const allRates: HistoricalFundingRate[] = [];
    let currentTime = startTime;
    
    console.log(`Fetching funding rates for ${symbol} from ${new Date(startTime)} to ${new Date(endTime)}`);
    
    while (currentTime < endTime) {
      const rates = await this.retryOperation(
        async () => {
          // CCXT's fetchFundingRateHistory returns funding rates
          const response = await this.exchange.fetchFundingRateHistory(
            symbol,
            currentTime,
            200, // limit per request
            {
              until: endTime,
            }
          );
          
          return response as any[];
        },
        `fetchFundingRateHistory for ${symbol}`
      );
      
      if (!rates || rates.length === 0) {
        break;
      }
      
      // Convert to our format
      const formatted = rates.map((rate: any) => ({
        timestamp: rate.timestamp,
        symbol: rate.symbol,
        rate: rate.fundingRate,
        fundingTime: rate.datetime ? new Date(rate.datetime).getTime() : rate.timestamp,
      }));
      
      allRates.push(...formatted);
      
      // Update currentTime to the last timestamp
      const lastTimestamp = rates[rates.length - 1].timestamp;
      if (lastTimestamp >= currentTime) {
        currentTime = lastTimestamp + 1;
      } else {
        break; // No more data
      }
      
      // Add small delay to respect rate limits
      await this.sleep(100);
    }
    
    console.log(`Fetched ${allRates.length} funding rates for ${symbol}`);
    return allRates;
  }

  async fetchOHLCV(
    symbol: string,
    timeframe: string,
    startTime: number,
    endTime: number
  ): Promise<HistoricalOHLCV[]> {
    const allCandles: HistoricalOHLCV[] = [];
    let currentTime = startTime;
    
    console.log(`Fetching ${timeframe} OHLCV for ${symbol} from ${new Date(startTime)} to ${new Date(endTime)}`);
    
    while (currentTime < endTime) {
      const candles = await this.retryOperation(
        async () => {
          return await this.exchange.fetchOHLCV(
            symbol,
            timeframe,
            currentTime,
            1000, // limit per request
            {
              until: endTime,
            }
          );
        },
        `fetchOHLCV for ${symbol}`
      );
      
      if (!candles || candles.length === 0) {
        break;
      }
      
      // Convert to our format
      const formatted = candles.map((candle: number[]) => ({
        timestamp: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
      }));
      
      allCandles.push(...formatted);
      
      // Update currentTime to the last timestamp
      const lastTimestamp = candles[candles.length - 1][0];
      if (lastTimestamp > currentTime) {
        currentTime = lastTimestamp + 1;
      } else {
        break; // No more data
      }
      
      // Add small delay to respect rate limits
      await this.sleep(100);
    }
    
    console.log(`Fetched ${allCandles.length} ${timeframe} candles for ${symbol}`);
    return allCandles;
  }

  private async fetchSymbolData(
    symbol: string,
    startTime: number,
    endTime: number
  ): Promise<{
    fundingRates: HistoricalFundingRate[];
    spotPrices: HistoricalOHLCV[];
    perpPrices: HistoricalOHLCV[];
  }> {
    // Check if this is a valid pair
    if (this.validPairs && this.validPairs.size > 0 && !this.validPairs.has(symbol)) {
      console.log(`⏭️ Skipping ${symbol} - not a valid delta-neutral pair`);
      throw new Error(`${symbol} is not a valid delta-neutral pair`);
    }
    
    // Extract base symbol for spot market
    const baseSymbol = symbol.replace(':USDT', ''); // e.g., "BTC/USDT:USDT" -> "BTC/USDT"
    
    console.log(`\nFetching data for ${symbol}...`);
    
    // Fetch funding rates (only for perpetuals)
    const fundingRates = await this.fetchFundingRateHistory(symbol, startTime, endTime);
    
    // Fetch perpetual prices (1h candles for efficiency)
    const perpPrices = await this.fetchOHLCV(symbol, '1h', startTime, endTime);
    
    // Fetch spot prices
    let spotPrices: HistoricalOHLCV[] = [];
    try {
      // Switch to spot market
      this.exchange.options.defaultType = 'spot';
      spotPrices = await this.fetchOHLCV(baseSymbol, '1h', startTime, endTime);
    } catch (error) {
      console.warn(`Failed to fetch spot prices for ${baseSymbol}:`, error);
      // Don't use fallback if we're using valid pairs
      if (this.validPairs && this.validPairs.size > 0) {
        throw error;
      }
      // Use perpetual prices as fallback only if not using valid pairs
      spotPrices = perpPrices.map(p => ({ ...p }));
    } finally {
      // Switch back to futures
      this.exchange.options.defaultType = 'future';
    }
    
    return { fundingRates, spotPrices, perpPrices };
  }

  async fetchHistoricalData(options: FetchOptions): Promise<HistoricalData> {
    const { startTime, endTime, symbols, useCache = true } = options;
    
    // Check cache first
    if (useCache) {
      const cached = await this.storage.loadHistoricalData(startTime, endTime);
      if (cached) {
        console.log('Using cached historical data');
        return cached;
      }
    }
    
    // Load markets to get available symbols
    await this.exchange.loadMarkets();
    
    // Get symbols to fetch
    let symbolsToFetch: string[];
    
    if (symbols && symbols.length > 0) {
      symbolsToFetch = symbols;
    } else {
      // Get top perpetual markets by volume
      const markets = Object.values(this.exchange.markets)
        .filter((m: any) => m.type === 'swap' && m.quote === 'USDT' && m.active)
        .sort((a: any, b: any) => (b.info?.volume24h || 0) - (a.info?.volume24h || 0))
        .slice(0, 20); // Top 20 markets
      
      symbolsToFetch = markets.map((m: any) => m.symbol);
    }
    
    console.log(`Fetching historical data for ${symbolsToFetch.length} symbols`);
    console.log('Symbols:', symbolsToFetch.join(', '));
    
    // Initialize data structure
    const historicalData: HistoricalData = {
      fundingRates: new Map(),
      spotPrices: new Map(),
      perpPrices: new Map(),
      metadata: {
        startTime,
        endTime,
        symbols: symbolsToFetch,
        fetchedAt: Date.now(),
      },
    };
    
    // Fetch data for each symbol
    for (const symbol of symbolsToFetch) {
      try {
        const data = await this.fetchSymbolData(symbol, startTime, endTime);
        
        historicalData.fundingRates.set(symbol, data.fundingRates);
        historicalData.spotPrices.set(symbol, data.spotPrices);
        historicalData.perpPrices.set(symbol, data.perpPrices);
        
        // Small delay between symbols
        await this.sleep(500);
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error);
      }
    }
    
    // Save to cache
    if (useCache) {
      await this.storage.saveHistoricalData(historicalData);
    }
    
    console.log('\nHistorical data fetch complete!');
    console.log(`Total funding rates: ${Array.from(historicalData.fundingRates.values()).reduce((sum, rates) => sum + rates.length, 0)}`);
    console.log(`Total spot candles: ${Array.from(historicalData.spotPrices.values()).reduce((sum, prices) => sum + prices.length, 0)}`);
    console.log(`Total perp candles: ${Array.from(historicalData.perpPrices.values()).reduce((sum, prices) => sum + prices.length, 0)}`);
    
    return historicalData;
  }

  async fetchDays(days: number, symbols?: string[]): Promise<HistoricalData> {
    const endTime = Date.now();
    const startTime = endTime - (days * 24 * 60 * 60 * 1000);
    
    return this.fetchHistoricalData({
      startTime,
      endTime,
      symbols,
      useCache: true,
    });
  }

  async listAvailableCache(): Promise<void> {
    const caches = await this.storage.listCachedRanges();
    
    if (caches.length === 0) {
      console.log('No cached data available');
      return;
    }
    
    console.log('\nAvailable cached data:');
    for (const cache of caches) {
      const start = new Date(cache.dataRange.start).toISOString().split('T')[0];
      const end = new Date(cache.dataRange.end).toISOString().split('T')[0];
      console.log(`- ${start} to ${end}: ${cache.symbols.length} symbols, ${cache.recordCount.fundingRates} funding rates`);
    }
  }

  async loadValidPairs(): Promise<Set<string>> {
    if (this.validPairs) return this.validPairs;
    
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const validPairsPath = path.join(process.cwd(), 'data', 'valid-pairs.json');
      
      const data = await fs.readFile(validPairsPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.validPairs = new Set(parsed.pairs);
      
      console.log(`✅ Loaded ${this.validPairs.size} valid pairs`);
      return this.validPairs;
    } catch (error) {
      console.warn('⚠️ No valid pairs file found, using all pairs');
      return new Set();
    }
  }

  async fetchValidPairsOnly(options: Omit<FetchOptions, 'symbols'>): Promise<HistoricalData> {
    // Use TOP_30_VALID_PAIRS from config
    const { TOP_30_VALID_PAIRS } = await import('../../config/valid-pairs.js');
    
    console.log(`📊 Fetching data for ${TOP_30_VALID_PAIRS.length} valid delta-neutral pairs`);
    
    return this.fetchHistoricalData({
      ...options,
      symbols: TOP_30_VALID_PAIRS
    });
  }
}