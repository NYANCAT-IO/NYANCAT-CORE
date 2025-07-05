export interface HistoricalFundingRate {
  timestamp: number;        // Unix timestamp in ms
  symbol: string;          // e.g., "BTC/USDT:USDT"
  rate: number;            // e.g., 0.0001 (0.01%)
  fundingTime: number;     // Next funding time
}

export interface HistoricalOHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface HistoricalData {
  fundingRates: Map<string, HistoricalFundingRate[]>;
  spotPrices: Map<string, HistoricalOHLCV[]>;
  perpPrices: Map<string, HistoricalOHLCV[]>;
  metadata: {
    startTime: number;
    endTime: number;
    symbols: string[];
    fetchedAt: number;
  };
}

export interface FetchOptions {
  startTime: number;
  endTime: number;
  symbols?: string[];
  useCache?: boolean;
  cacheOnly?: boolean;
}

export interface CacheMetadata {
  version: string;
  createdAt: number;
  dataRange: {
    start: number;
    end: number;
  };
  symbols: string[];
  recordCount: {
    fundingRates: number;
    spotPrices: number;
    perpPrices: number;
  };
}