import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { MarketDataFile } from './types';

export class DataLoader {
  private dataPath: string;
  
  constructor(dataPath: string = './data/bybit') {
    this.dataPath = dataPath;
  }
  
  /**
   * Find the latest file of a given type
   */
  private findLatestFile(type: 'markets' | 'tickers' | 'summary'): string | null {
    try {
      const files = readdirSync(this.dataPath);
      const typeFiles = files
        .filter(f => f.includes(`-${type}.json`))
        .sort()
        .reverse();
      
      return typeFiles.length > 0 ? join(this.dataPath, typeFiles[0]!) : null;
    } catch (error) {
      console.error(`Error finding ${type} files:`, error);
      return null;
    }
  }
  
  /**
   * Load a JSON file
   */
  private loadJsonFile(filePath: string): any {
    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error loading file ${filePath}:`, error);
      return null;
    }
  }
  
  /**
   * Load the latest markets data
   */
  loadMarkets(): any[] {
    const filePath = this.findLatestFile('markets');
    if (!filePath) {
      throw new Error('No markets file found');
    }
    
    const data = this.loadJsonFile(filePath);
    return data || [];
  }
  
  /**
   * Load the latest tickers data
   */
  loadTickers(): MarketDataFile | null {
    const filePath = this.findLatestFile('tickers');
    if (!filePath) {
      throw new Error('No tickers file found');
    }
    
    return this.loadJsonFile(filePath);
  }
  
  /**
   * Load the latest summary data
   */
  loadSummary(): any {
    const filePath = this.findLatestFile('summary');
    if (!filePath) {
      throw new Error('No summary file found');
    }
    
    return this.loadJsonFile(filePath);
  }
  
  /**
   * Load all data (markets, tickers, summary)
   */
  loadAllData(): {
    markets: any[];
    tickers: any[];
    summary: any;
    timestamp: string;
  } {
    const markets = this.loadMarkets();
    const tickerData = this.loadTickers();
    const summary = this.loadSummary();
    
    if (!tickerData || !tickerData.tickers) {
      throw new Error('Invalid ticker data structure');
    }
    
    return {
      markets,
      tickers: tickerData.tickers,
      summary,
      timestamp: tickerData.timestamp || new Date().toISOString()
    };
  }
  
  /**
   * Get spot and perpetual tickers separately
   */
  splitTickers(tickers: any[]): {
    spot: any[];
    perpetual: any[];
  } {
    const spot = tickers.filter(t => !t.symbol.includes(':'));
    const perpetual = tickers.filter(t => t.symbol.includes(':'));
    
    return { spot, perpetual };
  }
  
  /**
   * Find matching spot and perpetual pairs
   */
  findMatchingPairs(tickers: any[]): Map<string, { spot?: any; perp?: any }> {
    const pairs = new Map<string, { spot?: any; perp?: any }>();
    
    for (const ticker of tickers) {
      const base = this.extractBase(ticker.symbol);
      if (!base) continue;
      
      const existing = pairs.get(base) || {};
      
      if (ticker.symbol.includes(':')) {
        // Check if it's a perpetual (no date) vs futures (has date)
        const symbolParts = ticker.symbol.split(':');
        if (symbolParts.length >= 2) {
          const settlePart = symbolParts[1];
          // Skip if it has a date (futures contract)
          if (settlePart.includes('-') && /\d{6}/.test(settlePart)) {
            continue;
          }
        }
        
        // Only use as perpetual if it has funding rate
        if (ticker.info?.fundingRate !== undefined && 
            ticker.info?.fundingRate !== '' && 
            ticker.info?.fundingRate !== null) {
          existing.perp = ticker;
        }
      } else if (ticker.symbol.includes('/USDT')) {
        // Spot (prioritize USDT pairs)
        existing.spot = ticker;
      }
      
      pairs.set(base, existing);
    }
    
    // Filter out pairs without both spot and perp
    const completePairs = new Map<string, { spot: any; perp: any }>();
    for (const [base, data] of pairs) {
      if (data.spot && data.perp) {
        completePairs.set(base, data as { spot: any; perp: any });
      }
    }
    
    return completePairs;
  }
  
  /**
   * Extract base currency from symbol
   */
  private extractBase(symbol: string): string {
    // Handle symbols like "BTC/USDT" or "BTC/USDT:USDT"
    const parts = symbol.split('/');
    return parts.length > 0 ? parts[0]! : '';
  }
  
  /**
   * Get available data files info
   */
  getAvailableFiles(): {
    markets: string[];
    tickers: string[];
    summaries: string[];
  } {
    try {
      const files = readdirSync(this.dataPath);
      
      return {
        markets: files.filter(f => f.includes('-markets.json')).sort().reverse(),
        tickers: files.filter(f => f.includes('-tickers.json')).sort().reverse(),
        summaries: files.filter(f => f.includes('-summary.json')).sort().reverse()
      };
    } catch (error) {
      return {
        markets: [],
        tickers: [],
        summaries: []
      };
    }
  }
}