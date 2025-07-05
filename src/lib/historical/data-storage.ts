import fs from 'fs/promises';
import path from 'path';
import { HistoricalData, CacheMetadata } from './types';

export class DataStorage {
  private basePath: string;
  private cacheVersion = '1.0.0';

  constructor(basePath: string = 'data/historical') {
    this.basePath = basePath;
  }

  async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      console.error('Failed to create directory:', error);
    }
  }

  private getCacheFileName(startTime: number, endTime: number): string {
    const startDate = new Date(startTime).toISOString().split('T')[0];
    const endDate = new Date(endTime).toISOString().split('T')[0];
    return `cache_${startDate}_to_${endDate}.json`;
  }

  async saveHistoricalData(data: HistoricalData): Promise<void> {
    await this.ensureDirectoryExists();

    const metadata: CacheMetadata = {
      version: this.cacheVersion,
      createdAt: Date.now(),
      dataRange: {
        start: data.metadata.startTime,
        end: data.metadata.endTime,
      },
      symbols: data.metadata.symbols,
      recordCount: {
        fundingRates: Array.from(data.fundingRates.values()).reduce((sum, rates) => sum + rates.length, 0),
        spotPrices: Array.from(data.spotPrices.values()).reduce((sum, prices) => sum + prices.length, 0),
        perpPrices: Array.from(data.perpPrices.values()).reduce((sum, prices) => sum + prices.length, 0),
      },
    };

    // Convert Maps to serializable format
    const serializable = {
      metadata,
      fundingRates: Object.fromEntries(data.fundingRates),
      spotPrices: Object.fromEntries(data.spotPrices),
      perpPrices: Object.fromEntries(data.perpPrices),
    };

    const fileName = this.getCacheFileName(data.metadata.startTime, data.metadata.endTime);
    const filePath = path.join(this.basePath, fileName);

    await fs.writeFile(filePath, JSON.stringify(serializable, null, 2));
    console.log(`Historical data saved to ${filePath}`);
  }

  async loadHistoricalData(startTime: number, endTime: number): Promise<HistoricalData | null> {
    const fileName = this.getCacheFileName(startTime, endTime);
    const filePath = path.join(this.basePath, fileName);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);

      // Validate cache version
      if (parsed.metadata.version !== this.cacheVersion) {
        console.warn('Cache version mismatch, ignoring cached data');
        return null;
      }

      // Convert back to Maps
      const historicalData: HistoricalData = {
        fundingRates: new Map(Object.entries(parsed.fundingRates)),
        spotPrices: new Map(Object.entries(parsed.spotPrices)),
        perpPrices: new Map(Object.entries(parsed.perpPrices)),
        metadata: {
          startTime: parsed.metadata.dataRange.start,
          endTime: parsed.metadata.dataRange.end,
          symbols: parsed.metadata.symbols,
          fetchedAt: parsed.metadata.createdAt,
        },
      };

      console.log(`Loaded cached data from ${filePath}`);
      return historicalData;
    } catch (error) {
      if ((error as any).code !== 'ENOENT') {
        console.error('Error loading cached data:', error);
      }
      return null;
    }
  }

  async listCachedRanges(): Promise<CacheMetadata[]> {
    await this.ensureDirectoryExists();
    
    try {
      const files = await fs.readdir(this.basePath);
      const cacheFiles = files.filter(f => f.startsWith('cache_') && f.endsWith('.json'));
      
      const metadataList: CacheMetadata[] = [];
      
      for (const file of cacheFiles) {
        try {
          const content = await fs.readFile(path.join(this.basePath, file), 'utf-8');
          const parsed = JSON.parse(content);
          if (parsed.metadata) {
            metadataList.push(parsed.metadata);
          }
        } catch (error) {
          console.warn(`Failed to read cache file ${file}:`, error);
        }
      }
      
      return metadataList.sort((a, b) => a.dataRange.start - b.dataRange.start);
    } catch (error) {
      console.error('Error listing cached ranges:', error);
      return [];
    }
  }

  async findOverlappingCache(startTime: number, endTime: number): Promise<CacheMetadata[]> {
    const allCaches = await this.listCachedRanges();
    
    return allCaches.filter(cache => 
      cache.dataRange.start <= endTime && cache.dataRange.end >= startTime
    );
  }

  async clearCache(): Promise<void> {
    await this.ensureDirectoryExists();
    
    try {
      const files = await fs.readdir(this.basePath);
      const cacheFiles = files.filter(f => f.startsWith('cache_') && f.endsWith('.json'));
      
      for (const file of cacheFiles) {
        await fs.unlink(path.join(this.basePath, file));
      }
      
      console.log(`Cleared ${cacheFiles.length} cache files`);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }
}