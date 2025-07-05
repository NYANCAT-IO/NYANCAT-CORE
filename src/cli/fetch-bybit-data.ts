#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import dotenv from 'dotenv';
import { BybitDataFetcher } from '../lib/market-data/bybit-fetcher';
import { DataStorage } from '../lib/market-data/storage';
import { FetchOptions } from '../lib/market-data/types';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('fetch-bybit-data')
  .description('Fetch comprehensive market data from Bybit mainnet')
  .version('1.0.0')
  .option('--markets-only', 'Fetch only market specifications')
  .option('--tickers-only', 'Fetch only tickers (prices + funding)')
  .option('--include-inactive', 'Include inactive markets')
  .option('-d, --debug', 'Enable debug output')
  .action(async (options) => {
    const spinner = ora();
    
    try {
      console.log(chalk.cyan('\n🌐 Fetching data from Bybit MAINNET\n'));
      console.log(chalk.yellow('⚠️  Using MAINNET - Real market data\n'));
      
      // Check environment variables
      const requiredVars = [
        'BYBIT_MAINNET_API_KEY',
        'BYBIT_MAINNET_API_SECRET'
      ];
      
      const missing = requiredVars.filter(v => !process.env[v]);
      if (missing.length > 0) {
        console.error(chalk.red('❌ Missing environment variables:'));
        missing.forEach(v => console.error(chalk.red(`   - ${v}`)));
        console.error(chalk.yellow('\n💡 Please add mainnet credentials to your .env file'));
        process.exit(1);
      }
      
      // Initialize components
      const fetchOptions: FetchOptions = {
        includeInactive: options.includeInactive,
        debug: options.debug
      };
      
      const fetcher = new BybitDataFetcher(fetchOptions);
      const storage = new DataStorage('./data');
      
      let markets: any[] = [];
      let tickers: any[] = [];
      
      // Fetch markets
      if (!options.tickersOnly) {
        spinner.start('Fetching market specifications...');
        markets = await fetcher.fetchAllMarkets();
        spinner.succeed(`Fetched ${markets.length} markets`);
        
        const marketFile = storage.saveMarkets(markets);
        console.log(chalk.green(`✅ Saved markets to: ${marketFile}`));
      }
      
      // Fetch tickers
      if (!options.marketsOnly) {
        spinner.start('Fetching tickers (prices + funding rates)...');
        
        // If we have markets, use only active perpetuals and spot for efficiency
        let symbolsToFetch: string[] | undefined;
        if (markets.length > 0 && !options.includeInactive) {
          symbolsToFetch = markets
            .filter(m => m.active && (m.swap || m.spot))
            .map(m => m.symbol);
          console.log(chalk.gray(`  Fetching ${symbolsToFetch.length} active symbols...`));
        }
        
        tickers = await fetcher.fetchAllTickers(symbolsToFetch);
        spinner.succeed(`Fetched ${tickers.length} tickers`);
        
        const tickerFile = storage.saveTickers(tickers);
        console.log(chalk.green(`✅ Saved tickers to: ${tickerFile}`));
      }
      
      // Generate summary if we have both datasets
      if (markets.length > 0 && tickers.length > 0) {
        spinner.start('Generating summary analysis...');
        const summary = fetcher.generateSummary(markets, tickers);
        const summaryFile = storage.saveSummary(summary);
        spinner.succeed('Generated summary');
        console.log(chalk.green(`✅ Saved summary to: ${summaryFile}`));
        
        // Display key insights
        console.log(chalk.cyan('\n📊 Key Insights:'));
        console.log(`  Total Markets: ${summary.totalMarkets}`);
        console.log(`  Spot Markets: ${summary.marketBreakdown.spot}`);
        console.log(`  Perpetual Markets: ${summary.marketBreakdown.perpetual}`);
        console.log(`    - Linear: ${summary.marketBreakdown.linearPerpetuals}`);
        console.log(`    - Inverse: ${summary.marketBreakdown.inversePerpetuals}`);
        
        console.log(chalk.cyan('\n💰 Funding Rate Analysis:'));
        console.log(`  Perpetuals with funding: ${summary.fundingRateStats.count}`);
        console.log(`  Average APR: ${summary.fundingRateStats.averageAPR.toFixed(2)}%`);
        console.log(`  Positive funding: ${summary.fundingRateStats.positive}`);
        console.log(`  Negative funding: ${summary.fundingRateStats.negative}`);
        
        if (summary.fundingRateStats.topPositive.length > 0) {
          console.log(chalk.cyan('\n🔥 Top Positive Funding (APR):'));
          summary.fundingRateStats.topPositive.slice(0, 5).forEach(item => {
            console.log(`  ${item.symbol}: ${item.apr.toFixed(2)}%`);
          });
        }
        
        if (summary.fundingRateStats.topNegative.length > 0) {
          console.log(chalk.cyan('\n❄️  Top Negative Funding (APR):'));
          summary.fundingRateStats.topNegative.slice(0, 5).forEach(item => {
            console.log(`  ${item.symbol}: ${item.apr.toFixed(2)}%`);
          });
        }
      }
      
      console.log(chalk.green('\n✨ Data fetch completed successfully!\n'));
      
    } catch (error: any) {
      spinner.fail('Failed to fetch data');
      console.error(chalk.red('\n❌ Error:'), error.message);
      if (options.debug) {
        console.error(error);
      }
      process.exit(1);
    }
  });

program.parse();