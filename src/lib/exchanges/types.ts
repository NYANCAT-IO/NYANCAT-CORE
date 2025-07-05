export interface MarketInfo {
  symbol: string;
  type: 'spot' | 'swap';
  active: boolean;
  quote: string;
  base: string;
  settle?: string;
  volume24h?: number;
  volumeUSD24h?: number;
}

export interface ValidatedPair {
  symbol: string;           // "BTC/USDT:USDT"
  spotSymbol: string;       // "BTC/USDT"
  perpSymbol: string;       // "BTC/USDT:USDT"
  base: string;             // "BTC"
  quote: string;            // "USDT"
  spotVolume24h: number;    // in USD
  perpVolume24h: number;    // in USD
  hasLiquidSpot: boolean;   // volume > threshold
  hasLiquidPerp: boolean;   // volume > threshold
  isValid: boolean;         // both markets exist and liquid
  discoveredAt: Date;
}

export interface DiscoveryResult {
  totalPerpetuals: number;
  totalSpots: number;
  validPairs: ValidatedPair[];
  invalidPerpetuals: string[]; // perps without spot
  lowLiquidityPairs: string[]; // exists but low volume
  timestamp: Date;
}