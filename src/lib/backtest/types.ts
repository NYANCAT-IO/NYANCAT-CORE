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

// Extended position with detailed information for comprehensive reports
export interface DetailedPosition extends Position {
  // Entry context
  entryFundingRate: number;
  entryFundingAPR: number;
  concurrentPositions: number;
  
  // Exit context
  exitFundingRate: number;
  exitFundingAPR: number;
  exitReason: string;
  
  // Time metrics
  holdingPeriodHours: number;
  fundingPeriodsHeld: number;
  
  // P&L breakdown
  spotPnL: number;
  perpPnL: number;
  totalFunding: number;
  entryFees: number;
  exitFees: number;
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

// Extended result for comprehensive reports
export interface ComprehensiveBacktestResult extends BacktestResult {
  detailedPositions: DetailedPosition[];
  monthlyStats: MonthlyStats[];
  symbolStats: Map<string, SymbolStats>;
}

export interface MonthlyStats {
  month: string; // "2024-01"
  trades: number;
  profit: number;
  return: number; // percentage
  winRate: number;
}

export interface SymbolStats {
  symbol: string;
  trades: number;
  totalPnL: number;
  avgPnL: number;
  winRate: number;
  avgFundingAPR: number;
  avgHoldingHours: number;
  totalFunding: number;
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
  // Additional context for comprehensive reporting
  entryFundingRate: number;
  entryFundingAPR: number;
  concurrentPositions: number;
  fundingPeriodsHeld: number;
}