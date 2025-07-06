import { 
  BacktestConfig, 
  ComprehensiveBacktestResult,
  DetailedPosition,
  MonthlyStats,
  SymbolStats,
  OpenPosition,
  FundingSnapshot,
  PriceSnapshot,
  BacktestSummary,
  EquityPoint
} from './types';
import { HistoricalData, DataStorage } from '../historical/index.js';

export class ComprehensiveBacktestEngine {
  private storage: DataStorage;
  
  constructor() {
    this.storage = new DataStorage();
  }
  
  async runBacktest(config: BacktestConfig): Promise<ComprehensiveBacktestResult> {
    // Set defaults
    const endDate = config.endDate || new Date();
    const startDate = config.startDate || new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days default
    const initialCapital = config.initialCapital || 10000;
    const minAPR = config.minAPR || 8;
    
    console.log(`Running comprehensive backtest from ${startDate.toISOString()} to ${endDate.toISOString()}`);
    console.log(`Initial capital: $${initialCapital}, Min APR: ${minAPR}%`);
    
    // Load historical data
    const historicalData = await this.loadHistoricalData(startDate, endDate);
    if (!historicalData) {
      throw new Error('No historical data available for the specified period');
    }
    
    // Generate funding timestamps (every 8 hours: 00:00, 08:00, 16:00 UTC)
    const fundingTimestamps = this.generateFundingTimestamps(startDate.getTime(), endDate.getTime());
    console.log(`Processing ${fundingTimestamps.length} funding periods`);
    
    // Initialize state
    let cash = initialCapital;
    const openPositions = new Map<string, OpenPosition>();
    const detailedPositions: DetailedPosition[] = [];
    const equityCurve: EquityPoint[] = [];
    
    // Track peak for drawdown calculation
    let peak = initialCapital;
    let maxDrawdown = 0;
    
    // Process each funding period
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
      
      // Check exit conditions
      const positionsToClose: Array<{
        symbol: string;
        exitFundingRate: number;
        exitFundingAPR: number;
        exitReason: string;
      }> = [];
      
      for (const [symbol, _] of openPositions) {
        const currentFundingRate = fundingRates.rates.get(symbol) || 0;
        const currentAPR = currentFundingRate * 3 * 365 * 100;
        
        let exitReason = '';
        
        // Exit if funding rate goes negative
        if (currentAPR < 0) {
          exitReason = `Funding turned negative: ${currentAPR.toFixed(1)}% APR`;
        }
        
        if (exitReason) {
          positionsToClose.push({
            symbol,
            exitFundingRate: currentFundingRate,
            exitFundingAPR: currentAPR,
            exitReason
          });
        }
      }
      
      // Close positions with detailed tracking
      for (const closeInfo of positionsToClose) {
        const { symbol, exitFundingRate, exitFundingAPR, exitReason } = closeInfo;
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
        
        // Calculate time metrics
        const holdingPeriodHours = (timestamp - position.entryTime) / (1000 * 60 * 60);
        
        detailedPositions.push({
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
          exitFees
        });
        
        // Return capital
        cash += position.quantity * exitSpotPrice;
        openPositions.delete(symbol);
        
        console.log(`Closed ${symbol}: ${exitReason}, P&L $${totalPnL.toFixed(2)}`);
      }
      
      // Find new opportunities
      const opportunities: { symbol: string; apr: number; rate: number }[] = [];
      for (const [symbol, rate] of fundingRates.rates) {
        const apr = rate * 3 * 365 * 100;
        if (apr > 0.1 && !openPositions.has(symbol)) { // Any positive funding > 0.1% APR
          opportunities.push({ symbol, apr, rate });
        }
      }
      
      // Sort by APR and take best opportunities
      opportunities.sort((a, b) => b.apr - a.apr);
      const maxPositions = 5;
      const availableSlots = maxPositions - openPositions.size;
      const toEnter = opportunities.slice(0, availableSlots);
      const concurrentPositions = openPositions.size;
      
      // Enter new positions with detailed tracking
      for (const opp of toEnter) {
        const spotPrice = prices.spotPrices.get(opp.symbol);
        const perpPrice = prices.perpPrices.get(opp.symbol);
        
        if (!spotPrice || !perpPrice) continue;
        
        // Simple position sizing: equal weight
        const positionSize = Math.min(cash * 0.2, cash / availableSlots); // Max 20% per position
        const quantity = positionSize / spotPrice;
        
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
          concurrentPositions: concurrentPositions + 1,
          fundingPeriodsHeld: 0
        });
        
        console.log(`Opened ${opp.symbol} at ${opp.apr.toFixed(2)}% APR (${concurrentPositions + 1} concurrent positions)`);
      }
      
      // Calculate portfolio value
      let portfolioValue = cash;
      for (const [symbol, position] of openPositions) {
        const currentSpotPrice = prices.spotPrices.get(symbol) || position.entrySpotPrice;
        portfolioValue += position.quantity * currentSpotPrice;
      }
      
      // Update equity curve
      equityCurve.push({ timestamp, value: portfolioValue });
      
      // Update drawdown
      if (portfolioValue > peak) {
        peak = portfolioValue;
      }
      const drawdown = (peak - portfolioValue) / peak * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    // Close any remaining positions at end
    const finalPrices = this.getPricesAtTime(historicalData, endDate.getTime());
    const finalFundingRates = this.getFundingRatesAtTime(historicalData, endDate.getTime());
    
    if (finalPrices) {
      for (const [symbol, position] of openPositions) {
        const exitSpotPrice = finalPrices.spotPrices.get(symbol) || position.entrySpotPrice;
        const exitPerpPrice = finalPrices.perpPrices.get(symbol) || position.entryPerpPrice;
        const exitFundingRate = finalFundingRates?.rates.get(symbol) || 0;
        const exitFundingAPR = exitFundingRate * 3 * 365 * 100;
        
        const spotPnL = (exitSpotPrice - position.entrySpotPrice) * position.quantity;
        const perpPnL = (position.entryPerpPrice - exitPerpPrice) * position.quantity;
        const totalFunding = position.fundingPayments.reduce((sum, p) => sum + p, 0);
        const entryFees = position.quantity * position.entrySpotPrice * 0.001;
        const exitFees = position.quantity * exitSpotPrice * 0.001;
        const totalPnL = spotPnL + perpPnL + totalFunding - entryFees - exitFees;
        const holdingPeriodHours = (endDate.getTime() - position.entryTime) / (1000 * 60 * 60);
        
        detailedPositions.push({
          symbol,
          entryTime: position.entryTime,
          exitTime: endDate.getTime(),
          entrySpotPrice: position.entrySpotPrice,
          entryPerpPrice: position.entryPerpPrice,
          exitSpotPrice,
          exitPerpPrice,
          quantity: position.quantity,
          fundingPayments: position.fundingPayments,
          totalPnL,
          entryFundingRate: position.entryFundingRate,
          entryFundingAPR: position.entryFundingAPR,
          concurrentPositions: position.concurrentPositions,
          exitFundingRate,
          exitFundingAPR,
          exitReason: 'Backtest ended',
          holdingPeriodHours,
          fundingPeriodsHeld: position.fundingPeriodsHeld,
          spotPnL,
          perpPnL,
          totalFunding,
          entryFees,
          exitFees
        });
        
        cash += position.quantity * exitSpotPrice;
      }
    }
    
    // Calculate final metrics
    const finalCapital = cash;
    const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
    const totalReturnDollars = finalCapital - initialCapital;
    const winningTrades = detailedPositions.filter(p => p.totalPnL > 0).length;
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    
    const summary: BacktestSummary = {
      initialCapital,
      finalCapital,
      totalReturn,
      totalReturnDollars,
      numberOfTrades: detailedPositions.length,
      winningTrades,
      winRate: detailedPositions.length > 0 ? (winningTrades / detailedPositions.length) * 100 : 0,
      maxDrawdown,
      totalDays
    };
    
    // Calculate monthly stats
    const monthlyStats = this.calculateMonthlyStats(detailedPositions, equityCurve, initialCapital);
    
    // Calculate symbol stats
    const symbolStats = this.calculateSymbolStats(detailedPositions);
    
    // Create basic positions array for backward compatibility
    const positions = detailedPositions.map(dp => ({
      symbol: dp.symbol,
      entryTime: dp.entryTime,
      exitTime: dp.exitTime,
      entrySpotPrice: dp.entrySpotPrice,
      entryPerpPrice: dp.entryPerpPrice,
      exitSpotPrice: dp.exitSpotPrice,
      exitPerpPrice: dp.exitPerpPrice,
      quantity: dp.quantity,
      fundingPayments: dp.fundingPayments,
      totalPnL: dp.totalPnL
    }));
    
    return {
      summary,
      equityCurve,
      positions,
      config: {
        startDate,
        endDate,
        initialCapital,
        minAPR
      },
      detailedPositions,
      monthlyStats,
      symbolStats
    };
  }
  
  private calculateMonthlyStats(
    positions: DetailedPosition[], 
    equityCurve: EquityPoint[],
    initialCapital: number
  ): MonthlyStats[] {
    const monthlyData = new Map<string, {
      trades: DetailedPosition[];
      startValue: number;
      endValue: number;
    }>();
    
    // Group positions by month
    for (const position of positions) {
      const exitDate = new Date(position.exitTime);
      const monthKey = `${exitDate.getFullYear()}-${String(exitDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, { trades: [], startValue: 0, endValue: 0 });
      }
      
      monthlyData.get(monthKey)!.trades.push(position);
    }
    
    // Calculate equity values for each month
    for (const point of equityCurve) {
      const date = new Date(point.timestamp);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (monthlyData.has(monthKey)) {
        const data = monthlyData.get(monthKey)!;
        if (data.startValue === 0) {
          data.startValue = point.value;
        }
        data.endValue = point.value;
      }
    }
    
    // Convert to monthly stats
    const stats: MonthlyStats[] = [];
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    
    let prevValue = initialCapital;
    for (const month of sortedMonths) {
      const data = monthlyData.get(month)!;
      const startValue = data.startValue || prevValue;
      const endValue = data.endValue || startValue;
      
      const profit = data.trades.reduce((sum, t) => sum + t.totalPnL, 0);
      const winningTrades = data.trades.filter(t => t.totalPnL > 0).length;
      
      stats.push({
        month,
        trades: data.trades.length,
        profit,
        return: startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0,
        winRate: data.trades.length > 0 ? (winningTrades / data.trades.length) * 100 : 0
      });
      
      prevValue = endValue;
    }
    
    return stats;
  }
  
  private calculateSymbolStats(positions: DetailedPosition[]): Map<string, SymbolStats> {
    const symbolData = new Map<string, DetailedPosition[]>();
    
    // Group by symbol
    for (const position of positions) {
      if (!symbolData.has(position.symbol)) {
        symbolData.set(position.symbol, []);
      }
      symbolData.get(position.symbol)!.push(position);
    }
    
    // Calculate stats
    const stats = new Map<string, SymbolStats>();
    
    for (const [symbol, symbolPositions] of symbolData) {
      const totalPnL = symbolPositions.reduce((sum, p) => sum + p.totalPnL, 0);
      const totalFunding = symbolPositions.reduce((sum, p) => sum + p.totalFunding, 0);
      const winningTrades = symbolPositions.filter(p => p.totalPnL > 0).length;
      const avgHoldingHours = symbolPositions.reduce((sum, p) => sum + p.holdingPeriodHours, 0) / symbolPositions.length;
      const avgFundingAPR = symbolPositions.reduce((sum, p) => sum + p.entryFundingAPR, 0) / symbolPositions.length;
      
      stats.set(symbol, {
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
    
    return stats;
  }
  
  // Copy helper methods from SimpleBacktestEngine
  private async loadHistoricalData(startDate: Date, endDate: Date): Promise<HistoricalData | null> {
    const data = await this.storage.loadHistoricalData(startDate.getTime(), endDate.getTime());
    if (data) {
      return data;
    }
    
    const overlapping = await this.storage.findOverlappingCache(startDate.getTime(), endDate.getTime());
    if (overlapping.length > 0) {
      const cache = overlapping[0];
      if (cache) {
        return await this.storage.loadHistoricalData(cache.dataRange.start, cache.dataRange.end);
      }
    }
    
    return null;
  }
  
  private generateFundingTimestamps(startTime: number, endTime: number): number[] {
    const timestamps: number[] = [];
    const startDate = new Date(startTime);
    const firstFunding = new Date(startDate);
    firstFunding.setUTCHours(Math.ceil(startDate.getUTCHours() / 8) * 8, 0, 0, 0);
    
    let current = firstFunding.getTime();
    while (current <= endTime) {
      timestamps.push(current);
      current += 8 * 60 * 60 * 1000; // Add 8 hours
    }
    
    return timestamps;
  }
  
  private getFundingRatesAtTime(data: HistoricalData, timestamp: number): FundingSnapshot | null {
    const rates = new Map<string, number>();
    
    for (const [symbol, fundingRates] of data.fundingRates) {
      let rate = 0;
      for (const fr of fundingRates) {
        if (fr.timestamp <= timestamp) {
          rate = fr.rate;
        } else {
          break;
        }
      }
      
      if (rate !== 0) {
        rates.set(symbol, rate);
      }
    }
    
    return rates.size > 0 ? { timestamp, rates } : null;
  }
  
  private getPricesAtTime(data: HistoricalData, timestamp: number): PriceSnapshot | null {
    const spotPrices = new Map<string, number>();
    const perpPrices = new Map<string, number>();
    
    for (const [symbol, candles] of data.spotPrices) {
      const candle = this.findCandleAtTime(candles, timestamp);
      if (candle) {
        spotPrices.set(symbol, candle.close);
      }
    }
    
    for (const [symbol, candles] of data.perpPrices) {
      const candle = this.findCandleAtTime(candles, timestamp);
      if (candle) {
        perpPrices.set(symbol, candle.close);
      }
    }
    
    return spotPrices.size > 0 && perpPrices.size > 0 
      ? { timestamp, spotPrices, perpPrices } 
      : null;
  }
  
  private findCandleAtTime(candles: any[], timestamp: number): any {
    let lastCandle = null;
    
    for (const candle of candles) {
      if (candle.timestamp <= timestamp) {
        lastCandle = candle;
      } else {
        break;
      }
    }
    
    return lastCandle;
  }
}