import { Backtest, Strategy } from '@fugle/backtest';
import { HistoricalData, DataStorage } from '../historical';
import { PredictiveOptimizer, MLFundingPredictor, PredictiveSignals, MLPrediction } from '../strategy';
import { OptimizedBacktestConfig, OptimizedBacktestResult } from './optimized-engine';

/**
 * Advanced Parameter Optimization using Fugle Backtest framework
 * Integrates our ML strategy with Fugle's optimization engine for automated parameter tuning
 */

export interface OptimizationParams {
  riskThreshold: number;          // 0.2 - 0.8
  minAPR: number;                 // 3 - 10
  volatilityFilter: boolean;      // true/false
  momentumFilter: boolean;        // true/false
  positionSizing: number;         // 0.1 - 0.3
  confidenceThreshold: number;    // 0.4 - 0.8
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
  score: number; // Combined optimization score
}

export class FugleMLOptimizer {
  private storage: DataStorage;
  private mlPredictor: MLFundingPredictor;
  private optimizer: PredictiveOptimizer;
  
  constructor() {
    this.storage = new DataStorage();
    this.mlPredictor = new MLFundingPredictor();
    this.optimizer = new PredictiveOptimizer();
  }

  /**
   * Create a Fugle-compatible strategy that uses our ML predictions
   */
  private createMLStrategy(params: OptimizationParams): Strategy {
    return {
      entryRule: async (enterPosition, args) => {
        try {
          const { bar, params: strategyParams } = args;
          
          // Get ML prediction for this data point
          const prediction = await this.generateMLPrediction(bar, params);
          
          if (!prediction) return;

          // Apply our filtering logic
          if (this.shouldEnterPosition(prediction, params)) {
            const positionSize = this.calculatePositionSize(prediction, params);
            enterPosition(positionSize);
          }
        } catch (error) {
          console.error('Entry rule error:', error);
        }
      },
      
      exitRule: async (exitPosition, args) => {
        try {
          const { bar, position } = args;
          
          // Check if we should exit based on ML signals or risk management
          if (this.shouldExitPosition(bar, position, params)) {
            exitPosition();
          }
        } catch (error) {
          console.error('Exit rule error:', error);
        }
      },
      
      stopLoss: (args) => {
        // Dynamic stop loss based on volatility and ML confidence
        const { position } = args;
        const baseStopLoss = 0.02; // 2% base stop loss
        const riskAdjustment = params.riskThreshold * 0.01;
        return -(baseStopLoss + riskAdjustment);
      }
    };
  }

  /**
   * Generate ML prediction for a given data point
   */
  private async generateMLPrediction(bar: any, params: OptimizationParams): Promise<MLPrediction | null> {
    try {
      // Convert bar data to our expected format
      const dataPoint = {
        timestamp: bar.timestamp || Date.now(),
        fundingRate: bar.fundingRate || 0,
        price: bar.close,
        volume: bar.volume || 0,
        symbol: bar.symbol || 'BTC/USDT'
      };

      // Generate ML prediction
      const prediction = await this.mlPredictor.predict(dataPoint);
      return prediction;
    } catch (error) {
      console.error('ML prediction error:', error);
      return null;
    }
  }

  /**
   * Determine if we should enter a position based on ML signals and filters
   */
  private shouldEnterPosition(prediction: MLPrediction, params: OptimizationParams): boolean {
    // Check ML risk threshold
    if (prediction.riskScore > params.riskThreshold) {
      return false;
    }

    // Check minimum APR threshold
    if (prediction.expectedAPR < params.minAPR) {
      return false;
    }

    // Check confidence threshold
    if (prediction.confidence < params.confidenceThreshold) {
      return false;
    }

    // Apply volatility filter
    if (params.volatilityFilter && prediction.volatilityScore > 0.7) {
      return false;
    }

    // Apply momentum filter
    if (params.momentumFilter && prediction.momentumScore < 0.3) {
      return false;
    }

    return true;
  }

  /**
   * Calculate position size based on ML confidence and risk management
   */
  private calculatePositionSize(prediction: MLPrediction, params: OptimizationParams): number {
    const baseSize = params.positionSizing;
    const confidenceMultiplier = prediction.confidence;
    const riskAdjustment = 1 - prediction.riskScore;
    
    return baseSize * confidenceMultiplier * riskAdjustment;
  }

  /**
   * Determine if we should exit a position
   */
  private shouldExitPosition(bar: any, position: any, params: OptimizationParams): boolean {
    // Simple exit logic - can be enhanced
    const holdingPeriod = (Date.now() - position.entryTime) / (1000 * 60 * 60 * 24); // days
    
    // Exit after 3 days max
    if (holdingPeriod > 3) return true;
    
    // Exit if profit target reached
    if (position.unrealizedPnl > 0.015) return true; // 1.5% profit target
    
    return false;
  }

  /**
   * Define parameter optimization ranges
   */
  private getParameterRanges() {
    return {
      riskThreshold: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      minAPR: [3, 4, 5, 6, 7, 8, 9, 10],
      volatilityFilter: [true, false],
      momentumFilter: [true, false],
      positionSizing: [0.1, 0.15, 0.2, 0.25, 0.3],
      confidenceThreshold: [0.4, 0.5, 0.6, 0.7, 0.8]
    };
  }

  /**
   * Calculate optimization score combining multiple metrics
   */
  private calculateOptimizationScore(stats: any): number {
    const returnWeight = 0.4;
    const sharpeWeight = 0.3;
    const drawdownWeight = 0.2;
    const stabilityWeight = 0.1;

    const normalizedReturn = Math.max(0, stats.totalReturn / 50); // Normalize to 50% max return
    const normalizedSharpe = Math.max(0, Math.min(1, stats.sharpeRatio / 3)); // Cap at 3
    const drawdownPenalty = Math.max(0, 1 - stats.maxDrawdown / 20); // Penalize >20% drawdown
    const stabilityBonus = stats.trades > 10 ? 1 : stats.trades / 10; // Prefer strategies with more trades

    return (
      normalizedReturn * returnWeight +
      normalizedSharpe * sharpeWeight +
      drawdownPenalty * drawdownWeight +
      stabilityBonus * stabilityWeight
    );
  }

  /**
   * Run automated parameter optimization using Fugle Backtest
   */
  async optimizeParameters(
    config: OptimizedBacktestConfig,
    maxEvaluations: number = 100
  ): Promise<OptimizationResult> {
    try {
      console.log('🚀 Starting automated parameter optimization...');
      console.log(`📊 Max evaluations: ${maxEvaluations}`);

      // Load historical data
      const historicalData = await this.storage.loadData(config.startDate, config.endDate);
      if (!historicalData || historicalData.length === 0) {
        throw new Error('No historical data available for optimization');
      }

      // Convert our data format to Fugle format
      const fugleData = this.convertToFugleFormat(historicalData);

      // Define parameter ranges
      const paramRanges = this.getParameterRanges();

      // Create Fugle backtest instance
      const backtest = new Backtest(fugleData, this.createMLStrategy.bind(this));

      // Run optimization
      const optimizationResult = await backtest.optimize({
        params: paramRanges,
        optimize: (stats) => this.calculateOptimizationScore(stats),
        maxEvaluations
      });

      console.log('✅ Optimization completed!');
      console.log(`🏆 Best score: ${optimizationResult.score.toFixed(4)}`);
      console.log(`📈 Best return: ${optimizationResult.stats.totalReturn.toFixed(2)}%`);

      return {
        params: optimizationResult.params as OptimizationParams,
        performance: {
          totalReturn: optimizationResult.stats.totalReturn,
          sharpeRatio: optimizationResult.stats.sharpeRatio || 0,
          maxDrawdown: optimizationResult.stats.maxDrawdown || 0,
          winRate: optimizationResult.stats.winRate || 0,
          trades: optimizationResult.stats.totalTrades || 0
        },
        score: optimizationResult.score
      };

    } catch (error) {
      console.error('❌ Optimization failed:', error);
      throw error;
    }
  }

  /**
   * Convert our historical data format to Fugle-compatible format
   */
  private convertToFugleFormat(data: HistoricalData[]): any[] {
    return data.map(item => ({
      timestamp: new Date(item.timestamp),
      open: item.price,
      high: item.price * 1.001, // Approximate high
      low: item.price * 0.999,  // Approximate low
      close: item.price,
      volume: item.volume || 1000,
      fundingRate: item.fundingRate,
      symbol: item.symbol
    }));
  }

  /**
   * Run a single backtest with specific parameters (for validation)
   */
  async validateParameters(
    config: OptimizedBacktestConfig,
    params: OptimizationParams
  ): Promise<OptimizationResult> {
    try {
      const historicalData = await this.storage.loadData(config.startDate, config.endDate);
      const fugleData = this.convertToFugleFormat(historicalData);
      
      const strategy = this.createMLStrategy(params);
      const backtest = new Backtest(fugleData, strategy);
      
      const result = await backtest.run();
      const score = this.calculateOptimizationScore(result);

      return {
        params,
        performance: {
          totalReturn: result.totalReturn,
          sharpeRatio: result.sharpeRatio || 0,
          maxDrawdown: result.maxDrawdown || 0,
          winRate: result.winRate || 0,
          trades: result.totalTrades || 0
        },
        score
      };
    } catch (error) {
      console.error('Validation failed:', error);
      throw error;
    }
  }
}