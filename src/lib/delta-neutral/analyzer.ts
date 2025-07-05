import { 
  DeltaNeutralPair, 
  StrategyType, 
  StrategyConfig, 
  StrategyResult,
  PositionSize,
  FeeStructure,
  MarketSummaryStats
} from './types';
import { DataLoader } from './data-loader';

export class DeltaNeutralAnalyzer {
  private dataLoader: DataLoader;
  private defaultFees: FeeStructure = {
    spotMaker: 0.001,    // 0.1%
    spotTaker: 0.001,    // 0.1%
    perpMaker: 0.0002,   // 0.02%
    perpTaker: 0.00055,  // 0.055%
  };
  
  constructor(dataPath?: string) {
    this.dataLoader = new DataLoader(dataPath);
  }
  
  /**
   * Analyze all available delta-neutral opportunities
   */
  async analyze(config: StrategyConfig = { type: StrategyType.LONG_SPOT_SHORT_PERP }): Promise<StrategyResult[]> {
    // Load data
    const { tickers, timestamp } = this.dataLoader.loadAllData();
    
    console.log(`\nAnalyzing data from: ${new Date(timestamp).toLocaleString()}`);
    
    // Find matching pairs
    const pairs = this.dataLoader.findMatchingPairs(tickers);
    console.log(`Found ${pairs.size} potential pairs`);
    
    // Convert to DeltaNeutralPair format
    const deltaNeutralPairs: DeltaNeutralPair[] = [];
    const fundingRateCount = new Map<number, number>();
    
    for (const [base, { spot, perp }] of pairs) {
      const pair = this.createDeltaNeutralPair(base, spot, perp);
      if (pair) {
        deltaNeutralPairs.push(pair);
        
        // Track funding rate distribution
        const rate = pair.perpetual.fundingRate;
        fundingRateCount.set(rate, (fundingRateCount.get(rate) || 0) + 1);
      }
    }
    
    console.log(`Valid pairs with funding rates: ${deltaNeutralPairs.length}`);
    
    // Check for suspicious funding rate patterns
    this.checkDataQuality(fundingRateCount, deltaNeutralPairs.length);
    
    // Apply strategy analysis
    const results: StrategyResult[] = [];
    
    for (const pair of deltaNeutralPairs) {
      const result = this.analyzeStrategy(pair, config);
      
      // Apply filters
      if (this.meetsRequirements(result, config)) {
        results.push(result);
      }
    }
    
    // Sort by return on capital
    results.sort((a, b) => b.returnOnCapital - a.returnOnCapital);
    
    return results;
  }
  
  /**
   * Create a DeltaNeutralPair from ticker data
   */
  private createDeltaNeutralPair(base: string, spot: any, perp: any): DeltaNeutralPair | null {
    try {
      const spotPrice = spot.last || spot.close;
      const perpPrice = perp.last || perp.close;
      
      // More careful funding rate parsing
      const fundingRateStr = perp.info?.fundingRate;
      let fundingRate: number | null = null;
      
      if (fundingRateStr !== undefined && fundingRateStr !== '' && fundingRateStr !== null) {
        fundingRate = parseFloat(fundingRateStr);
        if (isNaN(fundingRate)) {
          console.warn(`Invalid funding rate for ${perp.symbol}: "${fundingRateStr}"`);
          return null;
        }
      } else {
        // No funding rate - might be a futures contract, not perpetual
        console.log(`No funding rate for ${perp.symbol} - skipping`);
        return null;
      }
      
      if (!spotPrice || !perpPrice) {
        return null;
      }
      
      const basis = ((perpPrice - spotPrice) / spotPrice) * 100;
      const basisDollar = perpPrice - spotPrice;
      
      // Bybit funding rate is paid 3 times daily
      const paymentsPerDay = 3;
      const fundingAPR = fundingRate * paymentsPerDay * 365 * 100;
      
      // Calculate net APR (for long spot, short perp strategy)
      // Assume basis decays linearly over 30 days
      const basisDecayDays = 30;
      const annualizedBasisDecay = basis * (365 / basisDecayDays);
      const netAPR = fundingAPR - annualizedBasisDecay;
      
      return {
        base,
        spot: {
          symbol: spot.symbol,
          price: spotPrice,
          timestamp: spot.timestamp || Date.now(),
          bid: spot.bid,
          ask: spot.ask,
          volume24h: spot.quoteVolume
        },
        perpetual: {
          symbol: perp.symbol,
          price: perpPrice,
          timestamp: perp.timestamp || Date.now(),
          bid: perp.bid,
          ask: perp.ask,
          volume24h: perp.quoteVolume,
          fundingRate,
          nextFundingTime: perp.info?.nextFundingTime,
          markPrice: perp.info?.markPrice ? parseFloat(perp.info.markPrice) : undefined,
          indexPrice: perp.info?.indexPrice ? parseFloat(perp.info.indexPrice) : undefined
        },
        basis,
        basisDollar,
        fundingAPR,
        netAPR
      };
    } catch (error) {
      console.error(`Error creating pair for ${base}:`, error);
      return null;
    }
  }
  
  /**
   * Analyze a specific strategy for a pair
   */
  private analyzeStrategy(pair: DeltaNeutralPair, config: StrategyConfig): StrategyResult {
    const leverage = config.leverage || 10;
    const notionalValue = 10000; // $10,000 position
    
    // Calculate position sizes
    const positionSize = this.calculatePositionSize(
      pair,
      notionalValue,
      leverage,
      config.type
    );
    
    // Calculate expected returns
    let netAPR: number;
    const risks: string[] = [];
    const notes: string[] = [];
    
    switch (config.type) {
      case StrategyType.LONG_SPOT_SHORT_PERP:
        netAPR = pair.netAPR;
        if (pair.basis > 0) {
          risks.push(`Positive basis of ${pair.basis.toFixed(2)}% will decay`);
        }
        if (pair.fundingAPR < 0) {
          risks.push(`Negative funding rate: paying ${Math.abs(pair.fundingAPR).toFixed(2)}% APR`);
        }
        break;
        
      case StrategyType.SHORT_SPOT_LONG_PERP:
        // Reverse: gain from basis decay, pay funding
        const annualizedBasisGain = pair.basis * (365 / 30);
        netAPR = annualizedBasisGain - pair.fundingAPR;
        notes.push('Requires spot margin trading (3x leverage on Bybit)');
        if (pair.basis < 0) {
          risks.push(`Negative basis of ${pair.basis.toFixed(2)}% works against position`);
        }
        break;
        
      default:
        netAPR = pair.netAPR;
    }
    
    // Apply fees if requested
    if (config.includeFees) {
      const feeImpact = this.calculateFeeImpact(positionSize, this.defaultFees);
      netAPR -= feeImpact;
      notes.push(`Fees reduce APR by ${feeImpact.toFixed(2)}%`);
    }
    
    // Calculate returns
    const dailyReturn = (netAPR / 365) * positionSize.spotValue / 100;
    const monthlyReturn = dailyReturn * 30;
    const annualReturn = dailyReturn * 365;
    
    // Calculate return on capital
    const returnOnCapital = (annualReturn / positionSize.totalCapital) * 100;
    
    // Add volume warnings
    if (pair.spot.volume24h && pair.spot.volume24h < 1000000) {
      risks.push('Low spot volume (<$1M daily)');
    }
    if (pair.perpetual.volume24h && pair.perpetual.volume24h < 5000000) {
      risks.push('Low perpetual volume (<$5M daily)');
    }
    
    return {
      pair,
      strategy: config.type,
      positionSize,
      expectedReturn: {
        daily: dailyReturn,
        monthly: monthlyReturn,
        annual: annualReturn
      },
      returnOnCapital,
      risks,
      notes
    };
  }
  
  /**
   * Calculate position sizes
   */
  private calculatePositionSize(
    pair: DeltaNeutralPair,
    notionalValue: number,
    leverage: number,
    strategy: StrategyType
  ): PositionSize {
    const spotQuantity = notionalValue / pair.spot.price;
    const perpQuantity = spotQuantity; // Delta neutral
    
    const spotValue = spotQuantity * pair.spot.price;
    const perpValue = perpQuantity * pair.perpetual.price;
    const perpMargin = perpValue / leverage;
    
    let totalCapital: number;
    
    switch (strategy) {
      case StrategyType.LONG_SPOT_SHORT_PERP:
        totalCapital = spotValue + perpMargin;
        break;
        
      case StrategyType.SHORT_SPOT_LONG_PERP:
        // Assume 3x leverage for spot short
        const spotMargin = spotValue / 3;
        totalCapital = spotMargin + perpMargin;
        break;
        
      default:
        totalCapital = spotValue + perpMargin;
    }
    
    return {
      spotQuantity,
      perpQuantity,
      spotValue,
      perpMargin,
      totalCapital
    };
  }
  
  /**
   * Calculate fee impact on APR
   */
  private calculateFeeImpact(_position: PositionSize, fees: FeeStructure): number {
    // Assume one round trip per month (open and close)
    const monthlyTrades = 2;
    const annualTrades = monthlyTrades * 12;
    
    // Use taker fees (conservative)
    const spotFeePerTrade = fees.spotTaker * 2; // Buy and sell
    const perpFeePerTrade = fees.perpTaker * 2; // Open and close
    
    const annualSpotFees = spotFeePerTrade * annualTrades;
    const annualPerpFees = perpFeePerTrade * annualTrades;
    
    const totalFeePercentage = (annualSpotFees + annualPerpFees) * 100;
    
    return totalFeePercentage;
  }
  
  /**
   * Check if result meets requirements
   */
  private meetsRequirements(result: StrategyResult, config: StrategyConfig): boolean {
    if (config.minAPR && result.returnOnCapital < config.minAPR) {
      return false;
    }
    
    if (config.minVolume) {
      const spotVolume = result.pair.spot.volume24h || 0;
      const perpVolume = result.pair.perpetual.volume24h || 0;
      if (spotVolume < config.minVolume || perpVolume < config.minVolume) {
        return false;
      }
    }
    
    if (config.maxBasis && Math.abs(result.pair.basis) > config.maxBasis) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check data quality and warn about suspicious patterns
   */
  private checkDataQuality(fundingRateCount: Map<number, number>, totalPairs: number): void {
    // Find most common funding rate
    let maxCount = 0;
    let mostCommonRate = 0;
    
    for (const [rate, count] of fundingRateCount) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonRate = rate;
      }
    }
    
    const percentage = (maxCount / totalPairs) * 100;
    
    if (percentage > 50) {
      console.warn(`⚠️  WARNING: ${percentage.toFixed(1)}% of pairs have identical funding rate of ${(mostCommonRate * 100).toFixed(4)}%`);
      console.warn(`   This might indicate stale or default data. Consider refreshing market data.`);
    }
    
    // Show funding rate distribution
    console.log('\nFunding Rate Distribution:');
    const sorted = Array.from(fundingRateCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    
    for (const [rate, count] of sorted) {
      const pct = (count / totalPairs * 100).toFixed(1);
      console.log(`  ${(rate * 100).toFixed(4)}%: ${count} pairs (${pct}%)`);
    }
    console.log('');
  }
  
  /**
   * Get summary statistics
   */
  getSummaryStats(results: StrategyResult[]): MarketSummaryStats {
    const pairs = results.map(r => r.pair);
    
    const positiveFunding = pairs.filter(p => p.fundingAPR > 0).length;
    const negativeFunding = pairs.filter(p => p.fundingAPR < 0).length;
    
    const averageBasis = pairs.reduce((sum, p) => sum + p.basis, 0) / pairs.length;
    const averageFundingAPR = pairs.reduce((sum, p) => sum + p.fundingAPR, 0) / pairs.length;
    
    const profitableOpportunities = results.filter(r => r.returnOnCapital > 5).length;
    
    return {
      totalPairs: pairs.length,
      positiveFunding,
      negativeFunding,
      averageBasis,
      averageFundingAPR,
      profitableOpportunities
    };
  }
}