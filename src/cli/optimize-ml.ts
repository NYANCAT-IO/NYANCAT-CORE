#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import os from 'os';
import { Piscina } from 'piscina';
import { OptimizedBacktestEngine, OptimizedBacktestConfig, OptimizedBacktestResult } from '../lib/backtest/optimized-engine.js';
import type { WorkerTask } from '../workers/optimize-backtest-worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

interface OptimizationParams {
  riskThreshold: number;
  minAPR: number;
  volatilityFilter: boolean;
  momentumFilter: boolean;
}

interface OptimizationResult {
  params: OptimizationParams;
  performance: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    trades: number;
  };
  score: number;
}

class MLParameterOptimizer {
  private engine: OptimizedBacktestEngine;

  constructor() {
    this.engine = new OptimizedBacktestEngine();
  }

  /**
   * Define parameter optimization ranges
   */
  private getParameterRanges() {
    return {
      riskThreshold: [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
      minAPR: [3, 4, 5, 6, 7, 8, 9, 10],
      volatilityFilter: [true, false],
      momentumFilter: [true, false]
    };
  }

  /**
   * Calculate optimization score combining multiple metrics
   */
  private calculateOptimizationScore(result: OptimizedBacktestResult): number {
    const returnWeight = 0.4;
    const sharpeWeight = 0.3;
    const drawdownWeight = 0.2;
    const stabilityWeight = 0.1;

    const totalReturn = result.summary.totalReturn;
    const sharpeRatio = result.signalAccuracy.accuracy > 0 ? totalReturn / Math.max(1, result.summary.maxDrawdown) : 0;
    const maxDrawdown = result.summary.maxDrawdown;
    const trades = result.summary.numberOfTrades;

    const normalizedReturn = Math.max(0, totalReturn / 50); // Normalize to 50% max return
    const normalizedSharpe = Math.max(0, Math.min(1, sharpeRatio / 3)); // Cap at 3
    const drawdownPenalty = Math.max(0, 1 - maxDrawdown / 20); // Penalize >20% drawdown
    const stabilityBonus = trades > 10 ? 1 : trades / 10; // Prefer strategies with more trades

    return (
      normalizedReturn * returnWeight +
      normalizedSharpe * sharpeWeight +
      drawdownPenalty * drawdownWeight +
      stabilityBonus * stabilityWeight
    );
  }

  /**
   * Generate all parameter combinations
   */
  private generateParameterCombinations(maxEvaluations: number): OptimizationParams[] {
    const ranges = this.getParameterRanges();
    const combinations: OptimizationParams[] = [];

    for (const riskThreshold of ranges.riskThreshold) {
      for (const minAPR of ranges.minAPR) {
        for (const volatilityFilter of ranges.volatilityFilter) {
          for (const momentumFilter of ranges.momentumFilter) {
            combinations.push({
              riskThreshold,
              minAPR,
              volatilityFilter,
              momentumFilter
            });
          }
        }
      }
    }

    // Shuffle and limit to maxEvaluations
    const shuffled = combinations.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, maxEvaluations);
  }

  /**
   * Run parameter optimization using grid search
   */
  async optimizeParameters(
    config: OptimizedBacktestConfig,
    maxEvaluations: number = 100
  ): Promise<OptimizationResult> {
    console.log('🚀 Starting ML parameter optimization...');
    console.log(`📊 Max evaluations: ${maxEvaluations}`);

    const parameterCombinations = this.generateParameterCombinations(maxEvaluations);
    console.log(`🔍 Testing ${parameterCombinations.length} parameter combinations`);

    let bestResult: OptimizationResult | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i < parameterCombinations.length; i++) {
      const params = parameterCombinations[i]!;
      const progress = ((i + 1) / parameterCombinations.length * 100).toFixed(1);
      
      console.log(`⏳ [${progress}%] Testing: risk=${params.riskThreshold}, APR=${params.minAPR}%, vol=${params.volatilityFilter ? 'Y' : 'N'}, mom=${params.momentumFilter ? 'Y' : 'N'}`);

      try {
        // Configure backtest with current parameters
        const testConfig: OptimizedBacktestConfig = {
          ...config,
          useML: true,
          riskThreshold: params.riskThreshold,
          minAPR: params.minAPR,
          volatilityFilter: params.volatilityFilter,
          momentumFilter: params.momentumFilter
        };

        // Run backtest
        const result = await this.engine.runOptimizedBacktest(testConfig);
        
        // Calculate score
        const score = this.calculateOptimizationScore(result);

        // Track best result
        if (score > bestScore) {
          bestScore = score;
          bestResult = {
            params,
            performance: {
              totalReturn: result.summary.totalReturn,
              sharpeRatio: result.signalAccuracy.accuracy,
              maxDrawdown: result.summary.maxDrawdown,
              winRate: result.summary.winRate,
              trades: result.summary.numberOfTrades
            },
            score
          };
          console.log(`🏆 New best! Score: ${score.toFixed(4)}, Return: ${result.summary.totalReturn.toFixed(2)}%`);
        }

      } catch (error) {
        console.warn(`⚠️ Failed to test parameters:`, error);
      }
    }

    if (!bestResult) {
      throw new Error('No valid parameter combinations found');
    }

    console.log('✅ Optimization completed!');
    console.log(`🏆 Best score: ${bestResult.score.toFixed(4)}`);
    console.log(`📈 Best return: ${bestResult.performance.totalReturn.toFixed(2)}%`);

    return bestResult;
  }

  /**
   * Run parameter optimization using parallel processing with Piscina
   */
  async optimizeParametersParallel(
    config: OptimizedBacktestConfig,
    maxEvaluations: number = 100,
    progressCallback?: (completed: number, total: number, bestScore: number) => void
  ): Promise<OptimizationResult> {
    console.log('🚀 Starting parallel ML parameter optimization...');
    console.log(`📊 Max evaluations: ${maxEvaluations}`);
    
    const parameterCombinations = this.generateParameterCombinations(maxEvaluations);
    console.log(`🔍 Testing ${parameterCombinations.length} parameter combinations in parallel`);

    // Calculate optimal worker configuration based on system resources
    const cpuCount = os.cpus().length;
    const memoryGB = Math.round(os.totalmem() / (1024 ** 3));
    
    // Conservative thread allocation: leave 1-2 cores for system/main thread
    const optimalThreads = Math.min(
      Math.max(1, cpuCount - 1), // Leave at least 1 core for system
      parameterCombinations.length, // Don't create more threads than tasks
      Math.floor(memoryGB / 2) // Rough estimate: 2GB per worker for ML processing
    );
    
    // Queue size: balance memory usage vs throughput
    const maxQueue = Math.min(
      Math.max(optimalThreads * 3, 20), // 3x thread count for good utilization
      100 // Cap at 100 to prevent excessive memory usage
    );
    
    // Minimum threads: keep some workers alive for quick response
    const minThreads = Math.min(2, optimalThreads);
    
    console.log(`🔧 Worker Pool Configuration:`);
    console.log(`   💻 CPU cores: ${cpuCount} (using ${optimalThreads} for workers)`);
    console.log(`   🧠 Memory: ${memoryGB}GB (estimated ${optimalThreads * 2}GB for workers)`);
    console.log(`   📋 Queue size: ${maxQueue} tasks`);
    console.log(`   ⚡ Min/Max threads: ${minThreads}/${optimalThreads}`);

    // Create optimized Piscina worker pool
    const workerPath = resolve(__dirname, '../workers/optimize-backtest-worker.js');
    const pool = new Piscina({
      filename: workerPath,
      minThreads: minThreads,
      maxThreads: optimalThreads,
      maxQueue: maxQueue,
      idleTimeout: 30000, // Keep workers alive for 30 seconds
      // Resource limits to prevent OOM
      resourceLimits: {
        maxOldGenerationSizeMb: 1024, // 1GB per worker max
        maxYoungGenerationSizeMb: 256, // 256MB for young generation
      },
    });

    let completedTasks = 0;
    let bestScore = -Infinity;

    try {
      // Create tasks for all parameter combinations
      const tasks: Promise<OptimizationResult>[] = parameterCombinations.map((params, index) => {
        const workerTask: WorkerTask = {
          config,
          params,
          workerIndex: index
        };
        
        return pool.run(workerTask).then((result: OptimizationResult) => {
          completedTasks++;
          const progress = (completedTasks / parameterCombinations.length * 100).toFixed(1);
          
          // Track best score for progress reporting
          if (result.score > bestScore) {
            bestScore = result.score;
            console.log(`🏆 [${progress}%] New best! Score: ${result.score.toFixed(4)}, Return: ${result.performance.totalReturn.toFixed(2)}% (Worker ${index})`);
          } else {
            console.log(`⏳ [${progress}%] Completed: score=${result.score.toFixed(4)}, return=${result.performance.totalReturn.toFixed(2)}% (Worker ${index})`);
          }

          // Call progress callback if provided
          if (progressCallback) {
            progressCallback(completedTasks, parameterCombinations.length, bestScore);
          }

          return result;
        }).catch((error: Error) => {
          completedTasks++;
          console.warn(`⚠️ Worker ${index} failed:`, error.message);
          throw error;
        });
      });

      // Wait for all tasks to complete
      console.log(`\n🔄 Processing ${parameterCombinations.length} parameter combinations...`);
      const results = await Promise.allSettled(tasks);
      
      // Extract successful results
      const successfulResults = results
        .filter((r): r is PromiseFulfilledResult<OptimizationResult> => r.status === 'fulfilled')
        .map(r => r.value);
      
      // Count successful vs failed tasks
      const successful = successfulResults.length;
      const failed = results.length - successful;
      
      console.log(`\n📊 Parallel execution completed:`);
      console.log(`   ✅ Successful: ${successful}/${results.length}`);
      console.log(`   ❌ Failed: ${failed}`);
      console.log(`   📈 Worker utilization: ${(pool.utilization * 100).toFixed(1)}%`);
      console.log(`   ⏱️  Average run time: ${pool.runTime.average?.toFixed(0)}ms`);
      console.log(`   📉 Min/Max run time: ${pool.runTime.min?.toFixed(0)}ms / ${pool.runTime.max?.toFixed(0)}ms`);
      console.log(`   ⌛ Average wait time: ${pool.waitTime.average?.toFixed(0)}ms`);
      console.log(`   🎯 Completed tasks: ${pool.completed}`);
      
      // Performance insights
      const avgTimePerTask = pool.runTime.average || 0;
      const totalTimeParallel = (pool.duration || 0);
      const estimatedSequentialTime = avgTimePerTask * parameterCombinations.length;
      const speedupRatio = estimatedSequentialTime > 0 ? estimatedSequentialTime / totalTimeParallel : 1;
      
      if (speedupRatio > 1.5) {
        console.log(`   🚀 Performance: ${speedupRatio.toFixed(1)}x faster than sequential!`);
      }

      // Find the best result from all successful results
      if (successfulResults.length === 0) {
        throw new Error('No valid parameter combinations found');
      }

      const bestResult = successfulResults.reduce((best, current) => 
        current.score > best.score ? current : best
      );

      console.log('✅ Parallel optimization completed!');
      console.log(`🏆 Best score: ${bestResult.score.toFixed(4)}`);
      console.log(`📈 Best return: ${bestResult.performance.totalReturn.toFixed(2)}%`);

      return bestResult;

    } finally {
      // Always clean up the worker pool
      await pool.destroy();
    }
  }

  /**
   * Validate specific parameters
   */
  async validateParameters(
    config: OptimizedBacktestConfig,
    params: OptimizationParams
  ): Promise<OptimizationResult> {
    const testConfig: OptimizedBacktestConfig = {
      ...config,
      useML: true,
      riskThreshold: params.riskThreshold,
      minAPR: params.minAPR,
      volatilityFilter: params.volatilityFilter,
      momentumFilter: params.momentumFilter
    };

    const result = await this.engine.runOptimizedBacktest(testConfig);
    const score = this.calculateOptimizationScore(result);

    return {
      params,
      performance: {
        totalReturn: result.summary.totalReturn,
        sharpeRatio: result.signalAccuracy.accuracy,
        maxDrawdown: result.summary.maxDrawdown,
        winRate: result.summary.winRate,
        trades: result.summary.numberOfTrades
      },
      score
    };
  }
}

program
  .name('optimize-ml')
  .description('Advanced ML parameter optimization using grid search')
  .option('-d, --days <number>', 'Number of days to optimize', '30')
  .option('-e, --evaluations <number>', 'Maximum optimization evaluations', '50')
  .option('-c, --capital <amount>', 'Initial capital', '10000')
  .option('--validate', 'Validate optimized parameters on longer period')
  .option('--baseline', 'Compare against current manual parameters')
  .option('-o, --output <format>', 'Output format: json, html, or both', 'both')
  .option('--parallel', 'Enable parallel processing with worker threads (faster, default)')
  .option('--sequential', 'Force sequential processing (slower, for debugging)')
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

      // Determine processing mode (parallel by default, unless sequential is explicitly requested)
      const useParallel = !options.sequential;
      const processingMode = useParallel ? 'parallel' : 'sequential';
      
      spinner.text = `🔍 Optimizing ML parameters over ${days} days (${maxEvaluations} evaluations, ${processingMode} mode)...`;

      // Initialize optimizer
      const optimizer = new MLParameterOptimizer();

      // Run baseline test if requested
      let baselineResult: OptimizationResult | null = null;
      if (options.baseline) {
        spinner.text = '📊 Running baseline test with current parameters...';
        
        const baselineParams: OptimizationParams = {
          riskThreshold: 0.6,
          minAPR: 6,
          volatilityFilter: false,
          momentumFilter: false
        };
        
        try {
          baselineResult = await optimizer.validateParameters(config, baselineParams);
          console.log(`\n📊 Baseline Performance:`);
          console.log(`   Return: ${baselineResult.performance.totalReturn.toFixed(2)}%`);
          console.log(`   Score: ${baselineResult.score.toFixed(4)}`);
        } catch (error: any) {
          console.warn('⚠️  Baseline test failed:', error.message);
        }
      }

      // Run optimization
      spinner.text = `🚀 Running ${processingMode} parameter optimization (${maxEvaluations} evaluations)...`;
      
      const optimizationResult = useParallel 
        ? await optimizer.optimizeParametersParallel(config, maxEvaluations)
        : await optimizer.optimizeParameters(config, maxEvaluations);

      spinner.succeed(`🎉 ${processingMode.charAt(0).toUpperCase() + processingMode.slice(1)} optimization completed!`);

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
          
          const consistencyScore = Math.abs(validationResult.performance.totalReturn - optimizationResult.performance.totalReturn) / Math.max(1, Math.abs(optimizationResult.performance.totalReturn));
          console.log(`Consistency: ${consistencyScore < 0.3 ? '🟢 Good' : consistencyScore < 0.6 ? '🟡 Moderate' : '🔴 Poor'} (${(100 - consistencyScore * 100).toFixed(1)}%)`);
          
        } catch (error: any) {
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

function generateHTMLReport(optimizationResult: OptimizationResult, baselineResult: OptimizationResult | null, config: any): string {
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