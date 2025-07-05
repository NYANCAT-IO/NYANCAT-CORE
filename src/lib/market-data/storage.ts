import fs from 'fs';
import path from 'path';
import { MarketSummary } from './types';

export class DataStorage {
  private dataDir: string;

  constructor(baseDir: string = './data') {
    this.dataDir = baseDir;
    this.ensureDirectory(path.join(this.dataDir, 'bybit'));
  }

  private ensureDirectory(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private getTimestamp(): string {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }

  saveMarkets(markets: any[]): string {
    const filename = `${this.getTimestamp()}-markets.json`;
    const filepath = path.join(this.dataDir, 'bybit', filename);
    
    const data = {
      timestamp: new Date().toISOString(),
      count: markets.length,
      markets
    };
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }

  saveTickers(tickers: any[]): string {
    const filename = `${this.getTimestamp()}-tickers.json`;
    const filepath = path.join(this.dataDir, 'bybit', filename);
    
    const data = {
      timestamp: new Date().toISOString(),
      count: tickers.length,
      tickers
    };
    
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    return filepath;
  }

  saveSummary(summary: MarketSummary): string {
    const filename = `${this.getTimestamp()}-summary.json`;
    const filepath = path.join(this.dataDir, 'bybit', filename);
    
    fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
    return filepath;
  }
}