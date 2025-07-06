#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import fs from 'fs/promises';
import { FugleMLOptimizer, OptimizationParams } from '../lib/backtest/fugle-optimizer';
import { OptimizedBacktestConfig } from '../lib/backtest/optimized-engine';

const program = new Command();

program
  .name('optimize-ml')
  .description('Advanced ML parameter optimization using Fugle Backtest framework')
  .option('-d, --days <number>', 'Number of days to optimize', '30')
  .option('-e, --evaluations <number>', 'Maximum optimization evaluations', '50')
  .option('-c, --capital <amount>', 'Initial capital', '10000')
  .option('--validate', 'Validate optimized parameters on longer period')
  .option('--baseline', 'Compare against current manual parameters')
  .option('-o, --output <format>', 'Output format: json, html, or both', 'both')
  .action(async (options) => {
    const spinner = ora('Initializing ML parameter optimization...').start();
    
    try {
      // Parse options
      const days = parseInt(options.days);
      const maxEvaluations = parseInt(options.evaluations);
      const capital = parseFloat(options.capital);
      
      if (isNaN(days) || days <= 0) {
        spinner.fail('Invalid number of days');
        process.exit(1);
      }
      
      if (isNaN(capital) || capital <= 0) {
        spinner.fail('Invalid initial capital');
        process.exit(1);
      }

      // Configure optimization period
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);
      
      const config: OptimizedBacktestConfig = {
        startDate,
        endDate,
        initialCapital: capital,
        minAPR: 5, // Will be optimized
        useML: true,
        riskThreshold: 0.6, // Will be optimized
        volatilityFilter: false, // Will be optimized
        momentumFilter: false // Will be optimized
      };

      spinner.text = `🔍 Optimizing ML parameters over ${days} days (${maxEvaluations} evaluations)...`;

      // Initialize optimizer
      const optimizer = new FugleMLOptimizer();

      // Run baseline test if requested
      let baselineResult = null;
      if (options.baseline) {
        spinner.text = '📊 Running baseline test with current parameters...';
        
        const baselineParams: OptimizationParams = {
          riskThreshold: 0.6,
          minAPR: 6,
          volatilityFilter: false,
          momentumFilter: false,
          positionSizing: 0.25,
          confidenceThreshold: 0.6
        };
        
        try {
          baselineResult = await optimizer.validateParameters(config, baselineParams);
          console.log(`\n📊 Baseline Performance:`);
          console.log(`   Return: ${baselineResult.performance.totalReturn.toFixed(2)}%`);
          console.log(`   Score: ${baselineResult.score.toFixed(4)}`);
        } catch (error) {
          console.warn('⚠️  Baseline test failed:', error.message);
        }
      }

      // Run optimization
      spinner.text = `🚀 Running parameter optimization (${maxEvaluations} evaluations)...`;
      const optimizationResult = await optimizer.optimizeParameters(config, maxEvaluations);

      spinner.succeed('🎉 Parameter optimization completed!');

      // Display results
      console.log('\n🏆 OPTIMIZATION RESULTS');
      console.log('=====================');
      console.log(`Optimization Score: ${optimizationResult.score.toFixed(4)}`);
      console.log(`Total Return: ${optimizationResult.performance.totalReturn.toFixed(2)}%`);
      console.log(`Sharpe Ratio: ${optimizationResult.performance.sharpeRatio.toFixed(2)}`);
      console.log(`Max Drawdown: ${optimizationResult.performance.maxDrawdown.toFixed(1)}%`);
      console.log(`Win Rate: ${optimizationResult.performance.winRate.toFixed(1)}%`);
      console.log(`Total Trades: ${optimizationResult.performance.trades}`);

      console.log('\n🎯 OPTIMAL PARAMETERS');
      console.log('====================');
      console.log(`Risk Threshold: ${optimizationResult.params.riskThreshold}`);
      console.log(`Min APR: ${optimizationResult.params.minAPR}%`);
      console.log(`Volatility Filter: ${optimizationResult.params.volatilityFilter ? '✓' : '✗'}`);
      console.log(`Momentum Filter: ${optimizationResult.params.momentumFilter ? '✓' : '✗'}`);
      console.log(`Position Sizing: ${(optimizationResult.params.positionSizing * 100).toFixed(1)}%`);
      console.log(`Confidence Threshold: ${optimizationResult.params.confidenceThreshold}`);

      // Compare with baseline if available
      if (baselineResult) {
        const improvement = optimizationResult.performance.totalReturn - baselineResult.performance.totalReturn;
        const scoreImprovement = optimizationResult.score - baselineResult.score;
        
        console.log('\n📈 IMPROVEMENT vs BASELINE');
        console.log('=========================');
        console.log(`Return Improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(2)}%`);
        console.log(`Score Improvement: ${scoreImprovement >= 0 ? '+' : ''}${scoreImprovement.toFixed(4)}`);
        console.log(`Performance: ${improvement > 0 ? '🚀 Better' : improvement < 0 ? '📉 Worse' : '🟰 Same'}`);
      }

      // Validation test
      if (options.validate) {
        spinner.start('🔬 Validating optimized parameters on extended period...');
        
        const validationDays = days * 2; // Test on longer period
        const validationEndDate = new Date();
        const validationStartDate = new Date(validationEndDate.getTime() - validationDays * 24 * 60 * 60 * 1000);
        
        const validationConfig = {
          ...config,
          startDate: validationStartDate,
          endDate: validationEndDate
        };

        try {
          const validationResult = await optimizer.validateParameters(validationConfig, optimizationResult.params);
          
          spinner.succeed('✅ Validation completed!');
          
          console.log('\n🔬 VALIDATION RESULTS');
          console.log('====================');
          console.log(`Validation Period: ${validationDays} days`);
          console.log(`Validation Return: ${validationResult.performance.totalReturn.toFixed(2)}%`);
          console.log(`Validation Score: ${validationResult.score.toFixed(4)}`);
          
          const consistencyScore = Math.abs(validationResult.performance.totalReturn - optimizationResult.performance.totalReturn) / optimizationResult.performance.totalReturn;
          console.log(`Consistency: ${consistencyScore < 0.3 ? '🟢 Good' : consistencyScore < 0.6 ? '🟡 Moderate' : '🔴 Poor'} (${(100 - consistencyScore * 100).toFixed(1)}%)`);
          
        } catch (error) {
          spinner.fail('❌ Validation failed');
          console.warn('⚠️  Validation error:', error.message);
        }
      }

      // Save results
      if (options.output === 'json' || options.output === 'both') {
        const jsonOutput = {
          timestamp: new Date().toISOString(),
          config,
          optimization: optimizationResult,
          baseline: baselineResult,
          validation: options.validate ? 'See validation output above' : null
        };
        
        await fs.writeFile('ml-optimization-results.json', JSON.stringify(jsonOutput, null, 2), 'utf-8');
        console.log('\n📄 Results saved to: ml-optimization-results.json');
      }

      if (options.output === 'html' || options.output === 'both') {
        const htmlOutput = generateHTMLReport(optimizationResult, baselineResult, config);
        await fs.writeFile('ml-optimization-results.html', htmlOutput, 'utf-8');
        console.log('📄 HTML report saved to: ml-optimization-results.html');
        
        // Try to open in browser
        try {
          const open = (await import('open')).default;
          await open('ml-optimization-results.html');
        } catch {
          // Ignore if open package is not available
        }
      }

      console.log('\n🎯 NEXT STEPS:');
      console.log('1. Review the optimized parameters above');
      console.log('2. Test on live/paper trading with small position sizes');
      console.log('3. Monitor performance and re-optimize periodically');
      console.log('4. Consider ensemble methods with multiple parameter sets');

    } catch (error: any) {
      spinner.fail('ML optimization failed');
      
      if (error.message?.includes('No historical data')) {
        console.error('\n❌ No historical data found for the specified period.');
        console.error('💡 Run "pnpm fetch-historical" first to download data.');
      } else {
        console.error('\n❌ Error:', error.message || error);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
      
      process.exit(1);
    }
  });

function generateHTMLReport(optimizationResult: any, baselineResult: any, config: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>ML Parameter Optimization Report</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .section { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .improvement { color: #28a745; font-weight: bold; }
        .decline { color: #dc3545; font-weight: bold; }
        .parameters { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .param-card { background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🚀 ML Parameter Optimization Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>Optimization Period: ${config.startDate.toDateString()} - ${config.endDate.toDateString()}</p>
    </div>

    <div class="section">
        <h2>🏆 Optimization Results</h2>
        <div class="metric">
            <h3>Optimization Score</h3>
            <div style="font-size: 2em; color: #007bff;">${optimizationResult.score.toFixed(4)}</div>
        </div>
        <div class="metric">
            <h3>Total Return</h3>
            <div style="font-size: 2em; color: ${optimizationResult.performance.totalReturn >= 0 ? '#28a745' : '#dc3545'};">
                ${optimizationResult.performance.totalReturn.toFixed(2)}%
            </div>
        </div>
        <div class="metric">
            <h3>Sharpe Ratio</h3>
            <div style="font-size: 2em;">${optimizationResult.performance.sharpeRatio.toFixed(2)}</div>
        </div>
        <div class="metric">
            <h3>Max Drawdown</h3>
            <div style="font-size: 2em;">${optimizationResult.performance.maxDrawdown.toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>Win Rate</h3>
            <div style="font-size: 2em;">${optimizationResult.performance.winRate.toFixed(1)}%</div>
        </div>
        <div class="metric">
            <h3>Total Trades</h3>
            <div style="font-size: 2em;">${optimizationResult.performance.trades}</div>
        </div>
    </div>

    <div class="section">
        <h2>🎯 Optimal Parameters</h2>
        <div class="parameters">
            <div class="param-card">
                <h4>Risk Threshold</h4>
                <p>${optimizationResult.params.riskThreshold}</p>
            </div>
            <div class="param-card">
                <h4>Min APR</h4>
                <p>${optimizationResult.params.minAPR}%</p>
            </div>
            <div class="param-card">
                <h4>Volatility Filter</h4>
                <p>${optimizationResult.params.volatilityFilter ? '✓ Enabled' : '✗ Disabled'}</p>
            </div>
            <div class="param-card">
                <h4>Momentum Filter</h4>
                <p>${optimizationResult.params.momentumFilter ? '✓ Enabled' : '✗ Disabled'}</p>
            </div>
            <div class="param-card">
                <h4>Position Sizing</h4>
                <p>${(optimizationResult.params.positionSizing * 100).toFixed(1)}%</p>
            </div>
            <div class="param-card">
                <h4>Confidence Threshold</h4>
                <p>${optimizationResult.params.confidenceThreshold}</p>
            </div>
        </div>
    </div>

    ${baselineResult ? `
    <div class="section">
        <h2>📈 Comparison vs Baseline</h2>
        <div class="metric">
            <h3>Return Improvement</h3>
            <div style="font-size: 2em;" class="${optimizationResult.performance.totalReturn > baselineResult.performance.totalReturn ? 'improvement' : 'decline'}">
                ${(optimizationResult.performance.totalReturn - baselineResult.performance.totalReturn >= 0 ? '+' : '')}${(optimizationResult.performance.totalReturn - baselineResult.performance.totalReturn).toFixed(2)}%
            </div>
        </div>
        <div class="metric">
            <h3>Score Improvement</h3>
            <div style="font-size: 2em;" class="${optimizationResult.score > baselineResult.score ? 'improvement' : 'decline'}">
                ${(optimizationResult.score - baselineResult.score >= 0 ? '+' : '')}${(optimizationResult.score - baselineResult.score).toFixed(4)}
            </div>
        </div>
    </div>
    ` : ''}

    <div class="section">
        <h2>🎯 Next Steps</h2>
        <ol>
            <li>Review the optimized parameters above</li>
            <li>Test on live/paper trading with small position sizes</li>
            <li>Monitor performance and re-optimize periodically</li>
            <li>Consider ensemble methods with multiple parameter sets</li>
        </ol>
    </div>
</body>
</html>
  `;
}

program.parse();

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}