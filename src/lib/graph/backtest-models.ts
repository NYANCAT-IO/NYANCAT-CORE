/**
 * Type definitions for ROFL backtest data structures
 * Matches the actual JSON output from our backtest CLI
 */

export interface BacktestSummary {
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnDollars: number;
  numberOfTrades: number;
  winningTrades: number;
  winRate: number;
  maxDrawdown: number;
  totalDays: number;
}

export interface EquityPoint {
  timestamp: number;
  value: number;
}

export interface FundingMomentum {
  symbol: string;
  trend: string;
  strength: number;
  lastRates: number[];
  avgDecline: number;
}

export interface Volatility {
  symbol: string;
  currentVol: number;
  avgVol: number;
  volPercentile: number;
  isLowVol: boolean;
}

export interface TradingSignals {
  fundingMomentum: FundingMomentum;
  volatility: Volatility;
  riskScore: number;
  entryRecommendation: string;
  exitRecommendation: string;
}

export interface Position {
  symbol: string;
  entryTime: number;
  exitTime: number;
  entrySpotPrice: number;
  entryPerpPrice: number;
  exitSpotPrice: number;
  exitPerpPrice: number;
  quantity: number;
  fundingPayments: number[];
  totalPnL: number;
  entryFundingRate: number;
  entryFundingAPR: number;
  concurrentPositions: number;
  exitFundingRate: number;
  exitFundingAPR: number;
  exitReason: string;
  holdingPeriodHours: number;
  fundingPeriodsHeld: number;
  spotPnL: number;
  perpPnL: number;
  totalFunding: number;
  entryFees: number;
  exitFees: number;
  entrySignals: TradingSignals;
  exitSignals: TradingSignals;
}

export interface BacktestData {
  summary: BacktestSummary;
  equityCurve: EquityPoint[];
  positions: Position[];
}

export interface BacktestMetadata {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  version: string;
  strategy: string;
  parameters?: Record<string, unknown>;
  fileName?: string;
  filePath?: string;
}

/**
 * Create metadata for backtest upload
 */
export function createBacktestMetadata(
  backtestData: BacktestData,
  name?: string,
  strategy?: string,
  version: string = '1.0.0',
  fileName?: string
): BacktestMetadata {
  const timestamp = new Date();
  const defaultName = `ROFL Backtest ${timestamp.toISOString().split('T')[0]}`;
  const defaultStrategy = 'Delta-Neutral Funding Arbitrage';
  
  // Create description with key metrics
  const description = [
    `ML-optimized backtest results from ROFL TEE environment.`,
    `Return: ${backtestData.summary.totalReturn.toFixed(2)}%`,
    `Win Rate: ${backtestData.summary.winRate.toFixed(1)}%`,
    `Trades: ${backtestData.summary.numberOfTrades}`,
    `Days: ${backtestData.summary.totalDays}`
  ].join(' ');

  return {
    id: `rofl-backtest-${Date.now()}`,
    name: name || defaultName,
    description,
    createdAt: timestamp,
    version,
    strategy: strategy || defaultStrategy,
    parameters: {
      initialCapital: backtestData.summary.initialCapital,
      totalDays: backtestData.summary.totalDays,
      numberOfTrades: backtestData.summary.numberOfTrades,
    },
    fileName,
  };
}