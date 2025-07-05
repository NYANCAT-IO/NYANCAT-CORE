import { 
  BacktestConfig, 
  ComprehensiveBacktestResult,
  DetailedPosition,
  OpenPosition,
  FundingSnapshot,
  PriceSnapshot,
  EquityPoint
} from './types';
import { HistoricalData, DataStorage } from '../historical';
import { PredictiveOptimizer, PredictiveSignals, MLFundingPredictor, MLPrediction } from '../strategy';

export interface OptimizedBacktestConfig extends BacktestConfig {
  useML?: boolean;
  riskThreshold?: number; // 0-1, positions only taken if risk < threshold
  volatilityFilter?: boolean; // Only trade in low volatility periods
  momentumFilter?: boolean; // Avoid declining momentum
}

export interface OptimizedPosition extends DetailedPosition {
  entrySignals: PredictiveSignals;
  exitSignals?: PredictiveSignals;
  mlPrediction?: MLPrediction;
  predictedOutcome: 'win' | 'loss' | 'unknown';
  confidence: number; // 0-1
}

export interface OptimizedBacktestResult extends ComprehensiveBacktestResult {
  optimizedPositions: OptimizedPosition[];
  signalAccuracy: {
    totalPredictions: number;
    correctPredictions: number;
    accuracy: number;
    avgConfidence: number;
  };
  featureImportance: {
    fundingMomentum: number;
    volatilityFilter: number;
    riskScore: number;
  };
}

export class OptimizedBacktestEngine {
  private storage: DataStorage;
  private optimizer?: PredictiveOptimizer;
  private mlPredictor?: MLFundingPredictor;
  
  constructor() {
    this.storage = new DataStorage();
  }
  
  async runOptimizedBacktest(config: OptimizedBacktestConfig): Promise<OptimizedBacktestResult> {
    // Set defaults with optimization parameters
    const endDate = config.endDate || new Date();
    const startDate = config.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days default
    const initialCapital = config.initialCapital || 10000;
    const minAPR = config.minAPR || 3; // Lower threshold for optimized strategy
    const riskThreshold = config.riskThreshold || 0.6; // Only take positions with risk < 60%
    
    console.log(`🚀 Running OPTIMIZED backtest from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`💰 Initial capital: $${initialCapital}`);
    console.log(`📊 Risk threshold: ${riskThreshold}, Min APR: ${minAPR}%`);
    console.log(`🎯 Filters - Volatility: ${config.volatilityFilter}, Momentum: ${config.momentumFilter}`);
    
    // Load historical data
    const historicalData = await this.loadHistoricalData(startDate, endDate);
    if (!historicalData) {
      throw new Error('No historical data available for the specified period');
    }
    
    // Initialize predictive optimizer
    this.optimizer = new PredictiveOptimizer(historicalData);
    
    // Initialize ML predictor if using ML
    if (config.useML) {
      this.mlPredictor = new MLFundingPredictor(historicalData);
      
      // Train model on first 70% of data
      const trainingEndTime = startDate.getTime() + (endDate.getTime() - startDate.getTime()) * 0.7;
      const symbols = Array.from(historicalData.fundingRates.keys()).slice(0, 10); // Train on top 10 symbols
      this.mlPredictor.trainModel(symbols, trainingEndTime);
      
      console.log('🤖 ML model training complete');
    }
    
    // Generate funding timestamps (every 8 hours: 00:00, 08:00, 16:00 UTC)
    const fundingTimestamps = this.generateFundingTimestamps(startDate.getTime(), endDate.getTime());
    console.log(`⏰ Processing ${fundingTimestamps.length} funding periods with ML optimization`);
    
    // Initialize state
    let cash = initialCapital;
    const openPositions = new Map<string, OpenPosition & { 
      entrySignals: PredictiveSignals;
      mlPrediction?: MLPrediction;
    }>();
    const optimizedPositions: OptimizedPosition[] = [];
    const equityCurve: EquityPoint[] = [];
    
    // Track prediction accuracy
    let totalPredictions = 0;
    let correctPredictions = 0;
    let totalConfidence = 0;
    
    // Track peak for drawdown calculation
    let peak = initialCapital;
    let maxDrawdown = 0;
    
    // Process each funding period with ML optimization
    for (const timestamp of fundingTimestamps) {
      // Get market data at this timestamp
      const fundingRates = this.getFundingRatesAtTime(historicalData, timestamp);
      const prices = this.getPricesAtTime(historicalData, timestamp);
      
      if (!fundingRates || !prices) {
        continue;
      }
      
      // Update existing positions with funding payments
      for (const [symbol, openPosition] of openPositions) {
        const fundingRate = fundingRates.rates.get(symbol);
        const perpPrice = prices.perpPrices.get(symbol);
        if (fundingRate !== undefined && perpPrice !== undefined) {
          // Calculate funding payment (negative because we're short perp)
          const positionValue = openPosition.quantity * perpPrice;
          const fundingPayment = positionValue * fundingRate;
          openPosition.fundingPayments.push(fundingPayment);
          openPosition.fundingPeriodsHeld++;
          cash += fundingPayment;
        }
      }
      
      // OPTIMIZED EXIT LOGIC: Use predictive signals
      const positionsToClose: Array<{
        symbol: string;
        exitFundingRate: number;
        exitFundingAPR: number;
        exitReason: string;
        exitSignals: PredictiveSignals;
      }> = [];
      
      for (const [symbol] of openPositions) {
        const currentFundingRate = fundingRates.rates.get(symbol) || 0;
        const currentAPR = currentFundingRate * 3 * 365 * 100;
        
        // Generate exit signals
        const exitSignals = this.optimizer!.generateSignals(symbol, timestamp, currentAPR);
        
        let exitReason = '';
        
        // ML-driven exit conditions
        if (exitSignals.exitRecommendation === 'exit_now') {
          exitReason = `ML Signal: Exit now (risk: ${(exitSignals.riskScore * 100).toFixed(1)}%, momentum: ${exitSignals.fundingMomentum.trend})`;
        } else if (exitSignals.exitRecommendation === 'exit_soon' && currentAPR < 2) {
          exitReason = `ML Signal: Exit soon + Low APR (${currentAPR.toFixed(1)}%)`;
        } else if (currentAPR < -1) {
          exitReason = `Negative funding: ${currentAPR.toFixed(1)}% APR`;
        }
        
        if (exitReason) {
          positionsToClose.push({
            symbol,
            exitFundingRate: currentFundingRate,
            exitFundingAPR: currentAPR,
            exitReason,
            exitSignals
          });
        }
      }
      
      // Close positions with detailed ML tracking
      for (const closeInfo of positionsToClose) {
        const { symbol, exitFundingRate, exitFundingAPR, exitReason, exitSignals } = closeInfo;
        const position = openPositions.get(symbol)!;
        const exitSpotPrice = prices.spotPrices.get(symbol)!;
        const exitPerpPrice = prices.perpPrices.get(symbol)!;
        
        // Calculate detailed P&L
        const spotPnL = (exitSpotPrice - position.entrySpotPrice) * position.quantity;
        const perpPnL = (position.entryPerpPrice - exitPerpPrice) * position.quantity;
        const totalFunding = position.fundingPayments.reduce((sum, p) => sum + p, 0);
        const entryFees = position.quantity * position.entrySpotPrice * 0.001; // 0.1%
        const exitFees = position.quantity * exitSpotPrice * 0.001; // 0.1%
        const totalPnL = spotPnL + perpPnL + totalFunding - entryFees - exitFees;
        
        // Evaluate prediction accuracy
        const actualOutcome = totalPnL > 0 ? 'win' : 'loss';
        
        // Use ML prediction if available, otherwise fall back to risk score
        let predictedOutcome: 'win' | 'loss';
        let predictionConfidence: number;
        
        if (position.mlPrediction) {
          predictedOutcome = position.mlPrediction.willDecline ? 'loss' : 'win';
          predictionConfidence = position.mlPrediction.confidence;
        } else {
          predictedOutcome = position.entrySignals.riskScore < 0.5 ? 'win' : 'loss';
          predictionConfidence = position.entrySignals.riskScore < 0.5 ? 
            (1 - position.entrySignals.riskScore) : position.entrySignals.riskScore;
        }
        
        if (predictedOutcome === actualOutcome) {
          correctPredictions++;
        }
        totalPredictions++;
        totalConfidence += predictionConfidence;
        
        // Calculate time metrics
        const holdingPeriodHours = (timestamp - position.entryTime) / (1000 * 60 * 60);
        
        optimizedPositions.push({
          // Basic position data
          symbol,
          entryTime: position.entryTime,
          exitTime: timestamp,
          entrySpotPrice: position.entrySpotPrice,
          entryPerpPrice: position.entryPerpPrice,
          exitSpotPrice,
          exitPerpPrice,
          quantity: position.quantity,
          fundingPayments: position.fundingPayments,
          totalPnL,
          
          // Extended data
          entryFundingRate: position.entryFundingRate,
          entryFundingAPR: position.entryFundingAPR,
          concurrentPositions: position.concurrentPositions,
          exitFundingRate,
          exitFundingAPR,
          exitReason,
          holdingPeriodHours,
          fundingPeriodsHeld: position.fundingPeriodsHeld,
          spotPnL,
          perpPnL,
          totalFunding,
          entryFees,
          exitFees,
          
          // ML-specific data
          entrySignals: position.entrySignals,
          exitSignals,
          mlPrediction: position.mlPrediction,
          predictedOutcome,
          confidence: predictionConfidence
        });
        
        // Return capital
        cash += position.quantity * exitSpotPrice;
        openPositions.delete(symbol);
        
        console.log(`📊 ${symbol}: ${exitReason}, P&L $${totalPnL.toFixed(2)}, Confidence: ${((1 - position.entrySignals.riskScore) * 100).toFixed(1)}%`);
      }
      
      // OPTIMIZED ENTRY LOGIC: Use ML signals for filtering
      const opportunities: { 
        symbol: string; 
        apr: number; 
        rate: number; 
        signals: PredictiveSignals;
        mlPrediction?: MLPrediction;
      }[] = [];
      
      for (const [symbol, rate] of fundingRates.rates) {
        const apr = rate * 3 * 365 * 100;
        
        if (apr > minAPR && !openPositions.has(symbol)) {
          // Generate ML signals for entry decision
          const signals = this.optimizer!.generateSignals(symbol, timestamp, apr);
          
          // Get ML prediction if available
          let mlPrediction: MLPrediction | undefined;
          if (this.mlPredictor) {
            mlPrediction = this.mlPredictor.predict(symbol, timestamp) || undefined;
          }
          
          // Apply ML filters
          let shouldEnter = signals.entryRecommendation === 'enter';
          
          // Risk filter
          if (signals.riskScore > riskThreshold) {
            shouldEnter = false;
          }
          
          // Volatility filter
          if (config.volatilityFilter && !signals.volatility.isLowVol) {
            shouldEnter = false;
          }
          
          // Momentum filter
          if (config.momentumFilter && signals.fundingMomentum.trend === 'declining') {
            shouldEnter = false;
          }
          
          // ML prediction filter
          if (mlPrediction && mlPrediction.willDecline && mlPrediction.confidence > 0.6) {
            shouldEnter = false;
          }
          
          if (shouldEnter) {
            opportunities.push({ symbol, apr, rate, signals, mlPrediction });
          }
        }
      }
      
      // Sort by ML confidence and risk score
      opportunities.sort((a, b) => {
        // Use ML prediction confidence if available, otherwise use risk-based confidence
        const confidenceA = a.mlPrediction ? 
          (a.mlPrediction.willDecline ? 0.1 : a.mlPrediction.confidence) : 
          (1 - a.signals.riskScore);
        const confidenceB = b.mlPrediction ? 
          (b.mlPrediction.willDecline ? 0.1 : b.mlPrediction.confidence) : 
          (1 - b.signals.riskScore);
        
        // Primary sort by confidence, secondary by APR
        if (Math.abs(confidenceA - confidenceB) > 0.1) {
          return confidenceB - confidenceA;
        }
        return b.apr - a.apr;
      });
      
      // Enter positions with ML-optimized sizing
      const maxPositions = 5;
      const availableSlots = maxPositions - openPositions.size;
      const toEnter = opportunities.slice(0, availableSlots);
      
      for (const opp of toEnter) {
        const spotPrice = prices.spotPrices.get(opp.symbol);
        const perpPrice = prices.perpPrices.get(opp.symbol);
        
        if (!spotPrice || !perpPrice) continue;
        
        // ML-optimized position sizing
        const optimalSize = this.optimizer!.calculateOptimalPositionSize(
          cash, 
          opp.signals, 
          maxPositions
        );
        
        const quantity = optimalSize / spotPrice;
        
        // Deduct capital for spot position
        cash -= quantity * spotPrice;
        
        openPositions.set(opp.symbol, {
          symbol: opp.symbol,
          entryTime: timestamp,
          entrySpotPrice: spotPrice,
          entryPerpPrice: perpPrice,
          quantity,
          fundingPayments: [],
          entryFundingRate: opp.rate,
          entryFundingAPR: opp.apr,
          concurrentPositions: openPositions.size + 1,
          fundingPeriodsHeld: 0,
          entrySignals: opp.signals,
          mlPrediction: opp.mlPrediction
        });
        
        console.log(`🎯 ${opp.symbol}: Enter $${optimalSize.toFixed(0)} @ ${opp.apr.toFixed(1)}% APR (confidence: ${((1 - opp.signals.riskScore) * 100).toFixed(1)}%)`);
      }
      
      // Calculate current portfolio value
      let portfolioValue = cash;
      for (const [symbol, position] of openPositions) {
        const currentPrice = prices.spotPrices.get(symbol) || position.entrySpotPrice;
        portfolioValue += position.quantity * currentPrice;
      }
      
      // Track drawdown
      if (portfolioValue > peak) {
        peak = portfolioValue;
      }
      const currentDrawdown = ((peak - portfolioValue) / peak) * 100;
      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }
      
      // Add to equity curve
      equityCurve.push({
        timestamp,
        value: portfolioValue
      });
    }
    
    // Close any remaining positions at the end
    const finalTimestamp = fundingTimestamps[fundingTimestamps.length - 1];
    const finalPrices = finalTimestamp ? this.getPricesAtTime(historicalData, finalTimestamp) : null;
    
    if (finalPrices) {
      for (const [symbol, position] of openPositions) {
        const exitSpotPrice = finalPrices.spotPrices.get(symbol) || position.entrySpotPrice;
        cash += position.quantity * exitSpotPrice;
      }
    }
    
    // Calculate final metrics
    const finalCapital = cash;
    const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
    const winningTrades = optimizedPositions.filter(p => p.totalPnL > 0).length;
    const winRate = optimizedPositions.length > 0 ? (winningTrades / optimizedPositions.length) * 100 : 0;
    
    // Calculate feature importance (simplified)
    const featureImportance = this.calculateFeatureImportance(optimizedPositions);
    
    // Build comprehensive result
    const result: OptimizedBacktestResult = {
      summary: {
        initialCapital,
        finalCapital,
        totalReturn,
        totalReturnDollars: finalCapital - initialCapital,
        numberOfTrades: optimizedPositions.length,
        winningTrades,
        winRate,
        maxDrawdown,
        totalDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000))
      },
      
      equityCurve,
      positions: optimizedPositions, // Required by ComprehensiveBacktestResult
      config: config as BacktestConfig, // Required by ComprehensiveBacktestResult
      detailedPositions: optimizedPositions,
      optimizedPositions,
      
      signalAccuracy: {
        totalPredictions,
        correctPredictions,
        accuracy: totalPredictions > 0 ? (correctPredictions / totalPredictions) * 100 : 0,
        avgConfidence: totalPredictions > 0 ? (totalConfidence / totalPredictions) * 100 : 0
      },
      
      featureImportance,
      
      // Generate standard analytics
      monthlyStats: this.generateMonthlyStats(optimizedPositions),
      symbolStats: this.generateSymbolStats(optimizedPositions)
    };
    
    console.log(`\n🎯 OPTIMIZED BACKTEST COMPLETE:`);
    console.log(`💰 Return: ${totalReturn.toFixed(2)}% (${(finalCapital - initialCapital > 0 ? '+' : '')}$${(finalCapital - initialCapital).toFixed(2)})`);
    console.log(`📈 Win Rate: ${winRate.toFixed(1)}% (${winningTrades}/${optimizedPositions.length})`);
    console.log(`🎯 ML Accuracy: ${result.signalAccuracy.accuracy.toFixed(1)}% (${correctPredictions}/${totalPredictions})`);
    console.log(`📊 Max Drawdown: ${maxDrawdown.toFixed(1)}%`);
    
    return result;
  }
  
  private calculateFeatureImportance(positions: OptimizedPosition[]): {
    fundingMomentum: number;
    volatilityFilter: number;
    riskScore: number;
  } {
    if (positions.length === 0) {
      return { fundingMomentum: 0, volatilityFilter: 0, riskScore: 0 };
    }
    
    // Simple correlation analysis
    let momentumCorrectPredictions = 0;
    let volatilityCorrectPredictions = 0;
    let riskCorrectPredictions = 0;
    
    for (const pos of positions) {
      const actualProfit = pos.totalPnL > 0;
      
      // Momentum feature: declining trend should predict losses
      if ((pos.entrySignals.fundingMomentum.trend === 'declining') === !actualProfit) {
        momentumCorrectPredictions++;
      }
      
      // Volatility feature: high vol should predict losses
      if ((!pos.entrySignals.volatility.isLowVol) === !actualProfit) {
        volatilityCorrectPredictions++;
      }
      
      // Risk score: high risk should predict losses
      if ((pos.entrySignals.riskScore > 0.5) === !actualProfit) {
        riskCorrectPredictions++;
      }
    }
    
    return {
      fundingMomentum: momentumCorrectPredictions / positions.length,
      volatilityFilter: volatilityCorrectPredictions / positions.length,
      riskScore: riskCorrectPredictions / positions.length
    };
  }
  
  // Copy helper methods from ComprehensiveBacktestEngine
  private async loadHistoricalData(startDate: Date, endDate: Date): Promise<HistoricalData | null> {
    try {
      return await this.storage.loadHistoricalData(startDate.getTime(), endDate.getTime());
    } catch (error) {
      console.error('Failed to load historical data:', error);
      return null;
    }
  }
  
  private generateFundingTimestamps(startTime: number, endTime: number): number[] {
    const timestamps: number[] = [];
    
    // Start from the first funding period at or after startTime
    let current = new Date(startTime);
    current.setUTCMinutes(0, 0, 0);
    
    // Round to next funding period (00:00, 08:00, 16:00 UTC)
    const hours = current.getUTCHours();
    if (hours < 8) {
      current.setUTCHours(8);
    } else if (hours < 16) {
      current.setUTCHours(16);
    } else {
      current.setUTCDate(current.getUTCDate() + 1);
      current.setUTCHours(0);
    }
    
    while (current.getTime() <= endTime) {
      timestamps.push(current.getTime());
      
      // Next funding period (8 hours later)
      current.setUTCHours(current.getUTCHours() + 8);
    }
    
    return timestamps;
  }
  
  private getFundingRatesAtTime(data: HistoricalData, timestamp: number): FundingSnapshot | null {
    const rates = new Map<string, number>();
    
    for (const [symbol, fundingHistory] of data.fundingRates) {
      // Find the funding rate that was active at this timestamp
      const activeRate = fundingHistory
        .filter(rate => rate.timestamp <= timestamp)
        .pop(); // Get the most recent one
      
      if (activeRate) {
        rates.set(symbol, activeRate.rate);
      }
    }
    
    return rates.size > 0 ? { timestamp, rates } : null;
  }
  
  private getPricesAtTime(data: HistoricalData, timestamp: number): PriceSnapshot | null {
    const spotPrices = new Map<string, number>();
    const perpPrices = new Map<string, number>();
    
    for (const [symbol, priceHistory] of data.spotPrices) {
      const activePrice = priceHistory
        .filter(candle => candle.timestamp <= timestamp)
        .pop();
      
      if (activePrice) {
        spotPrices.set(symbol, activePrice.close);
      }
    }
    
    for (const [symbol, priceHistory] of data.perpPrices) {
      const activePrice = priceHistory
        .filter(candle => candle.timestamp <= timestamp)
        .pop();
      
      if (activePrice) {
        perpPrices.set(symbol, activePrice.close);
      }
    }
    
    return spotPrices.size > 0 && perpPrices.size > 0 ? 
      { timestamp, spotPrices, perpPrices } : null;
  }
  
  private generateMonthlyStats(_positions: OptimizedPosition[]): any[] {
    // Implementation would group positions by month and calculate stats
    return [];
  }
  
  private generateSymbolStats(positions: OptimizedPosition[]): Map<string, any> {
    // Group positions by symbol and calculate stats
    const symbolStats = new Map<string, any>();
    
    // Group positions by symbol
    const positionsBySymbol = new Map<string, OptimizedPosition[]>();
    for (const position of positions) {
      if (!positionsBySymbol.has(position.symbol)) {
        positionsBySymbol.set(position.symbol, []);
      }
      positionsBySymbol.get(position.symbol)!.push(position);
    }
    
    // Calculate stats for each symbol
    for (const [symbol, symbolPositions] of positionsBySymbol) {
      const totalPnL = symbolPositions.reduce((sum, p) => sum + p.totalPnL, 0);
      const winningTrades = symbolPositions.filter(p => p.totalPnL > 0).length;
      const totalFunding = symbolPositions.reduce((sum, p) => sum + p.totalFunding, 0);
      const avgFundingAPR = symbolPositions.reduce((sum, p) => sum + p.entryFundingAPR, 0) / symbolPositions.length;
      const avgHoldingHours = symbolPositions.reduce((sum, p) => sum + p.holdingPeriodHours, 0) / symbolPositions.length;
      
      symbolStats.set(symbol, {
        symbol,
        trades: symbolPositions.length,
        totalPnL,
        avgPnL: totalPnL / symbolPositions.length,
        winRate: (winningTrades / symbolPositions.length) * 100,
        avgFundingAPR,
        avgHoldingHours,
        totalFunding
      });
    }
    
    return symbolStats;
  }
}