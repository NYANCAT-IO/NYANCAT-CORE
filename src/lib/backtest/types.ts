// Simplified types for hackathon MVP

export interface BacktestConfig {
  startDate?: Date;       // Default: 30 days ago
  endDate?: Date;         // Default: today
  initialCapital: number; // Default: 10000
  minAPR: number;         // Default: 8%
}

export interface Position {
  symbol: string;
  entryTime: number;      // Unix timestamp
  exitTime: number;       // Unix timestamp
  entrySpotPrice: number;
  entryPerpPrice: number;
  exitSpotPrice: number;
  exitPerpPrice: number;
  quantity: number;       // Base asset quantity
  fundingPayments: number[]; // Array of payments received
  totalPnL: number;       // Final P&L including all costs
}

export interface BacktestSummary {
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;         // Percentage
  totalReturnDollars: number;
  numberOfTrades: number;
  winningTrades: number;
  winRate: number;             // Percentage  
  maxDrawdown: number;         // Percentage
  totalDays: number;
}

export interface EquityPoint {
  timestamp: number;
  value: number;
}

export interface BacktestResult {
  summary: BacktestSummary;
  equityCurve: EquityPoint[];
  positions: Position[];
  config: BacktestConfig;
}

// Helper types for internal use
export interface FundingSnapshot {
  timestamp: number;
  rates: Map<string, number>;  // symbol -> funding rate
}

export interface PriceSnapshot {
  timestamp: number;
  spotPrices: Map<string, number>;
  perpPrices: Map<string, number>;
}

export interface OpenPosition {
  symbol: string;
  entryTime: number;
  entrySpotPrice: number;
  entryPerpPrice: number;
  quantity: number;
  fundingPayments: number[];
}