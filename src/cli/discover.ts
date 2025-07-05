#!/usr/bin/env node
import { Command } from 'commander';
import ccxt from 'ccxt';
import { ValidPairsDiscovery } from '../lib/discovery/valid-pairs';
import { writeFileSync } from 'fs';
import { join } from 'path';

const program = new Command();

program
  .name('discover')
  .description('Discover valid delta-neutral trading pairs')
  .option('--exchange <exchange>', 'Exchange to analyze', 'bybit')
  .option('--testnet', 'Use testnet', false)
  .option('--json', 'Output as JSON')
  .option('--save', 'Save results to file')
  .action(async (options) => {
    try {
      // Initialize exchange
      const ExchangeClass = (ccxt as any)[options.exchange];
      if (!ExchangeClass) {
        throw new Error(`Exchange ${options.exchange} not supported`);
      }
      
      const exchange = new ExchangeClass({
        enableRateLimit: true,
        options: {
          defaultType: 'spot'
        }
      });
      
      if (options.testnet) {
        exchange.setSandboxMode(true);
      }
      
      // Discover valid pairs
      const discovery = new ValidPairsDiscovery(exchange);
      const pairs = await discovery.discoverValidPairs();
      
      // Filter delta-neutral capable pairs
      const validPairs = pairs.filter(p => p.isDeltaNeutralCapable);
      const invalidPairs = pairs.filter(p => !p.isDeltaNeutralCapable);
      
      if (options.json) {
        const output = {
          timestamp: new Date().toISOString(),
          exchange: options.exchange,
          testnet: options.testnet,
          summary: {
            total: pairs.length,
            valid: validPairs.length,
            invalid: invalidPairs.length
          },
          validPairs: validPairs.map(p => ({
            symbol: p.symbol,
            spot: p.spotSymbol,
            perp: p.perpSymbol
          })),
          invalidPairs: invalidPairs.map(p => ({
            symbol: p.symbol,
            hasSpot: p.hasSpotMarket,
            hasPerp: p.hasPerpMarket,
            missing: !p.hasSpotMarket ? 'spot' : 'perpetual'
          }))
        };
        
        if (options.save) {
          const filename = `valid-pairs-${options.exchange}-${new Date().toISOString().split('T')[0]}.json`;
          const filepath = join(process.cwd(), 'data', filename);
          writeFileSync(filepath, JSON.stringify(output, null, 2));
          console.log(`Results saved to: ${filepath}`);
        } else {
          console.log(JSON.stringify(output, null, 2));
        }
      } else {
        console.log('\n=== Valid Delta-Neutral Pairs ===');
        console.log(`Found ${validPairs.length} tradeable pairs:\n`);
        
        validPairs.forEach(p => {
          console.log(`✓ ${p.symbol.padEnd(10)} Spot: ${p.spotSymbol.padEnd(15)} Perp: ${p.perpSymbol}`);
        });
        
        if (invalidPairs.length > 0) {
          console.log('\n=== Invalid Pairs (Missing Markets) ===');
          console.log(`Found ${invalidPairs.length} incomplete pairs:\n`);
          
          invalidPairs.slice(0, 10).forEach(p => {
            const missing = !p.hasSpotMarket ? 'spot' : 'perpetual';
            console.log(`✗ ${p.symbol.padEnd(10)} Missing: ${missing}`);
          });
          
          if (invalidPairs.length > 10) {
            console.log(`... and ${invalidPairs.length - 10} more`);
          }
        }
        
        console.log('\n=== Recommended Symbols for Backtesting ===');
        const symbols = discovery.getValidSymbols(pairs);
        console.log(symbols.join(','));
      }
      
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  });

program.parse();