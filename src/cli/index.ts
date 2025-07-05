#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import ora from 'ora';
import dotenv from 'dotenv';
import { FundingService, ExchangeConfig, FundingRate, ComparisonResult } from '../lib/index.js';

// Load environment variables
dotenv.config();

// Parse configuration from environment
function loadConfig(): ExchangeConfig {
  const requiredEnvVars = [
    'BYBIT_TESTNET_API_KEY',
    'BYBIT_TESTNET_API_SECRET',
    'HYPERLIQUID_TESTNET_API_KEY',
    'HYPERLIQUID_TESTNET_API_SECRET',
  ];

  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error(chalk.red('❌ Missing required environment variables:'));
    missing.forEach(key => console.error(chalk.red(`   - ${key}`)));
    console.error(chalk.yellow('\n💡 Please create a .env file based on .env.example'));
    process.exit(1);
  }

  // Parse exchange-specific symbols
  const bybitSymbols = process.env.BYBIT_SYMBOLS?.split(',').map(s => s.trim()) || ['BTC/USDT:USDT', 'ETH/USDT:USDT'];
  const hyperliquidSymbols = process.env.HYPERLIQUID_SYMBOLS?.split(',').map(s => s.trim()) || ['BTC/USDC:USDC', 'ETH/USDC:USDC'];

  const config: ExchangeConfig = {
    bybit: {
      apiKey: process.env.BYBIT_TESTNET_API_KEY!,
      apiSecret: process.env.BYBIT_TESTNET_API_SECRET!,
      testnet: true,
      symbols: bybitSymbols,
    },
    hyperliquid: {
      apiKey: process.env.HYPERLIQUID_TESTNET_API_KEY!,
      apiSecret: process.env.HYPERLIQUID_TESTNET_API_SECRET!,
      testnet: true,
      symbols: hyperliquidSymbols,
    },
  };

  return config;
}

// Format funding rate for display
function formatRate(rate: number): string {
  const percentage = rate * 100;
  const formatted = percentage.toFixed(4) + '%';
  
  if (percentage > 0) {
    return chalk.red('+' + formatted); // Positive rate is bad for longs
  } else if (percentage < 0) {
    return chalk.green(formatted); // Negative rate is good for longs
  }
  return chalk.gray(formatted);
}

// Format annualized rate
function formatAnnualizedRate(rate: number): string {
  const formatted = rate.toFixed(2) + '%';
  
  if (rate > 0) {
    return chalk.red('+' + formatted);
  } else if (rate < 0) {
    return chalk.green(formatted);
  }
  return chalk.gray(formatted);
}

// Format timestamp
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

// Display funding rates in a table
function displayRatesTable(rates: FundingRate[]) {
  const table = new Table({
    head: [
      chalk.cyan('Exchange'),
      chalk.cyan('Symbol'),
      chalk.cyan('Funding Rate'),
      chalk.cyan('Annualized'),
      chalk.cyan('Interval'),
      chalk.cyan('Next Funding'),
    ],
    style: { head: [] },
  });

  rates.forEach(rate => {
    table.push([
      rate.exchange,
      rate.symbol,
      formatRate(rate.rate),
      formatAnnualizedRate(rate.annualizedRate),
      rate.interval,
      formatTime(rate.nextFundingTime),
    ]);
  });

  console.log(table.toString());
}

// Display comparison results
function displayComparisonTable(comparisons: ComparisonResult[]) {
  const table = new Table({
    head: [
      chalk.cyan('Symbol'),
      chalk.cyan('Bybit Rate'),
      chalk.cyan('Hyperliquid Rate'),
      chalk.cyan('Spread (APY)'),
      chalk.cyan('Better for Long'),
    ],
    style: { head: [] },
  });

  comparisons.forEach(comp => {
    const bybitRate = comp.bybit ? formatRate(comp.bybit.rate) : chalk.gray('N/A');
    const hyperliquidRate = comp.hyperliquid ? formatRate(comp.hyperliquid.rate) : chalk.gray('N/A');
    const spread = comp.spread.toFixed(2) + '%';
    
    let favorable = chalk.gray('N/A');
    if (comp.favorableExchange !== 'none') {
      favorable = comp.favorableExchange === 'bybit' 
        ? chalk.blue('Bybit') 
        : chalk.magenta('Hyperliquid');
    }

    table.push([
      comp.symbol,
      bybitRate,
      hyperliquidRate,
      spread,
      favorable,
    ]);
  });

  console.log(table.toString());
}

// Display rates as JSON
function displayJson(data: any) {
  console.log(JSON.stringify(data, null, 2));
}

// Main CLI program
const program = new Command();

program
  .name('ccxt-funding')
  .description('CLI tool for fetching and comparing funding rates from Bybit and Hyperliquid')
  .version('1.0.0');

program
  .option('-s, --symbol <symbol>', 'Filter by specific symbol or base asset (e.g., BTC, ETH)')
  .option('-c, --compare', 'Compare rates between exchanges')
  .option('-j, --json', 'Output as JSON')
  .action(async (options) => {
    const config = loadConfig();
    const spinner = ora('Connecting to exchanges...').start();

    try {
      const service = new FundingService(config);
      await service.connect();
      spinner.succeed('Connected to exchanges');

      if (options.compare) {
        spinner.start('Fetching and comparing funding rates...');
        const comparisons = options.symbol
          ? [await service.compareRates(options.symbol)]
          : await service.compareAllRates();
        spinner.succeed('Funding rates fetched');

        if (options.json) {
          displayJson(comparisons);
        } else {
          console.log('\n' + chalk.bold('📊 Funding Rate Comparison\n'));
          displayComparisonTable(comparisons);
        }
      } else {
        spinner.start('Fetching funding rates...');
        let rates: FundingRate[];
        
        if (options.symbol) {
          // Check if it's a full symbol or just a base asset
          if (options.symbol.includes('/')) {
            rates = await service.fetchRatesForSymbol(options.symbol);
          } else {
            // If it's just a base asset, fetch all rates and filter
            const allRates = await service.fetchRates();
            rates = allRates.filter(r => r.symbol.startsWith(options.symbol + '/'));
          }
        } else {
          rates = await service.fetchRates();
        }
        
        spinner.succeed('Funding rates fetched');

        if (options.json) {
          displayJson(rates);
        } else {
          console.log('\n' + chalk.bold('📊 Current Funding Rates\n'));
          displayRatesTable(rates);
        }
      }

      await service.disconnect();
    } catch (error) {
      spinner.fail('Error occurred');
      console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

program.parse();