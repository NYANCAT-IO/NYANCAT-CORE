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
} from '../lib/delta-neutral/index.js';

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
  .option('--max-leverage <number>', 'Maximum leverage to consider', parseFloat)
  .option('--risk-adjusted', 'Sort by risk-adjusted ROC instead of leveraged ROC')
  .option('--show-borrowing-costs', 'Always show borrowing costs in output')
  .option('--min-true-roc <number>', 'Minimum true (unleveraged) ROC threshold (%)', parseFloat)
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
      
      // Apply additional filters
      if (options.maxLeverage) {
        results = results.filter(r => r.positionSize.leverage <= options.maxLeverage);
      }
      
      if (options.minTrueRoc) {
        results = results.filter(r => r.unleveragedROC >= options.minTrueRoc);
      }
      
      // Sort by risk-adjusted ROC if requested
      if (options.riskAdjusted) {
        results.sort((a, b) => b.riskAdjustedROC - a.riskAdjustedROC);
      }
      
      // Get summary stats
      const stats = analyzer.getSummaryStats(results);
      
      // Output results
      if (options.json) {
        console.log(JSON.stringify({ stats, results }, null, 2));
      } else if (options.csv) {
        outputCsv(results);
      } else {
        outputTable(results, stats, config, startTime, options);
      }
      
    } catch (error: any) {
      console.error(chalk.red('\n❌ Error:'), error.message);
      process.exit(1);
    }
  });

function outputTable(results: StrategyResult[], stats: any, config: StrategyConfig, startTime: Date, options: any) {
  // Summary
  console.log(chalk.green('📈 Summary:'));
  console.log(`  Total Opportunities: ${stats.totalPairs}`);
  console.log(`  Profitable (>5% ROC): ${stats.profitableOpportunities}`);
  console.log(`  Average Basis: ${stats.averageBasis.toFixed(2)}%`);
  console.log(`  Average Funding APR: ${stats.averageFundingAPR.toFixed(2)}%`);
  
  // Show active filters
  if (options.maxLeverage || options.minTrueRoc || options.riskAdjusted) {
    console.log();
    console.log(chalk.yellow('Active Filters:'));
    if (options.maxLeverage) {
      console.log(`  Max Leverage: ${options.maxLeverage}x`);
    }
    if (options.minTrueRoc) {
      console.log(`  Min True ROC: ${options.minTrueRoc}%`);
    }
    if (options.riskAdjusted) {
      console.log(`  Sorting: Risk-Adjusted ROC`);
    }
  }
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
    chalk.cyan('Lev ROC %'),
    chalk.cyan('True ROC %'),
    chalk.cyan('Daily Return'),
    chalk.cyan('Risk')
  ];
  
  // Prepare rows
  const rows = results.slice(0, 20).map(result => {
    const p = result.pair;
    const basisColor = p.basis > 0 ? chalk.red : chalk.green;
    const fundingColor = p.fundingAPR > 0 ? chalk.green : chalk.red;
    const levRocColor = result.returnOnCapital > 100 ? chalk.red : 
                        result.returnOnCapital > 50 ? chalk.yellow : 
                        result.returnOnCapital > 10 ? chalk.green : chalk.gray;
    const trueRocColor = result.unleveragedROC > 20 ? chalk.green : 
                         result.unleveragedROC > 10 ? chalk.yellow : chalk.gray;
    
    // Risk indicator based on multiple factors
    let riskIndicator = chalk.green('Low');
    if (result.positionSize.leverage > 10 || result.risks.length > 2) {
      riskIndicator = chalk.red('High');
    } else if (result.positionSize.leverage > 5 || result.risks.length > 0) {
      riskIndicator = chalk.yellow('Med');
    }
    
    return [
      chalk.white(p.base),
      `$${p.spot.price.toFixed(2)}`,
      `$${p.perpetual.price.toFixed(2)}`,
      basisColor(`${p.basis.toFixed(2)}%`),
      fundingColor(`${p.fundingAPR.toFixed(2)}%`),
      `${p.netAPR.toFixed(2)}%`,
      levRocColor(`${result.returnOnCapital.toFixed(0)}%`),
      trueRocColor(`${result.unleveragedROC.toFixed(1)}%`),
      `$${result.expectedReturn.daily.toFixed(2)}`,
      riskIndicator
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
      
      // Show all ROC metrics
      console.log(`   ${chalk.bold('Returns')}:`);
      console.log(`     Leveraged ROC: ${chalk.bold(result.returnOnCapital.toFixed(1) + '%')} (${result.positionSize.leverage}x leverage)`);
      console.log(`     True ROC: ${chalk.green(result.unleveragedROC.toFixed(1) + '%')} (unleveraged)`);
      console.log(`     Risk-Adjusted: ${result.riskAdjustedROC.toFixed(1)}%`);
      
      // Show capital and returns
      console.log(`   ${chalk.bold('Capital & Returns')}:`);
      console.log(`     Required: $${result.positionSize.totalCapital.toFixed(2)}`);
      console.log(`     Position Size: $${result.positionSize.notionalValue.toFixed(2)}`);
      console.log(`     Daily Return: $${result.expectedReturn.daily.toFixed(2)}`);
      
      // Show costs
      if ((result.borrowingCostAPR && result.borrowingCostAPR > 0) || options.showBorrowingCosts) {
        console.log(`   ${chalk.bold('Costs')}:`);
        console.log(`     Borrowing: ${(result.borrowingCostAPR || 0).toFixed(2)}% APR`);
      }
      
      // Show liquidation info
      if (result.liquidationPrice) {
        console.log(`   ${chalk.bold('Liquidation Prices')}:`);
        if (result.liquidationPrice.spot) {
          const spotDist = ((result.liquidationPrice.spot - p.spot.price) / p.spot.price * 100);
          console.log(`     Spot: $${result.liquidationPrice.spot.toFixed(2)} (${spotDist > 0 ? '+' : ''}${spotDist.toFixed(1)}%)`);
        }
        if (result.liquidationPrice.perp) {
          const perpDist = ((result.liquidationPrice.perp - p.perpetual.price) / p.perpetual.price * 100);
          console.log(`     Perp: $${result.liquidationPrice.perp.toFixed(2)} (${perpDist > 0 ? '+' : ''}${perpDist.toFixed(1)}%)`);
        }
      }
      
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
  console.log('Asset,Spot Price,Perp Price,Basis %,Funding APR %,Net APR %,Leveraged ROC %,True ROC %,Risk-Adj ROC %,Borrowing Cost %,Leverage,Daily Return,Capital Required,Position Size,Max Loss');
  
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
      result.unleveragedROC.toFixed(2),
      result.riskAdjustedROC.toFixed(2),
      (result.borrowingCostAPR || 0).toFixed(2),
      result.positionSize.leverage,
      result.expectedReturn.daily.toFixed(2),
      result.positionSize.totalCapital.toFixed(2),
      result.positionSize.notionalValue.toFixed(2),
      (result.maxLoss || 0).toFixed(2)
    ].join(','));
  });
}

program.parse();