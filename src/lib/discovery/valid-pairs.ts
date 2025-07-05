export interface ValidPair {
  symbol: string;
  spotSymbol: string;
  perpSymbol: string;
  hasSpotMarket: boolean;
  hasPerpMarket: boolean;
  isDeltaNeutralCapable: boolean;
}

export class ValidPairsDiscovery {
  private exchange: any;
  
  constructor(exchange: any) {
    this.exchange = exchange;
  }
  
  async discoverValidPairs(): Promise<ValidPair[]> {
    console.log('Discovering valid delta-neutral pairs...');
    
    // Load markets
    await this.exchange.loadMarkets();
    const markets = this.exchange.markets;
    
    // Group markets by base currency
    const pairGroups = new Map<string, { spot?: any; perp?: any }>();
    
    for (const [symbol, market] of Object.entries(markets)) {
      const m = market as any;
      
      // Skip if not USDT quoted
      if (!symbol.includes('USDT')) continue;
      
      // Get base currency
      const base = m.base;
      if (!base) continue;
      
      if (!pairGroups.has(base)) {
        pairGroups.set(base, {});
      }
      
      const group = pairGroups.get(base)!;
      
      // Categorize by market type
      if (m.type === 'spot' && symbol.endsWith('/USDT')) {
        group.spot = { symbol, market: m };
      } else if (m.type === 'swap' && m.linear && symbol.endsWith('/USDT:USDT')) {
        group.perp = { symbol, market: m };
      }
    }
    
    // Build valid pairs list
    const validPairs: ValidPair[] = [];
    
    for (const [base, group] of pairGroups) {
      const spotSymbol = group.spot?.symbol || `${base}/USDT`;
      const perpSymbol = group.perp?.symbol || `${base}/USDT:USDT`;
      
      validPairs.push({
        symbol: base,
        spotSymbol,
        perpSymbol,
        hasSpotMarket: !!group.spot,
        hasPerpMarket: !!group.perp,
        isDeltaNeutralCapable: !!(group.spot && group.perp)
      });
    }
    
    // Sort by capability and name
    validPairs.sort((a, b) => {
      if (a.isDeltaNeutralCapable !== b.isDeltaNeutralCapable) {
        return b.isDeltaNeutralCapable ? 1 : -1;
      }
      return a.symbol.localeCompare(b.symbol);
    });
    
    // Log summary
    const capable = validPairs.filter(p => p.isDeltaNeutralCapable);
    const spotOnly = validPairs.filter(p => p.hasSpotMarket && !p.hasPerpMarket);
    const perpOnly = validPairs.filter(p => !p.hasSpotMarket && p.hasPerpMarket);
    
    console.log(`\nDiscovery Summary:`);
    console.log(`- Total pairs analyzed: ${validPairs.length}`);
    console.log(`- Delta-neutral capable: ${capable.length}`);
    console.log(`- Spot only: ${spotOnly.length}`);
    console.log(`- Perpetual only: ${perpOnly.length}`);
    
    return validPairs;
  }
  
  getValidSymbols(pairs: ValidPair[]): string[] {
    return pairs
      .filter(p => p.isDeltaNeutralCapable)
      .map(p => p.perpSymbol);
  }
}