import { RandomForestClassifier } from 'ml-random-forest';
import { HistoricalData } from '../historical/types';

export interface FeatureVector {
  // Basic features
  currentFundingAPR: number;
  currentVolatility: number;
  timeOfDay: number; // 0-23 hour
  
  // Funding rate features (last 5 periods)
  fundingRate1: number;  // Previous period
  fundingRate2: number;  // 2 periods ago
  fundingRate3: number;  // 3 periods ago
  fundingRate4: number;  // 4 periods ago
  fundingRate5: number;  // 5 periods ago
  
  // Derived funding features
  fundingTrend: number;     // Linear slope of last 5 rates
  fundingMean: number;      // Mean of last 5 rates
  fundingStdDev: number;    // Standard deviation of last 5 rates
  fundingPercentile: number; // Percentile vs historical rates (0-100)
  
  // Price/volatility features
  priceChange1h: number;    // 1-hour price change %
  priceChange4h: number;    // 4-hour price change %
  priceChange24h: number;   // 24-hour price change %
  volatilityPercentile: number; // Volatility percentile (0-100)
  
  // Market microstructure
  spotPerpSpread: number;   // Current spread between spot and perp prices
  
  // Time features
  hoursSinceFunding: number; // Hours since last funding period (0-8)
  
  // Target variable (for training)
  willDecline?: boolean;    // True if funding will decline >30% in next 1-2 periods
}

export interface MLPrediction {
  willDecline: boolean;
  confidence: number;      // 0-1
  expectedReturn: number;  // Expected P&L if entering this position
  riskAdjustedScore: number; // Confidence adjusted for risk
  
  // Additional properties needed for optimization
  riskScore: number;       // 0-1, risk level of this position
  expectedAPR: number;     // Expected annual percentage return
  volatilityScore: number; // 0-1, market volatility level
  momentumScore: number;   // 0-1, funding rate momentum
}

export class MLFundingPredictor {
  private model?: RandomForestClassifier;
  private historicalData: HistoricalData;
  private isTraining = false;
  
  constructor(historicalData: HistoricalData) {
    this.historicalData = historicalData;
  }

  /**
   * Phase 2: Extract comprehensive features for ML training
   */
  extractFeatures(symbol: string, timestamp: number): FeatureVector | null {
    const fundingHistory = this.historicalData.fundingRates.get(symbol);
    const priceHistory = this.historicalData.spotPrices.get(symbol);
    
    if (!fundingHistory || !priceHistory) {
      return null;
    }

    // Get current funding rate
    const currentFunding = fundingHistory
      .filter(rate => rate.timestamp <= timestamp)
      .pop();
    
    if (!currentFunding) return null;
    
    const currentFundingAPR = currentFunding.rate * 3 * 365 * 100;

    // Get last 5 funding rates
    const recentRates = fundingHistory
      .filter(rate => rate.timestamp <= timestamp)
      .slice(-6) // Get 6 to calculate features from 5 previous
      .map(rate => rate.rate * 3 * 365 * 100);

    if (recentRates.length < 5) return null;

    // Funding rate features
    const lastFive = recentRates.slice(-5);
    const [rate5, rate4, rate3, rate2, rate1] = [
      lastFive[0] || 0,
      lastFive[1] || 0,
      lastFive[2] || 0,
      lastFive[3] || 0,
      lastFive[4] || 0
    ];
    const fundingMean = recentRates.reduce((sum, r) => sum + r, 0) / recentRates.length;
    const fundingVariance = recentRates.reduce((sum, r) => sum + Math.pow(r - fundingMean, 2), 0) / recentRates.length;
    const fundingStdDev = Math.sqrt(fundingVariance);
    
    // Calculate funding trend (linear slope)
    const fundingTrend = this.calculateLinearSlope(recentRates);
    
    // Get historical percentile
    const allRates = fundingHistory.map(r => r.rate * 3 * 365 * 100);
    const fundingPercentile = this.calculatePercentile(currentFundingAPR, allRates);

    // Price features
    const recentPrices = priceHistory
      .filter(candle => candle.timestamp <= timestamp)
      .slice(-25); // Last 25 hours for price changes

    if (recentPrices.length < 25) return null;

    const currentPrice = recentPrices[recentPrices.length - 1]?.close || 0;
    const price1h = recentPrices[recentPrices.length - 2]?.close || currentPrice;
    const price4h = recentPrices[recentPrices.length - 5]?.close || currentPrice;
    const price24h = recentPrices[recentPrices.length - 25]?.close || currentPrice;

    const priceChange1h = price1h ? ((currentPrice - price1h) / price1h) * 100 : 0;
    const priceChange4h = price4h ? ((currentPrice - price4h) / price4h) * 100 : 0;
    const priceChange24h = price24h ? ((currentPrice - price24h) / price24h) * 100 : 0;

    // Volatility calculation
    const returns = [];
    for (let i = 1; i < recentPrices.length; i++) {
      const current = recentPrices[i]?.close || 0;
      const previous = recentPrices[i-1]?.close || 1;
      const return_pct = (current - previous) / previous;
      returns.push(return_pct);
    }
    
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const currentVolatility = Math.sqrt(variance) * 100;
    
    // Get all historical volatilities for percentile
    const allVolatilities = this.calculateAllVolatilities(symbol, timestamp);
    const volatilityPercentile = this.calculatePercentile(currentVolatility, allVolatilities);

    // Time features
    const date = new Date(timestamp);
    const timeOfDay = date.getUTCHours();
    
    // Hours since last funding (funding happens at 0, 8, 16 UTC)
    const hoursSinceFunding = timeOfDay % 8;

    // Spot-perp spread (using same price for simplification)
    const spotPerpSpread = 0; // Would need separate perp price data

    return {
      currentFundingAPR,
      currentVolatility,
      timeOfDay,
      
      fundingRate1: rate1,
      fundingRate2: rate2,
      fundingRate3: rate3,
      fundingRate4: rate4,
      fundingRate5: rate5,
      
      fundingTrend,
      fundingMean,
      fundingStdDev,
      fundingPercentile,
      
      priceChange1h,
      priceChange4h,
      priceChange24h,
      volatilityPercentile,
      
      spotPerpSpread,
      hoursSinceFunding
    };
  }

  /**
   * Calculate linear slope of a series of values
   */
  private calculateLinearSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    
    const xSum = (n * (n - 1)) / 2; // 0 + 1 + 2 + ... + (n-1)
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, idx) => sum + val * idx, 0);
    const xxSum = (n * (n - 1) * (2 * n - 1)) / 6; // 0^2 + 1^2 + 2^2 + ... + (n-1)^2
    
    const slope = (n * xySum - xSum * ySum) / (n * xxSum - xSum * xSum);
    return slope;
  }

  /**
   * Calculate all historical volatilities for a symbol
   */
  private calculateAllVolatilities(symbol: string, beforeTimestamp: number): number[] {
    const priceHistory = this.historicalData.spotPrices.get(symbol);
    if (!priceHistory || priceHistory.length < 48) return [1];

    const relevantPrices = priceHistory.filter(candle => candle.timestamp < beforeTimestamp);
    const volatilities = [];
    
    for (let i = 24; i < relevantPrices.length; i++) {
      const window = relevantPrices.slice(i - 24, i);
      
      const returns = [];
      for (let j = 1; j < window.length; j++) {
        const current = window[j]?.close || 0;
        const previous = window[j-1]?.close || 1;
        const return_pct = (current - previous) / previous;
        returns.push(return_pct);
      }

      if (returns.length > 0) {
        const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
        const vol = Math.sqrt(variance) * 100;
        volatilities.push(vol);
      }
    }

    return volatilities.length > 0 ? volatilities : [1];
  }

  /**
   * Calculate percentile rank of a value in an array
   */
  private calculatePercentile(value: number, array: number[]): number {
    const sorted = [...array].sort((a, b) => a - b);
    const rank = sorted.findIndex(v => v >= value);
    return rank === -1 ? 100 : (rank / sorted.length) * 100;
  }

  /**
   * Generate training data from historical periods
   */
  generateTrainingData(symbols: string[], trainingEndTimestamp: number): {
    features: FeatureVector[];
    labels: number[];
  } {
    const features: FeatureVector[] = [];
    const labels: number[] = [];

    console.log('🧠 Generating ML training data...');

    for (const symbol of symbols) {
      const fundingHistory = this.historicalData.fundingRates.get(symbol);
      if (!fundingHistory) continue;

      // Use data up to trainingEndTimestamp for training
      const relevantFunding = fundingHistory.filter(rate => rate.timestamp <= trainingEndTimestamp);
      
      // Generate features for each funding period (skip last 2 for labeling)
      for (let i = 5; i < relevantFunding.length - 2; i++) {
        const currentTimestamp = relevantFunding[i]?.timestamp;
        if (!currentTimestamp) continue;
        
        const currentFeatures = this.extractFeatures(symbol, currentTimestamp);
        if (!currentFeatures) continue;

        // Look ahead 1-2 periods to determine if funding declined significantly
        const currentEntry = relevantFunding[i];
        const futureEntry1 = relevantFunding[i + 1];
        const futureEntry2 = relevantFunding[i + 2];
        
        if (!currentEntry?.rate || !futureEntry1?.rate || !futureEntry2?.rate) continue;
        
        const currentAPR = currentEntry.rate * 3 * 365 * 100;
        const futureAPR1 = futureEntry1.rate * 3 * 365 * 100;
        const futureAPR2 = futureEntry2.rate * 3 * 365 * 100;

        // Label: True if funding declined >30% in next 1-2 periods
        const decline1 = (currentAPR - futureAPR1) / Math.abs(currentAPR) * 100;
        const decline2 = (currentAPR - futureAPR2) / Math.abs(currentAPR) * 100;
        const willDecline = decline1 > 30 || decline2 > 30;

        currentFeatures.willDecline = willDecline;
        features.push(currentFeatures);
        labels.push(willDecline ? 1 : 0);
      }
    }

    console.log(`📊 Generated ${features.length} training samples`);
    const positiveRate = (labels.filter(l => l).length / labels.length * 100).toFixed(1);
    console.log(`📈 Positive samples (decline >30%): ${positiveRate}%`);

    return { features, labels };
  }

  /**
   * Train the Random Forest model
   */
  trainModel(symbols: string[], trainingEndTimestamp: number): void {
    console.log('🏋️ Training Random Forest model...');
    this.isTraining = true;

    const { features, labels } = this.generateTrainingData(symbols, trainingEndTimestamp);
    
    if (features.length < 50) {
      console.warn('⚠️ Not enough training data, using heuristic-only predictions');
      this.isTraining = false;
      return;
    }

    // Convert features to numeric arrays
    const X = features.map(f => [
      f.currentFundingAPR,
      f.currentVolatility,
      f.timeOfDay,
      f.fundingRate1,
      f.fundingRate2,
      f.fundingRate3,
      f.fundingRate4,
      f.fundingRate5,
      f.fundingTrend,
      f.fundingMean,
      f.fundingStdDev,
      f.fundingPercentile,
      f.priceChange1h,
      f.priceChange4h,
      f.priceChange24h,
      f.volatilityPercentile,
      f.spotPerpSpread,
      f.hoursSinceFunding
    ]);

    // Train Random Forest
    try {
      this.model = new RandomForestClassifier({
        nEstimators: 50,      // Number of trees
        replacement: true     // Bootstrap sampling
      });

      this.model.train(X, labels);
      console.log('✅ Random Forest model trained successfully');
      
      // Quick validation
      const predictions = this.model.predict(X);
      const accuracy = predictions.reduce((correct, pred, idx) => {
        return correct + (pred === labels[idx] ? 1 : 0);
      }, 0) / predictions.length;
      
      console.log(`📊 Training accuracy: ${(accuracy * 100).toFixed(1)}%`);
      
    } catch (error) {
      console.error('❌ Failed to train Random Forest:', error);
      this.model = undefined;
    }
    
    this.isTraining = false;
  }

  /**
   * Make ML prediction for a specific symbol and timestamp
   */
  predict(dataPoint: { symbol: string; timestamp: number }): MLPrediction | null;
  predict(symbol: string, timestamp: number): MLPrediction | null;
  predict(arg1: string | { symbol: string; timestamp: number }, timestamp?: number): MLPrediction | null {
    // Handle both call signatures for backward compatibility
    const symbol = typeof arg1 === 'string' ? arg1 : arg1.symbol;
    const ts = typeof arg1 === 'string' ? timestamp! : arg1.timestamp;
    const features = this.extractFeatures(symbol, ts);
    if (!features || this.isTraining) {
      return null;
    }

    // If no model trained, fall back to heuristic
    if (!this.model) {
      return this.heuristicPredict(features);
    }

    try {
      // Convert features to numeric array
      const X = [
        features.currentFundingAPR,
        features.currentVolatility,
        features.timeOfDay,
        features.fundingRate1,
        features.fundingRate2,
        features.fundingRate3,
        features.fundingRate4,
        features.fundingRate5,
        features.fundingTrend,
        features.fundingMean,
        features.fundingStdDev,
        features.fundingPercentile,
        features.priceChange1h,
        features.priceChange4h,
        features.priceChange24h,
        features.volatilityPercentile,
        features.spotPerpSpread,
        features.hoursSinceFunding
      ];

      // Get prediction and confidence
      const prediction = this.model.predict([X])[0];
      
      // For Random Forest, estimate confidence based on vote distribution
      // This is a simplification - could be improved with probability estimates
      const willDecline = prediction === 1;
      const confidence = willDecline ? 0.7 : 0.6; // Simplified confidence

      // Calculate expected return based on current APR and prediction
      const expectedReturn = this.calculateExpectedReturn(features, willDecline, confidence);
      
      // Risk-adjusted score
      const riskAdjustedScore = confidence * (1 - features.volatilityPercentile / 100);

      // Calculate additional properties for optimization
      const riskScore = features.volatilityPercentile / 100; // Higher volatility = higher risk
      const expectedAPR = features.currentFundingAPR;
      const volatilityScore = features.volatilityPercentile / 100;
      const momentumScore = Math.max(0, Math.min(1, (features.fundingTrend + 1) / 2)); // Normalize to 0-1

      return {
        willDecline,
        confidence,
        expectedReturn,
        riskAdjustedScore,
        riskScore,
        expectedAPR,
        volatilityScore,
        momentumScore
      };

    } catch (error) {
      console.warn('ML prediction failed, falling back to heuristic:', error);
      return this.heuristicPredict(features);
    }
  }

  /**
   * Fallback heuristic prediction when ML is not available
   */
  private heuristicPredict(features: FeatureVector): MLPrediction {
    // Simple heuristic based on funding trend and volatility
    const willDecline = features.fundingTrend > 0.5 && features.currentFundingAPR > 10;
    const confidence = Math.min(Math.abs(features.fundingTrend) * 0.5 + 0.3, 0.8);
    
    const expectedReturn = this.calculateExpectedReturn(features, willDecline, confidence);
    const riskAdjustedScore = confidence * (1 - features.volatilityPercentile / 100);

    // Calculate additional properties for optimization
    const riskScore = features.volatilityPercentile / 100; // Higher volatility = higher risk
    const expectedAPR = features.currentFundingAPR;
    const volatilityScore = features.volatilityPercentile / 100;
    const momentumScore = Math.max(0, Math.min(1, (features.fundingTrend + 1) / 2)); // Normalize to 0-1

    return {
      willDecline,
      confidence,
      expectedReturn,
      riskAdjustedScore,
      riskScore,
      expectedAPR,
      volatilityScore,
      momentumScore
    };
  }

  /**
   * Calculate expected return for a position based on features and prediction
   */
  private calculateExpectedReturn(features: FeatureVector, willDecline: boolean, confidence: number): number {
    // Simplified expected return calculation
    const baseReturn = features.currentFundingAPR * 0.01; // 1% of APR per period
    
    if (willDecline) {
      // If we predict decline, expected return is negative
      return -baseReturn * confidence;
    } else {
      // If we predict stability/growth, expected return is positive
      return baseReturn * confidence;
    }
  }

  /**
   * Get model information for reporting
   */
  getModelInfo(): { trained: boolean; features: number } {
    return {
      trained: this.model !== undefined,
      features: 18 // Number of features we use
    };
  }
}