#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import fs from 'fs/promises';
import { SimpleBacktestEngine, ReportGenerator, BacktestConfig } from '../lib/backtest';

const program = new Command();

program
  .name('backtest')
  .description('Run a backtest on delta-neutral funding arbitrage strategy')
  .option('-d, --days <number>', 'Number of days to backtest', '30')
  .option('-o, --output <format>', 'Output format: html, json, or both', 'both')
  .option('--demo', 'Quick demo mode (7 days, lower threshold)')
  .option('-c, --capital <amount>', 'Initial capital', '10000')
  .option('-m, --min-apr <percent>', 'Minimum funding APR threshold', '8')
  .action(async (options) => {
    const spinner = ora('Running backtest...').start();
    
    try {
      // Parse options
      const days = options.demo ? 7 : parseInt(options.days);
      const capital = parseFloat(options.capital);
      const minAPR = options.demo ? 5 : parseFloat(options.minApr);
      
      if (isNaN(days) || days <= 0) {
        spinner.fail('Invalid number of days');
        process.exit(1);
      }
      
      if (isNaN(capital) || capital <= 0) {
        spinner.fail('Invalid initial capital');
        process.exit(1);
      }
      
      // Configure backtest
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      const config: BacktestConfig = {
        startDate,
        endDate,
        initialCapital: capital,
        minAPR: minAPR
      };
      
      spinner.text = `Running backtest from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`;
      
      // Run backtest
      const engine = new SimpleBacktestEngine();
      const result = await engine.runBacktest(config);
      
      spinner.succeed('Backtest complete!');
      
      // Generate reports
      const generator = new ReportGenerator();
      
      if (options.output === 'json' || options.output === 'both') {
        const jsonOutput = generator.generateJSON(result);
        await fs.writeFile('backtest-results.json', jsonOutput, 'utf-8');
        console.log('📊 JSON results saved to backtest-results.json');
      }
      
      if (options.output === 'html' || options.output === 'both') {
        const htmlOutput = generator.generateHTML(result);
        await fs.writeFile('backtest-results.html', htmlOutput, 'utf-8');
        console.log('📈 HTML report saved to backtest-results.html');
        
        // Try to open in browser
        try {
          const open = (await import('open')).default;
          await open('backtest-results.html');
        } catch {
          // Ignore if open package is not available
        }
      }
      
      // Display summary
      console.log('\n✨ Backtest Summary:');
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Initial Capital:  $${config.initialCapital.toLocaleString()}`);
      console.log(`Final Capital:    $${result.summary.finalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
      console.log(`Total Return:     ${result.summary.totalReturn >= 0 ? '+' : ''}${result.summary.totalReturn.toFixed(2)}%`);
      console.log(`Annualized:       ${(result.summary.totalReturn * 365 / result.summary.totalDays).toFixed(2)}%`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`Total Trades:     ${result.summary.numberOfTrades}`);
      console.log(`Win Rate:         ${result.summary.winRate.toFixed(1)}%`);
      console.log(`Max Drawdown:     ${result.summary.maxDrawdown.toFixed(1)}%`);
      console.log(`Test Period:      ${result.summary.totalDays} days`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      if (result.summary.totalReturn > 0) {
        console.log('\n🎉 Strategy was profitable!');
      }
      
    } catch (error: any) {
      spinner.fail('Backtest failed');
      
      if (error.message?.includes('No historical data')) {
        console.error('\n❌ No historical data found for the specified period.');
        console.error('💡 Run "pnpm fetch-historical" first to download data.');
      } else {
        console.error('\n❌ Error:', error.message || error);
      }
      
      process.exit(1);
    }
  });

program.parse();

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}