import { 
  BacktestConfig, 
  BacktestResult, 
  Position,
  FundingSnapshot,
  PriceSnapshot,
  BacktestSummary,
  EquityPoint
} from './types';
import { HistoricalData, DataStorage } from '../historical';

// Simple open position type for basic backtest
interface SimpleOpenPosition {
  symbol: string;
  entryTime: number;
  entrySpotPrice: number;
  entryPerpPrice: number;
  quantity: number;
  fundingPayments: number[];
}

export class SimpleBacktestEngine {
  private storage: DataStorage;
  
  constructor() {
    this.storage = new DataStorage();
  }
  
  async runBacktest(config: BacktestConfig): Promise<BacktestResult> {
    // Set defaults
    const endDate = config.endDate || new Date();
    const startDate = config.startDate || new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const initialCapital = config.initialCapital || 10000;
    const minAPR = config.minAPR || 8;
    
    console.log(`Running backtest from ${startDate.toISOString()} to ${endDate.toISOString()}`);
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
    const openPositions = new Map<string, SimpleOpenPosition>();
    const closedPositions: Position[] = [];
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
          cash += fundingPayment;
        }
      }
      
      // Check exit conditions
      const positionsToClose: string[] = [];
      for (const [symbol, _] of openPositions) {
        const currentFundingRate = fundingRates.rates.get(symbol) || 0;
        const currentAPR = currentFundingRate * 3 * 365 * 100;
        
        // Exit if funding rate goes negative
        if (currentAPR < 0) {
          positionsToClose.push(symbol);
        }
      }
      
      // Close positions
      for (const symbol of positionsToClose) {
        const position = openPositions.get(symbol)!;
        const exitSpotPrice = prices.spotPrices.get(symbol)!;
        const exitPerpPrice = prices.perpPrices.get(symbol)!;
        
        // Calculate final P&L
        const spotPnL = (exitSpotPrice - position.entrySpotPrice) * position.quantity;
        const perpPnL = (position.entryPerpPrice - exitPerpPrice) * position.quantity;
        const totalFunding = position.fundingPayments.reduce((sum, p) => sum + p, 0);
        const tradingFees = position.quantity * (position.entrySpotPrice + exitSpotPrice) * 0.001; // 0.1% fees
        
        const totalPnL = spotPnL + perpPnL + totalFunding - tradingFees;
        
        closedPositions.push({
          symbol,
          entryTime: position.entryTime,
          exitTime: timestamp,
          entrySpotPrice: position.entrySpotPrice,
          entryPerpPrice: position.entryPerpPrice,
          exitSpotPrice,
          exitPerpPrice,
          quantity: position.quantity,
          fundingPayments: position.fundingPayments,
          totalPnL
        });
        
        // Return capital
        cash += position.quantity * exitSpotPrice;
        openPositions.delete(symbol);
        
        console.log(`Closed ${symbol}: P&L $${totalPnL.toFixed(2)}`);
      }
      
      // Find new opportunities
      const opportunities: { symbol: string; apr: number }[] = [];
      for (const [symbol, rate] of fundingRates.rates) {
        const apr = rate * 3 * 365 * 100;
        if (apr > 0.1 && !openPositions.has(symbol)) { // Any positive funding > 0.1% APR
          opportunities.push({ symbol, apr });
        }
      }
      
      // Sort by APR and take best opportunities
      opportunities.sort((a, b) => b.apr - a.apr);
      const maxPositions = 5;
      const availableSlots = maxPositions - openPositions.size;
      const toEnter = opportunities.slice(0, availableSlots);
      
      // Enter new positions
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
          fundingPayments: []
        });
        
        console.log(`Opened ${opp.symbol} at ${opp.apr.toFixed(2)}% APR`);
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
    if (finalPrices) {
      for (const [symbol, position] of openPositions) {
        const exitSpotPrice = finalPrices.spotPrices.get(symbol) || position.entrySpotPrice;
        const exitPerpPrice = finalPrices.perpPrices.get(symbol) || position.entryPerpPrice;
        
        const spotPnL = (exitSpotPrice - position.entrySpotPrice) * position.quantity;
        const perpPnL = (position.entryPerpPrice - exitPerpPrice) * position.quantity;
        const totalFunding = position.fundingPayments.reduce((sum, p) => sum + p, 0);
        const tradingFees = position.quantity * (position.entrySpotPrice + exitSpotPrice) * 0.001;
        
        const totalPnL = spotPnL + perpPnL + totalFunding - tradingFees;
        
        closedPositions.push({
          symbol,
          entryTime: position.entryTime,
          exitTime: endDate.getTime(),
          entrySpotPrice: position.entrySpotPrice,
          entryPerpPrice: position.entryPerpPrice,
          exitSpotPrice,
          exitPerpPrice,
          quantity: position.quantity,
          fundingPayments: position.fundingPayments,
          totalPnL
        });
        
        cash += position.quantity * exitSpotPrice;
      }
    }
    
    // Calculate final metrics
    const finalCapital = cash;
    const totalReturn = ((finalCapital - initialCapital) / initialCapital) * 100;
    const totalReturnDollars = finalCapital - initialCapital;
    const winningTrades = closedPositions.filter(p => p.totalPnL > 0).length;
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
    
    const summary: BacktestSummary = {
      initialCapital,
      finalCapital,
      totalReturn,
      totalReturnDollars,
      numberOfTrades: closedPositions.length,
      winningTrades,
      winRate: closedPositions.length > 0 ? (winningTrades / closedPositions.length) * 100 : 0,
      maxDrawdown,
      totalDays
    };
    
    return {
      summary,
      equityCurve,
      positions: closedPositions,
      config: {
        startDate,
        endDate,
        initialCapital,
        minAPR
      }
    };
  }
  
  private async loadHistoricalData(startDate: Date, endDate: Date): Promise<HistoricalData | null> {
    // Try to load from cache
    const data = await this.storage.loadHistoricalData(startDate.getTime(), endDate.getTime());
    if (data) {
      return data;
    }
    
    // Check if we have overlapping cache
    const overlapping = await this.storage.findOverlappingCache(startDate.getTime(), endDate.getTime());
    if (overlapping.length > 0) {
      // Use the first overlapping cache
      const cache = overlapping[0];
      if (cache) {
        return await this.storage.loadHistoricalData(cache.dataRange.start, cache.dataRange.end);
      }
    }
    
    return null;
  }
  
  private generateFundingTimestamps(startTime: number, endTime: number): number[] {
    const timestamps: number[] = [];
    
    // Start from the first funding time after start
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
      // Find the funding rate at or just before this timestamp
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
    
    // For each symbol, find the price at or just before this timestamp
    for (const symbol of data.metadata.symbols) {
      const spotCandles = data.spotPrices.get(symbol);
      const perpCandles = data.perpPrices.get(symbol);
      
      if (spotCandles && spotCandles.length > 0) {
        // Find closest candle
        let spotPrice = spotCandles[0]!.close;
        for (const candle of spotCandles) {
          if (candle.timestamp <= timestamp) {
            spotPrice = candle.close;
          } else {
            break;
          }
        }
        spotPrices.set(symbol, spotPrice);
      }
      
      if (perpCandles && perpCandles.length > 0) {
        let perpPrice = perpCandles[0]!.close;
        for (const candle of perpCandles) {
          if (candle.timestamp <= timestamp) {
            perpPrice = candle.close;
          } else {
            break;
          }
        }
        perpPrices.set(symbol, perpPrice);
      }
    }
    
    return spotPrices.size > 0 ? { timestamp, spotPrices, perpPrices } : null;
  }
}