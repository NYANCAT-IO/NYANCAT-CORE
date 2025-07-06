import { 
  DeltaNeutralPair, 
  StrategyType, 
  StrategyConfig, 
  StrategyResult,
  PositionSize,
  FeeStructure,
  MarketSummaryStats
} from './types.js';
import { DataLoader } from './data-loader.js';

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
    
    // Calculate borrowing costs
    const borrowingCostAPR = this.calculateBorrowingCost(positionSize, config.type);
    
    // Adjust net APR for borrowing costs
    const netAPRAfterBorrowing = netAPR - borrowingCostAPR;
    
    // Calculate returns based on position value (not margin)
    const dailyReturn = (netAPRAfterBorrowing / 365) * positionSize.notionalValue / 100;
    const monthlyReturn = dailyReturn * 30;
    const annualReturn = dailyReturn * 365;
    
    // Calculate different ROC metrics
    const leveragedROC = (annualReturn / positionSize.totalCapital) * 100;
    const unleveragedROC = (annualReturn / positionSize.notionalValue) * 100;
    
    // Risk-adjusted ROC: penalize high leverage
    const leveragePenalty = Math.log10(leverage) / 10; // 0.1 for 10x, 0.2 for 100x
    const riskAdjustedROC = leveragedROC * (1 - leveragePenalty);
    
    // Calculate liquidation prices
    const liquidationPrices = this.calculateLiquidationPrices(pair, positionSize, config.type);
    
    // Calculate maximum loss
    const maxLoss = positionSize.totalCapital;
    
    // Add volume warnings
    if (pair.spot.volume24h && pair.spot.volume24h < 1000000) {
      risks.push('Low spot volume (<$1M daily)');
    }
    if (pair.perpetual.volume24h && pair.perpetual.volume24h < 5000000) {
      risks.push('Low perpetual volume (<$5M daily)');
    }
    
    // Add leverage warnings
    if (leverage > 5) {
      risks.push(`High leverage (${leverage}x) increases liquidation risk`);
    }
    
    // Add liquidation warnings
    if (liquidationPrices.perp) {
      const perpDistance = Math.abs(liquidationPrices.perp - pair.perpetual.price) / pair.perpetual.price * 100;
      if (perpDistance < 10) {
        risks.push(`Perp liquidation only ${perpDistance.toFixed(1)}% away`);
      }
    }
    
    // Add borrowing cost note if significant
    if (borrowingCostAPR > 1) {
      notes.push(`Borrowing costs: ${borrowingCostAPR.toFixed(2)}% APR`);
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
      returnOnCapital: leveragedROC,
      unleveragedROC,
      riskAdjustedROC,
      borrowingCostAPR,
      maxLoss,
      liquidationPrice: liquidationPrices,
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
    let spotMargin: number | undefined;
    
    switch (strategy) {
      case StrategyType.LONG_SPOT_SHORT_PERP:
        totalCapital = spotValue + perpMargin;
        break;
        
      case StrategyType.SHORT_SPOT_LONG_PERP:
        // Assume 3x leverage for spot short
        spotMargin = spotValue / 3;
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
      totalCapital,
      leverage,
      notionalValue,
      spotMargin
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
   * Calculate borrowing cost for leveraged positions
   */
  private calculateBorrowingCost(position: PositionSize, strategy: StrategyType): number {
    // Bybit borrowing rates (approximate)
    const USDT_BORROW_RATE = 0.10; // 10% APR for USDT
    const SPOT_MARGIN_RATE = 0.12; // 12% APR for spot margin
    
    let borrowingCostAPR = 0;
    
    // Perpetual borrowing cost
    const perpBorrowed = position.spotValue - position.perpMargin;
    const perpBorrowingCost = (perpBorrowed / position.notionalValue) * USDT_BORROW_RATE;
    borrowingCostAPR += perpBorrowingCost;
    
    // Spot borrowing cost (for short positions)
    if (strategy === StrategyType.SHORT_SPOT_LONG_PERP && position.spotMargin) {
      const spotBorrowed = position.spotValue - position.spotMargin;
      const spotBorrowingCost = (spotBorrowed / position.notionalValue) * SPOT_MARGIN_RATE;
      borrowingCostAPR += spotBorrowingCost;
    }
    
    return borrowingCostAPR * 100; // Convert to percentage
  }
  
  /**
   * Calculate liquidation prices
   */
  private calculateLiquidationPrices(
    pair: DeltaNeutralPair, 
    position: PositionSize, 
    strategy: StrategyType
  ): { spot?: number; perp?: number } {
    const MAINTENANCE_MARGIN_RATE = 0.005; // 0.5% maintenance margin
    
    const liquidationPrices: { spot?: number; perp?: number } = {};
    
    // Perpetual liquidation price
    const perpValue = position.perpQuantity * pair.perpetual.price;
    const perpMaintenanceMargin = perpValue * MAINTENANCE_MARGIN_RATE;
    const perpLiquidationBuffer = position.perpMargin - perpMaintenanceMargin;
    
    if (strategy === StrategyType.LONG_SPOT_SHORT_PERP) {
      // Short perp: liquidates when price rises
      liquidationPrices.perp = pair.perpetual.price * (1 + perpLiquidationBuffer / perpValue);
    } else {
      // Long perp: liquidates when price falls
      liquidationPrices.perp = pair.perpetual.price * (1 - perpLiquidationBuffer / perpValue);
    }
    
    // Spot liquidation price (only for short spot)
    if (strategy === StrategyType.SHORT_SPOT_LONG_PERP && position.spotMargin) {
      const spotMaintenanceMargin = position.spotValue * MAINTENANCE_MARGIN_RATE;
      const spotLiquidationBuffer = position.spotMargin - spotMaintenanceMargin;
      // Short spot: liquidates when price rises
      liquidationPrices.spot = pair.spot.price * (1 + spotLiquidationBuffer / position.spotValue);
    }
    
    return liquidationPrices;
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
    
    // Show market analysis if clustering detected
    if (percentage > 30) {
      console.log('📊 Market Analysis:');
      console.log(`  ${percentage.toFixed(1)}% of pairs have funding rate of ${(mostCommonRate * 100).toFixed(4)}%`);
      console.log('  This is normal market behavior during low volatility periods.');
      console.log('  ');
      console.log('  🔗 Verify live rates: https://www.bybit.com/en/announcement-info/fund-rate/');
      console.log('  📚 Learn more: See docs/funding-rate-clustering-research.md');
      console.log('  ');
      console.log('  During low volatility:');
      console.log('  • Arbitrageurs quickly exploit rate differences');
      console.log('  • Rates converge to common values (0.005%, 0.01%)');
      console.log('  • Major assets (BTC, ETH) may show different rates');
      console.log('');
    }
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