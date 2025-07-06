import { HistoricalData } from '../historical/types.js';

export interface FundingMomentumSignal {
  symbol: string;
  trend: 'declining' | 'stable' | 'rising';
  strength: number; // 0-1, higher = stronger signal
  lastRates: number[]; // Last 5 funding rates
  avgDecline: number; // Average rate of decline per period
}

export interface VolatilityMetrics {
  symbol: string;
  currentVol: number;
  avgVol: number;
  volPercentile: number; // 0-100
  isLowVol: boolean; // Below 75th percentile
}

export interface PredictiveSignals {
  fundingMomentum: FundingMomentumSignal;
  volatility: VolatilityMetrics;
  riskScore: number; // 0-1, higher = riskier
  entryRecommendation: 'enter' | 'wait' | 'avoid';
  exitRecommendation: 'hold' | 'exit_soon' | 'exit_now';
}

export class PredictiveOptimizer {
  private historicalData: HistoricalData;
  
  constructor(historicalData: HistoricalData) {
    this.historicalData = historicalData;
  }

  /**
   * Phase 1: Detect funding rate momentum patterns
   */
  analyzeFundingMomentum(symbol: string, currentTimestamp: number): FundingMomentumSignal {
    const fundingHistory = this.historicalData.fundingRates.get(symbol);
    if (!fundingHistory) {
      return {
        symbol,
        trend: 'stable',
        strength: 0,
        lastRates: [],
        avgDecline: 0
      };
    }

    // Get last 5 funding rates before current timestamp
    const recentRates = fundingHistory
      .filter(rate => rate.timestamp <= currentTimestamp)
      .slice(-5)
      .map(rate => (rate?.rate || 0) * 3 * 365 * 100); // Convert to APR

    if (recentRates.length < 3) {
      return {
        symbol,
        trend: 'stable',
        strength: 0,
        lastRates: recentRates,
        avgDecline: 0
      };
    }

    // Calculate trend strength
    const declines = [];
    for (let i = 1; i < recentRates.length; i++) {
      const prev = recentRates[i-1] || 0;
      const curr = recentRates[i] || 0;
      declines.push(prev - curr);
    }

    const avgDecline = declines.reduce((sum, decline) => sum + decline, 0) / declines.length;
    const declineCount = declines.filter(d => d > 0).length;
    
    let trend: 'declining' | 'stable' | 'rising';
    let strength: number;

    if (declineCount >= 3 && avgDecline > 1) {
      trend = 'declining';
      strength = Math.min(avgDecline / 5, 1); // Normalize to 0-1
    } else if (declineCount <= 1 && avgDecline < -1) {
      trend = 'rising';
      strength = Math.min(Math.abs(avgDecline) / 5, 1);
    } else {
      trend = 'stable';
      strength = 0.1;
    }

    return {
      symbol,
      trend,
      strength,
      lastRates: recentRates,
      avgDecline
    };
  }

  /**
   * Calculate volatility metrics from OHLCV data
   */
  analyzeVolatility(symbol: string, currentTimestamp: number): VolatilityMetrics {
    // Get spot prices for volatility calculation
    const priceHistory = this.historicalData.spotPrices.get(symbol);
    if (!priceHistory) {
      return {
        symbol,
        currentVol: 0,
        avgVol: 0,
        volPercentile: 50,
        isLowVol: false
      };
    }

    // Get last 24 hours of price data (24 hourly candles)
    const recentPrices = priceHistory
      .filter(candle => candle.timestamp <= currentTimestamp)
      .slice(-24);

    if (recentPrices.length < 12) {
      return {
        symbol,
        currentVol: 0,
        avgVol: 0,
        volPercentile: 50,
        isLowVol: false
      };
    }

    // Calculate hourly returns
    const returns = [];
    for (let i = 1; i < recentPrices.length; i++) {
      const current = recentPrices[i]?.close || 0;
      const previous = recentPrices[i-1]?.close || 1;
      const return_pct = (current - previous) / previous;
      returns.push(return_pct);
    }

    // Calculate volatility (standard deviation of returns)
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const currentVol = Math.sqrt(variance) * 100; // As percentage

    // Get all historical volatilities for percentile calculation
    const allVolatilities = this.calculateAllVolatilities(symbol);
    const volPercentile = this.calculatePercentile(currentVol, allVolatilities);
    
    return {
      symbol,
      currentVol,
      avgVol: allVolatilities.reduce((sum, v) => sum + v, 0) / allVolatilities.length,
      volPercentile,
      isLowVol: volPercentile < 75 // Below 75th percentile = low volatility
    };
  }

  /**
   * Calculate all historical volatilities for percentile ranking
   */
  private calculateAllVolatilities(symbol: string): number[] {
    const priceHistory = this.historicalData.spotPrices.get(symbol);
    if (!priceHistory || priceHistory.length < 48) return [1]; // Default 1% volatility

    const volatilities = [];
    
    // Calculate rolling 24-hour volatilities
    for (let i = 24; i < priceHistory.length; i++) {
      const window = priceHistory.slice(i - 24, i);
      
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
   * Generate comprehensive predictive signals for entry/exit decisions
   */
  generateSignals(symbol: string, currentTimestamp: number, currentAPR: number): PredictiveSignals {
    const fundingMomentum = this.analyzeFundingMomentum(symbol, currentTimestamp);
    const volatility = this.analyzeVolatility(symbol, currentTimestamp);

    // Calculate risk score (0-1, higher = riskier)
    let riskScore = 0;
    
    // High risk if funding is declining
    if (fundingMomentum.trend === 'declining') {
      riskScore += fundingMomentum.strength * 0.5;
    }
    
    // High risk if volatility is high
    if (!volatility.isLowVol) {
      riskScore += (volatility.volPercentile / 100) * 0.3;
    }

    // High risk if APR is at extremes (mean reversion expected)
    if (currentAPR > 15) {
      riskScore += 0.2;
    }

    riskScore = Math.min(riskScore, 1);

    // Entry recommendation
    let entryRecommendation: 'enter' | 'wait' | 'avoid';
    if (riskScore < 0.3 && volatility.isLowVol && currentAPR > 5) {
      entryRecommendation = 'enter';
    } else if (riskScore < 0.6 && currentAPR > 8) {
      entryRecommendation = 'wait';
    } else {
      entryRecommendation = 'avoid';
    }

    // Exit recommendation  
    let exitRecommendation: 'hold' | 'exit_soon' | 'exit_now';
    if (fundingMomentum.trend === 'declining' && fundingMomentum.strength > 0.5) {
      exitRecommendation = 'exit_now';
    } else if (riskScore > 0.6 || currentAPR < 2) {
      exitRecommendation = 'exit_soon';
    } else {
      exitRecommendation = 'hold';
    }

    return {
      fundingMomentum,
      volatility,
      riskScore,
      entryRecommendation,
      exitRecommendation
    };
  }

  /**
   * Smart position sizing based on signals
   */
  calculateOptimalPositionSize(
    availableCash: number, 
    signals: PredictiveSignals,
    maxPositions: number
  ): number {
    // Base position size
    const baseSize = availableCash / maxPositions;
    
    // Adjust based on risk score (lower risk = larger position)
    const riskAdjustment = 1 - signals.riskScore;
    
    // Volatility adjustment (low vol = larger position)
    const volAdjustment = signals.volatility.isLowVol ? 1.2 : 0.8;
    
    // Momentum adjustment
    const momentumAdjustment = signals.fundingMomentum.trend === 'rising' ? 1.1 : 
                               signals.fundingMomentum.trend === 'declining' ? 0.7 : 1.0;

    const adjustedSize = baseSize * riskAdjustment * volAdjustment * momentumAdjustment;
    
    // Ensure we don't exceed 25% of available cash per position
    return Math.min(adjustedSize, availableCash * 0.25);
  }
}