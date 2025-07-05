export interface MarketPrice {
  symbol: string;
  price: number;
  timestamp: number;
  bid?: number;
  ask?: number;
  volume24h?: number;
}

export interface PerpetualData extends MarketPrice {
  fundingRate: number;
  nextFundingTime?: number;
  markPrice?: number;
  indexPrice?: number;
}

export interface DeltaNeutralPair {
  base: string;  // e.g., "BTC"
  spot: MarketPrice;
  perpetual: PerpetualData;
  basis: number;  // (perp - spot) / spot * 100
  basisDollar: number;  // perp - spot
  fundingAPR: number;  // Annualized funding rate
  netAPR: number;  // Net return after basis decay
}

export enum StrategyType {
  LONG_SPOT_SHORT_PERP = 'long-spot-short-perp',
  SHORT_SPOT_LONG_PERP = 'short-spot-long-perp',
  CROSS_SETTLEMENT = 'cross-settlement',
  INVERSE_ARBITRAGE = 'inverse-arbitrage'
}

export interface StrategyConfig {
  type: StrategyType;
  minAPR?: number;  // Minimum acceptable APR
  minVolume?: number;  // Minimum 24h volume
  maxBasis?: number;  // Maximum acceptable basis %
  includeFees?: boolean;  // Include fee calculations
  leverage?: number;  // Leverage for perpetual position
}

export interface PositionSize {
  spotQuantity: number;
  perpQuantity: number;
  spotValue: number;
  perpMargin: number;
  totalCapital: number;
  leverage: number;
  notionalValue: number;  // Total position value
  spotMargin?: number;    // For short spot positions
}

export interface StrategyResult {
  pair: DeltaNeutralPair;
  strategy: StrategyType;
  positionSize: PositionSize;
  expectedReturn: {
    daily: number;
    monthly: number;
    annual: number;
  };
  returnOnCapital: number;  // Leveraged ROC percentage
  unleveragedROC: number;   // ROC without leverage
  riskAdjustedROC: number;  // ROC adjusted for leverage risk
  borrowingCostAPR?: number; // Annual borrowing cost %
  maxLoss?: number;         // Maximum potential loss
  liquidationPrice?: {      // Liquidation levels
    spot?: number;
    perp?: number;
  };
  risks: string[];
  notes: string[];
}

export interface MarketDataFile {
  timestamp: string;
  count: number;
  markets?: any[];
  tickers?: any[];
  summary?: any;
}

export interface FeeStructure {
  spotMaker: number;
  spotTaker: number;
  perpMaker: number;
  perpTaker: number;
}

export interface AnalysisOptions {
  dataPath?: string;
  strategy?: StrategyType;
  minAPR?: number;
  baseAsset?: string;
  outputFormat?: 'json' | 'table' | 'csv';
  includeFees?: boolean;
  leverage?: number;
}

export interface MarketSummaryStats {
  totalPairs: number;
  positiveFunding: number;
  negativeFunding: number;
  averageBasis: number;
  averageFundingAPR: number;
  profitableOpportunities: number;
}