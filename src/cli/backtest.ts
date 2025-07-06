#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import fs from 'fs/promises';
import { 
  SimpleBacktestEngine, 
  ReportGenerator, 
  BacktestConfig,
  ComprehensiveBacktestEngine,
  ComprehensiveReportGenerator,
  OptimizedBacktestEngine,
  OptimizedBacktestConfig
} from '../lib/backtest/index.js';

const program = new Command();

program
  .name('backtest')
  .description('Run a backtest on delta-neutral funding arbitrage strategy')
  .option('-d, --days <number>', 'Number of days to backtest', '90')
  .option('-o, --output <format>', 'Output format: html, json, or both', 'both')
  .option('-r, --report <type>', 'Report type: simple, comprehensive, optimized, or both', 'simple')
  .option('--demo', 'Quick demo mode (7 days, lower threshold)')
  .option('--valid-only', 'Only use validated delta-neutral pairs (default: true)', true)
  .option('-c, --capital <amount>', 'Initial capital', '10000')
  .option('-m, --min-apr <percent>', 'Minimum funding APR threshold', '8')
  .option('--ml', 'Use ML-optimized strategy (predictive signals and smart filtering)')
  .option('--risk-threshold <number>', 'ML risk threshold (0-1, only enter positions below this risk)', '0.6')
  .option('--volatility-filter', 'Only trade during low volatility periods')
  .option('--momentum-filter', 'Avoid positions when funding momentum is declining')
  .action(async (options) => {
    const spinner = ora('Running backtest...').start();
    
    // Helper function to get output path
    const getOutputPath = (filename: string): string => {
      const resultsDir = process.env.RESULTS_DIR || '.';
      return `${resultsDir}/${filename}`;
    };

    // Ensure results directory exists
    const resultsDir = process.env.RESULTS_DIR;
    if (resultsDir) {
      try {
        await fs.mkdir(resultsDir, { recursive: true });
      } catch (error) {
        // Directory already exists or creation failed, continue
      }
    }
    
    try {
      // Parse options
      const days = options.demo ? 7 : parseInt(options.days);
      const capital = parseFloat(options.capital);
      const minAPR = options.demo ? 5 : parseFloat(options.minApr);
      const riskThreshold = parseFloat(options.riskThreshold);
      
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
      
      // Determine if we should use ML optimization
      const useML = options.ml || options.report === 'optimized';
      
      const config: OptimizedBacktestConfig = {
        startDate,
        endDate,
        initialCapital: capital,
        minAPR: useML ? Math.max(minAPR - 2, 3) : minAPR, // Lower threshold for ML
        useML,
        riskThreshold: isNaN(riskThreshold) ? 0.6 : riskThreshold,
        volatilityFilter: options.volatilityFilter,
        momentumFilter: options.momentumFilter
      };
      
      if (useML) {
        spinner.text = `Running ML-OPTIMIZED backtest from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`;
      } else {
        spinner.text = `Running backtest from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}...`;
      }
      
      // Run backtest based on report type and ML options
      const useComprehensive = options.report === 'comprehensive' || options.report === 'both';
      const useOptimized = options.report === 'optimized' || useML;
      
      let result;
      if (useOptimized) {
        const engine = new OptimizedBacktestEngine();
        result = await engine.runOptimizedBacktest(config);
      } else if (useComprehensive) {
        const engine = new ComprehensiveBacktestEngine();
        result = await engine.runBacktest(config as BacktestConfig);
      } else {
        const engine = new SimpleBacktestEngine();
        result = await engine.runBacktest(config as BacktestConfig);
      }
      
      if (useOptimized) {
        spinner.succeed('🚀 ML-Optimized backtest complete!');
      } else {
        spinner.succeed('Backtest complete!');
      }
      
      // Generate optimized report if using ML
      if (useOptimized) {
        if (options.output === 'json' || options.output === 'both') {
          const jsonOutput = JSON.stringify(result, null, 2);
          const jsonPath = getOutputPath('backtest-optimized.json');
          await fs.writeFile(jsonPath, jsonOutput, 'utf-8');
          console.log(`🚀 ML-Optimized JSON results saved to ${jsonPath}`);
        }
        
        if (options.output === 'html' || options.output === 'both') {
          // Use comprehensive report generator for now (could create optimized HTML later)
          const generator = new ComprehensiveReportGenerator();
          const htmlOutput = generator.generateHTML(result as any);
          const htmlPath = getOutputPath('backtest-optimized.html');
          await fs.writeFile(htmlPath, htmlOutput, 'utf-8');
          console.log(`📈 ML-Optimized HTML report saved to ${htmlPath}`);
          
          // Open in browser if demo mode
          if (options.demo || options.days <= 7) {
            try {
              const open = (await import('open')).default;
              await open(htmlPath);
            } catch {
              // Ignore if open package is not available
            }
          }
        }
      }
      
      // Generate simple report if needed
      if (options.report === 'simple' || options.report === 'both') {
        const generator = new ReportGenerator();
        
        if (options.output === 'json' || options.output === 'both') {
          const jsonOutput = generator.generateJSON(result);
          const jsonPath = getOutputPath('backtest-results.json');
          await fs.writeFile(jsonPath, jsonOutput, 'utf-8');
          console.log(`📊 JSON results saved to ${jsonPath}`);
        }
        
        if (options.output === 'html' || options.output === 'both') {
          const htmlOutput = generator.generateHTML(result);
          const htmlPath = getOutputPath('backtest-results.html');
          await fs.writeFile(htmlPath, htmlOutput, 'utf-8');
          console.log(`📈 HTML report saved to ${htmlPath}`);
          
          // Try to open in browser
          try {
            const open = (await import('open')).default;
            await open(htmlPath);
          } catch {
            // Ignore if open package is not available
          }
        }
      }
      
      // Generate comprehensive report if needed
      if (options.report === 'comprehensive' || options.report === 'both') {
        const comprehensiveGenerator = new ComprehensiveReportGenerator();
        
        if (options.output === 'json' || options.output === 'both') {
          const jsonOutput = comprehensiveGenerator.generateJSON(result as any);
          const jsonPath = getOutputPath('backtest-comprehensive.json');
          await fs.writeFile(jsonPath, jsonOutput, 'utf-8');
          console.log(`📊 Comprehensive JSON results saved to ${jsonPath}`);
        }
        
        if (options.output === 'html' || options.output === 'both') {
          const htmlOutput = comprehensiveGenerator.generateHTML(result as any);
          const htmlPath = getOutputPath('backtest-comprehensive.html');
          await fs.writeFile(htmlPath, htmlOutput, 'utf-8');
          console.log(`📈 Comprehensive HTML report saved to ${htmlPath}`);
          
          // Try to open in browser if demo mode
          if (options.demo) {
            try {
              const open = (await import('open')).default;
              await open(htmlPath);
            } catch {
              // Ignore if open package is not available
            }
          }
        }
      }
      
      // Display summary
      if (useOptimized) {
        console.log('\n🚀 ML-Optimized Backtest Summary:');
      } else {
        console.log('\n✨ Backtest Summary:');
      }
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
      
      // Show ML-specific metrics if available
      if (useOptimized && (result as any).signalAccuracy) {
        const mlResult = result as any;
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`🤖 ML Performance:`);
        console.log(`Prediction Accuracy: ${mlResult.signalAccuracy.accuracy.toFixed(1)}%`);
        console.log(`Avg Confidence:     ${mlResult.signalAccuracy.avgConfidence.toFixed(1)}%`);
        console.log(`Risk Threshold:     ${((config.riskThreshold || 0.6) * 100).toFixed(0)}%`);
        if (config.volatilityFilter) console.log(`Volatility Filter:   ✓ Enabled`);
        if (config.momentumFilter) console.log(`Momentum Filter:     ✓ Enabled`);
      }
      
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      if (result.summary.totalReturn > 0) {
        if (useOptimized) {
          console.log('\n🎉 ML-optimized strategy was profitable!');
        } else {
          console.log('\n🎉 Strategy was profitable!');
        }
      } else if (useOptimized) {
        console.log('\n💡 Consider adjusting ML parameters for better performance');
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