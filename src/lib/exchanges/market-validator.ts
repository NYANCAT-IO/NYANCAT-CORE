import ccxt from 'ccxt';
import { MarketInfo, ValidatedPair, DiscoveryResult } from './types.js';

export class MarketValidator {
  private exchange: any;
  private minSpotVolumeUSD = 0; // No minimum for hackathon
  private minPerpVolumeUSD = 0; // No minimum for hackathon

  constructor() {
    this.exchange = new ccxt.bybit({
      enableRateLimit: true,
      options: {
        defaultType: 'unified',
      }
    });
  }

  setVolumeThresholds(spotVolume: number, perpVolume: number) {
    this.minSpotVolumeUSD = spotVolume;
    this.minPerpVolumeUSD = perpVolume;
  }

  async discoverAllValidPairs(): Promise<DiscoveryResult> {
    console.log('🔍 Discovering all tradeable delta-neutral pairs on Bybit...');
    
    // Step 1: Load all markets
    await this.exchange.loadMarkets();
    const allMarkets = Object.values(this.exchange.markets);
    
    
    // Step 2: Separate spots and perpetuals
    const spotMarkets = this.filterSpotMarkets(allMarkets);
    const perpMarkets = this.filterPerpetualMarkets(allMarkets);
    
    console.log(`Found ${spotMarkets.length} spot markets`);
    console.log(`Found ${perpMarkets.length} perpetual markets`);
    
    // Step 3: Match perpetuals with spots
    const validatedPairs = await this.matchAndValidatePairs(
      spotMarkets, 
      perpMarkets
    );
    
    // Step 4: Analyze results
    const result = this.analyzeResults(
      spotMarkets,
      perpMarkets,
      validatedPairs
    );
    
    return result;
  }

  private filterSpotMarkets(markets: any[]): MarketInfo[] {
    return markets
      .filter(m => m.spot && m.active && m.quote === 'USDT')
      .map(m => ({
        symbol: m.symbol,
        type: 'spot' as const,
        active: m.active,
        base: m.base,
        quote: m.quote,
        volume24h: m.info?.volume_24h ? parseFloat(m.info.volume_24h) : 0,
        volumeUSD24h: m.info?.turnover_24h ? parseFloat(m.info.turnover_24h) : 0
      }));
  }

  private filterPerpetualMarkets(markets: any[]): MarketInfo[] {
    return markets
      .filter(m => m.swap && m.linear && m.active && m.settle === 'USDT')
      .map(m => ({
        symbol: m.symbol,
        type: 'swap' as const,
        active: m.active,
        base: m.base,
        quote: m.quote,
        settle: m.settle,
        volume24h: m.info?.volume_24h ? parseFloat(m.info.volume_24h) : 0,
        volumeUSD24h: m.info?.turnover_24h ? parseFloat(m.info.turnover_24h) : 0
      }));
  }

  private async matchAndValidatePairs(
    spots: MarketInfo[], 
    perps: MarketInfo[]
  ): Promise<ValidatedPair[]> {
    const validPairs: ValidatedPair[] = [];
    const spotMap = new Map(spots.map(s => [s.base, s]));
    
    for (const perp of perps) {
      const matchingSpot = spotMap.get(perp.base);
      
      if (matchingSpot) {
        const validPair: ValidatedPair = {
          symbol: perp.symbol,
          spotSymbol: matchingSpot.symbol,
          perpSymbol: perp.symbol,
          base: perp.base,
          quote: perp.quote,
          spotVolume24h: matchingSpot.volumeUSD24h || 0,
          perpVolume24h: perp.volumeUSD24h || 0,
          hasLiquidSpot: (matchingSpot.volumeUSD24h || 0) >= this.minSpotVolumeUSD,
          hasLiquidPerp: (perp.volumeUSD24h || 0) >= this.minPerpVolumeUSD,
          isValid: false, // will set below
          discoveredAt: new Date()
        };
        
        // For hackathon: valid if both markets exist (ignore volume for now)
        validPair.isValid = true; // Both markets exist, that's enough
        
        validPairs.push(validPair);
      }
    }
    
    // Sort by total volume (best opportunities first)
    validPairs.sort((a, b) => 
      (b.spotVolume24h + b.perpVolume24h) - (a.spotVolume24h + a.perpVolume24h)
    );
    
    return validPairs;
  }

  private analyzeResults(
    spots: MarketInfo[],
    perps: MarketInfo[],
    validatedPairs: ValidatedPair[]
  ): DiscoveryResult {
    const validPairs = validatedPairs.filter(p => p.isValid);
    const invalidPerpetuals = perps
      .filter(p => !validatedPairs.find(vp => vp.perpSymbol === p.symbol))
      .map(p => p.symbol);
    const lowLiquidityPairs = validatedPairs
      .filter(p => !p.isValid)
      .map(p => p.symbol);
    
    const result: DiscoveryResult = {
      totalPerpetuals: perps.length,
      totalSpots: spots.length,
      validPairs,
      invalidPerpetuals,
      lowLiquidityPairs,
      timestamp: new Date()
    };
    
    // Print summary
    console.log('\n📊 Discovery Summary:');
    console.log(`Total perpetual markets: ${result.totalPerpetuals}`);
    console.log(`Total spot markets: ${result.totalSpots}`);
    console.log(`Valid delta-neutral pairs: ${result.validPairs.length}`);
    console.log(`Perpetuals without spot: ${result.invalidPerpetuals.length}`);
    console.log(`Low liquidity pairs: ${result.lowLiquidityPairs.length}`);
    
    // Show top 10 by volume
    console.log('\n🏆 Top 10 Pairs by Volume:');
    result.validPairs.slice(0, 10).forEach((pair, i) => {
      const totalVolume = pair.spotVolume24h + pair.perpVolume24h;
      console.log(`${i + 1}. ${pair.base} - $${(totalVolume / 1_000_000).toFixed(1)}M`);
    });
    
    return result;
  }

  async saveDiscoveryResults(result: DiscoveryResult): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Save full results
    const fullPath = path.join(dataDir, 'discovery-results.json');
    await fs.writeFile(
      fullPath,
      JSON.stringify(result, null, 2)
    );
    
    // Save just the valid pairs for easy loading
    const validPairsPath = path.join(dataDir, 'valid-pairs.json');
    await fs.writeFile(
      validPairsPath,
      JSON.stringify({
        pairs: result.validPairs.map(p => p.symbol),
        count: result.validPairs.length,
        timestamp: result.timestamp
      }, null, 2)
    );
    
    console.log(`\n✅ Results saved to ${validPairsPath}`);
  }
}