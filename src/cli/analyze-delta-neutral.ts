#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { table } from 'table';
import dotenv from 'dotenv';
import { 
  DeltaNeutralAnalyzer, 
  StrategyType, 
  StrategyConfig,
  StrategyResult 
} from '../lib/delta-neutral';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('analyze-delta-neutral')
  .description('Analyze delta-neutral arbitrage opportunities from Bybit data')
  .version('1.0.0')
  .option('-s, --strategy <type>', 'Strategy type (long-spot-short-perp, short-spot-long-perp)', 'long-spot-short-perp')
  .option('-m, --min-apr <number>', 'Minimum APR threshold (%)', parseFloat)
  .option('-a, --asset <symbol>', 'Filter by base asset (e.g., BTC)')
  .option('-j, --json', 'Output as JSON')
  .option('-c, --csv', 'Output as CSV')
  .option('-f, --include-fees', 'Include fee calculations')
  .option('-l, --leverage <number>', 'Leverage for perpetual position', parseFloat, 10)
  .option('-d, --data-path <path>', 'Path to data directory', './data/bybit')
  .action(async (options) => {
    try {
      console.log(chalk.cyan('\n📊 Delta-Neutral Opportunity Analysis\n'));
      
      // Map strategy string to enum
      let strategyType: StrategyType;
      switch (options.strategy) {
        case 'short-spot-long-perp':
          strategyType = StrategyType.SHORT_SPOT_LONG_PERP;
          break;
        case 'long-spot-short-perp':
        default:
          strategyType = StrategyType.LONG_SPOT_SHORT_PERP;
      }
      
      // Build configuration
      const config: StrategyConfig = {
        type: strategyType,
        minAPR: options.minApr,
        includeFees: options.includeFees,
        leverage: options.leverage
      };
      
      // Create analyzer
      const analyzer = new DeltaNeutralAnalyzer(options.dataPath);
      
      // Run analysis
      console.log(chalk.yellow('Loading market data...'));
      const startTime = new Date();
      let results = await analyzer.analyze(config);
      
      // Filter by asset if specified
      if (options.asset) {
        const asset = options.asset.toUpperCase();
        results = results.filter(r => r.pair.base === asset);
      }
      
      // Get summary stats
      const stats = analyzer.getSummaryStats(results);
      
      // Output results
      if (options.json) {
        console.log(JSON.stringify({ stats, results }, null, 2));
      } else if (options.csv) {
        outputCsv(results);
      } else {
        outputTable(results, stats, config, startTime);
      }
      
    } catch (error: any) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

function outputTable(results: StrategyResult[], stats: any, config: StrategyConfig, startTime: Date) {
  // Summary
  console.log(chalk.green('📈 Summary:'));
  console.log(`  Total Opportunities: ${stats.totalPairs}`);
  console.log(`  Profitable (>5% ROC): ${stats.profitableOpportunities}`);
  console.log(`  Average Basis: ${stats.averageBasis.toFixed(2)}%`);
  console.log(`  Average Funding APR: ${stats.averageFundingAPR.toFixed(2)}%`);
  console.log();
  
  if (results.length === 0) {
    console.log(chalk.yellow('No opportunities found matching criteria.'));
    return;
  }
  
  // Strategy info
  console.log(chalk.cyan('Strategy:'), config.type);
  console.log(chalk.cyan('Leverage:'), config.leverage + 'x');
  if (config.includeFees) {
    console.log(chalk.cyan('Fees:'), 'Included');
  }
  console.log();
  
  // Table headers
  const headers = [
    chalk.cyan('Asset'),
    chalk.cyan('Spot Price'),
    chalk.cyan('Perp Price'),
    chalk.cyan('Basis %'),
    chalk.cyan('Funding APR'),
    chalk.cyan('Net APR'),
    chalk.cyan('ROC %'),
    chalk.cyan('Daily Return'),
    chalk.cyan('Risks')
  ];
  
  // Prepare rows
  const rows = results.slice(0, 20).map(result => {
    const p = result.pair;
    const basisColor = p.basis > 0 ? chalk.red : chalk.green;
    const fundingColor = p.fundingAPR > 0 ? chalk.green : chalk.red;
    const rocColor = result.returnOnCapital > 10 ? chalk.green : 
                     result.returnOnCapital > 5 ? chalk.yellow : chalk.red;
    
    return [
      chalk.white(p.base),
      `$${p.spot.price.toFixed(2)}`,
      `$${p.perpetual.price.toFixed(2)}`,
      basisColor(`${p.basis.toFixed(2)}%`),
      fundingColor(`${p.fundingAPR.toFixed(2)}%`),
      `${p.netAPR.toFixed(2)}%`,
      rocColor(`${result.returnOnCapital.toFixed(2)}%`),
      `$${result.expectedReturn.daily.toFixed(2)}`,
      result.risks.length > 0 ? chalk.yellow('⚠') : chalk.green('✓')
    ];
  });
  
  // Create and display table
  const tableData = [headers, ...rows];
  const output = table(tableData, {
    border: {
      topBody: `─`,
      topJoin: `┬`,
      topLeft: `┌`,
      topRight: `┐`,
      bottomBody: `─`,
      bottomJoin: `┴`,
      bottomLeft: `└`,
      bottomRight: `┘`,
      bodyLeft: `│`,
      bodyRight: `│`,
      bodyJoin: `│`,
      joinBody: `─`,
      joinLeft: `├`,
      joinRight: `┤`,
      joinJoin: `┼`
    }
  });
  
  console.log(output);
  
  // Show top opportunities details
  if (results.length > 0) {
    console.log(chalk.green('\n🏆 Top Opportunities:\n'));
    
    results.slice(0, 3).forEach((result, index) => {
      const p = result.pair;
      console.log(chalk.cyan(`${index + 1}. ${p.base}`));
      console.log(`   Spot: ${p.spot.symbol} @ $${p.spot.price.toFixed(2)}`);
      console.log(`   Perp: ${p.perpetual.symbol} @ $${p.perpetual.price.toFixed(2)}`);
      console.log(`   Basis: ${p.basis.toFixed(2)}% | Funding: ${(p.perpetual.fundingRate * 100).toFixed(4)}% (${p.fundingAPR.toFixed(2)}% APR)`);
      console.log(`   Net APR: ${p.netAPR.toFixed(2)}% | ROC: ${result.returnOnCapital.toFixed(2)}%`);
      console.log(`   Capital Required: $${result.positionSize.totalCapital.toFixed(2)}`);
      console.log(`   Expected Daily: $${result.expectedReturn.daily.toFixed(2)}`);
      
      if (result.risks.length > 0) {
        console.log(chalk.yellow(`   Risks: ${result.risks.join(', ')}`));
      }
      if (result.notes.length > 0) {
        console.log(chalk.gray(`   Notes: ${result.notes.join(', ')}`));
      }
      console.log();
    });
  }
  
  // Footer with data source info
  console.log(chalk.gray('─'.repeat(80)));
  console.log(chalk.gray(`Data fetched at: ${startTime.toLocaleString()}`));
  console.log(chalk.gray('Data source: Bybit Mainnet API'));
  console.log(chalk.gray(''));
  console.log(chalk.gray('🔗 Verify rates: https://www.bybit.com/en/announcement-info/fund-rate/'));
  console.log(chalk.gray('📚 About clustering: docs/funding-rate-clustering-research.md'));
}

function outputCsv(results: StrategyResult[]) {
  // CSV header
  console.log('Asset,Spot Price,Perp Price,Basis %,Funding APR %,Net APR %,ROC %,Daily Return,Monthly Return,Capital Required');
  
  // CSV rows
  results.forEach(result => {
    const p = result.pair;
    console.log([
      p.base,
      p.spot.price.toFixed(2),
      p.perpetual.price.toFixed(2),
      p.basis.toFixed(2),
      p.fundingAPR.toFixed(2),
      p.netAPR.toFixed(2),
      result.returnOnCapital.toFixed(2),
      result.expectedReturn.daily.toFixed(2),
      result.expectedReturn.monthly.toFixed(2),
      result.positionSize.totalCapital.toFixed(2)
    ].join(','));
  });
}

program.parse();