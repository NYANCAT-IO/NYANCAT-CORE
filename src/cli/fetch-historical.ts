#!/usr/bin/env node

import { Command } from 'commander';
import { HistoricalDataFetcher } from '../lib/historical';

const program = new Command();

program
  .name('fetch-historical')
  .description('Fetch historical funding rates and price data from Bybit')
  .option('-d, --days <number>', 'Number of days to fetch', '30')
  .option('--from <date>', 'Start date (YYYY-MM-DD)')
  .option('--to <date>', 'End date (YYYY-MM-DD)')
  .option('-s, --symbols <symbols>', 'Comma-separated symbols (e.g., BTC/USDT:USDT,ETH/USDT:USDT)')
  .option('--valid-only', 'Only fetch data for validated delta-neutral pairs')
  .option('--fresh', 'Force refresh, ignore cache')
  .option('--list-cache', 'List available cached data')
  .option('--clear-cache', 'Clear all cached data')
  .action(async (options) => {
    const fetcher = new HistoricalDataFetcher();

    // Handle cache operations
    if (options.listCache) {
      await fetcher.listAvailableCache();
      return;
    }

    if (options.clearCache) {
      const storage = new (await import('../lib/historical')).DataStorage();
      await storage.clearCache();
      console.log('Cache cleared');
      return;
    }

    // Determine time range
    let startTime: number;
    let endTime: number;

    if (options.from && options.to) {
      startTime = new Date(options.from).getTime();
      endTime = new Date(options.to).getTime();
      
      if (isNaN(startTime) || isNaN(endTime)) {
        console.error('Invalid date format. Use YYYY-MM-DD');
        process.exit(1);
      }
    } else {
      const days = parseInt(options.days);
      if (isNaN(days) || days <= 0) {
        console.error('Invalid number of days');
        process.exit(1);
      }
      
      endTime = Date.now();
      startTime = endTime - (days * 24 * 60 * 60 * 1000);
    }

    // Parse symbols
    const symbols = options.symbols 
      ? options.symbols.split(',').map((s: string) => s.trim())
      : undefined;

    console.log(`\nFetching historical data:`);
    console.log(`- From: ${new Date(startTime).toISOString()}`);
    console.log(`- To: ${new Date(endTime).toISOString()}`);
    console.log(`- Symbols: ${symbols ? symbols.join(', ') : (options.validOnly ? 'All valid pairs' : 'Top 20 by volume')}`);
    console.log(`- Use cache: ${!options.fresh}`);
    console.log(`- Valid pairs only: ${options.validOnly || false}\n`);

    try {
      const data = options.validOnly 
        ? await fetcher.fetchValidPairsOnly({
            startTime,
            endTime,
            useCache: !options.fresh,
          })
        : await fetcher.fetchHistoricalData({
            startTime,
            endTime,
            symbols,
            useCache: !options.fresh,
          });

      console.log('\n✅ Historical data fetch complete!');
      console.log(`- Symbols fetched: ${data.metadata.symbols.length}`);
      console.log(`- Time range: ${Math.round((endTime - startTime) / (24 * 60 * 60 * 1000))} days`);
      
      // Show sample data
      const firstSymbol = data.metadata.symbols[0];
      if (firstSymbol) {
        const fundingRates = data.fundingRates.get(firstSymbol);
        if (fundingRates && fundingRates.length > 0) {
          const latestRate = fundingRates[fundingRates.length - 1];
          if (latestRate) {
            const apr = latestRate.rate * 3 * 365 * 100;
            console.log(`\nSample (${firstSymbol}):`);
            console.log(`- Latest funding rate: ${(latestRate.rate * 100).toFixed(4)}% (${apr.toFixed(2)}% APR)`);
            console.log(`- Funding time: ${new Date(latestRate.fundingTime).toISOString()}`);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching historical data:', error);
      process.exit(1);
    }
  });

program.parse();

// Handle no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}