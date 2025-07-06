/**
 * Piscina Worker for ML Parameter Optimization
 * 
 * This worker runs a single parameter combination test in isolation,
 * allowing for parallel processing of backtest optimization.
 */

import { OptimizedBacktestEngine, OptimizedBacktestConfig, OptimizedBacktestResult } from '../lib/backtest/optimized-engine.js';

export interface OptimizationParams {
  riskThreshold: number;
  minAPR: number;
  volatilityFilter: boolean;
  momentumFilter: boolean;
}

export interface OptimizationResult {
  params: OptimizationParams;
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
  };
  score: number;
}

export interface WorkerTask {
  config: OptimizedBacktestConfig;
  params: OptimizationParams;
  workerIndex?: number; // For debugging/logging
}

/**
 * Calculate optimization score combining multiple metrics
 * (Identical to main thread implementation for consistency)
 */
function calculateOptimizationScore(result: OptimizedBacktestResult): number {
  const returnWeight = 0.4;
  const sharpeWeight = 0.3;
  const drawdownWeight = 0.2;
  const stabilityWeight = 0.1;

  const totalReturn = result.summary.totalReturn;
  const sharpeRatio = result.signalAccuracy.accuracy > 0 ? totalReturn / Math.max(1, result.summary.maxDrawdown) : 0;
  const maxDrawdown = result.summary.maxDrawdown;
  const trades = result.summary.numberOfTrades;

  const normalizedReturn = Math.max(0, totalReturn / 50); // Normalize to 50% max return
  const normalizedSharpe = Math.max(0, Math.min(1, sharpeRatio / 3)); // Cap at 3
  const drawdownPenalty = Math.max(0, 1 - maxDrawdown / 20); // Penalize >20% drawdown
  const stabilityBonus = trades > 10 ? 1 : trades / 10; // Prefer strategies with more trades

  return (
    normalizedReturn * returnWeight +
    normalizedSharpe * sharpeWeight +
    drawdownPenalty * drawdownWeight +
    stabilityBonus * stabilityWeight
  );
}

/**
 * Worker function that processes a single parameter combination
 */
export default async function optimizeBacktestWorker(task: WorkerTask): Promise<OptimizationResult> {
  const { config, params, workerIndex } = task;
  
  // Create isolated backtest engine for this worker
  const engine = new OptimizedBacktestEngine();
  
  try {
    // Configure backtest with current parameters
    const testConfig: OptimizedBacktestConfig = {
      ...config,
      useML: true,
      riskThreshold: params.riskThreshold,
      minAPR: params.minAPR,
      volatilityFilter: params.volatilityFilter,
      momentumFilter: params.momentumFilter
    };

    // Run backtest in worker thread
    const result = await engine.runOptimizedBacktest(testConfig);
    
    // Calculate score using same logic as main thread
    const score = calculateOptimizationScore(result);

    // Return complete optimization result
    return {
      params,
      performance: {
        totalReturn: result.summary.totalReturn,
        sharpeRatio: result.signalAccuracy.accuracy,
        maxDrawdown: result.summary.maxDrawdown,
        winRate: result.summary.winRate,
        trades: result.summary.numberOfTrades
      },
      score
    };

  } catch (error) {
    // Enhanced error reporting with worker context
    const errorMessage = error instanceof Error ? error.message : String(error);
    const workerInfo = workerIndex !== undefined ? ` (Worker ${workerIndex})` : '';
    
    throw new Error(`Backtest failed${workerInfo}: ${errorMessage}`);
  }
}