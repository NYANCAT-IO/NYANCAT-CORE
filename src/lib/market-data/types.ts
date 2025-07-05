export interface MarketData {
  timestamp: string;
  exchange: 'bybit';
  markets: any[];  // CCXT market objects
  tickers: any[];  // CCXT ticker objects
}

export interface MarketSummary {
  timestamp: string;
  totalMarkets: number;
  marketBreakdown: {
    spot: number;
    perpetual: number;
    futures: number;
    linearPerpetuals: number;
    inversePerpetuals: number;
  };
  settlementCurrencies: {
    [currency: string]: number;
  };
  fundingRateStats: {
    count: number;
    positive: number;
    negative: number;
    averageAPR: number;
    topPositive: Array<{symbol: string; annualizedAPR: number}>;
    topNegative: Array<{symbol: string; annualizedAPR: number}>;
  };
  tickerCounts?: {
    total: number;
    spot: number;
    perpetual: number;
  };
}

export interface FetchOptions {
  includeInactive?: boolean;
  debug?: boolean;
}