#!/usr/bin/env node

import { Command } from 'commander';
import { MarketValidator } from '../lib/exchanges/market-validator.js';

const program = new Command();

program
  .name('discover-pairs')
  .description('Discover all valid delta-neutral trading pairs on Bybit')
  .option('--min-spot-volume <amount>', 'Minimum spot volume in USD', '1000000')
  .option('--min-perp-volume <amount>', 'Minimum perp volume in USD', '5000000')
  .option('--save', 'Save results to file', true)
  .action(async (options) => {
    try {
      console.log('🚀 Starting market discovery...\n');
      
      const validator = new MarketValidator();
      
      // Override volume thresholds if provided
      if (options.minSpotVolume) {
        (validator as any).minSpotVolumeUSD = parseFloat(options.minSpotVolume);
      }
      if (options.minPerpVolume) {
        (validator as any).minPerpVolumeUSD = parseFloat(options.minPerpVolume);
      }
      
      // Discover all valid pairs
      const result = await validator.discoverAllValidPairs();
      
      // Save results
      if (options.save) {
        await validator.saveDiscoveryResults(result);
      }
      
      // Show actionable summary
      console.log('\n💡 Next Steps:');
      console.log('1. Run: pnpm fetch-historical --valid-only');
      console.log('2. Run: pnpm backtest --days 90 --report comprehensive');
      console.log('3. Analyze results to find best performing pairs');
      
    } catch (error) {
      console.error('❌ Discovery failed:', error);
      process.exit(1);
    }
  });

program.parse();