#!/bin/bash

# ML Parameter Optimization Script
# This script tests different parameter combinations to find optimal settings

WORKTREE_DIR="../ccxt-funding-ml-opt"
RESULTS_DIR="param-sweep-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create results directory
mkdir -p $RESULTS_DIR

echo "🚀 Starting ML Parameter Optimization Sweep"
echo "=============================================="

# Risk thresholds to test
RISK_THRESHOLDS=(0.3 0.4 0.5 0.6 0.7)
APR_THRESHOLDS=(4 5 6 7 8)
DAYS_TO_TEST=(7 14 30 59)

# Test base configuration first
echo "📊 Testing baseline configuration (demo mode)..."
cd $WORKTREE_DIR
pnpm tsc 2>/dev/null
pnpm backtest --ml --demo > "../ccxt-funding/$RESULTS_DIR/baseline_demo_${TIMESTAMP}.log" 2>&1
cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/baseline_demo_${TIMESTAMP}.json"

echo "📊 Testing baseline configuration (59 days)..."
pnpm backtest --ml -d 59 > "../ccxt-funding/$RESULTS_DIR/baseline_59d_${TIMESTAMP}.log" 2>&1
cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/baseline_59d_${TIMESTAMP}.json"

# Test risk thresholds
echo "🎯 Testing risk thresholds..."
for risk in "${RISK_THRESHOLDS[@]}"; do
    echo "  Testing risk threshold: $risk"
    pnpm backtest --ml -d 30 --risk-threshold $risk > "../ccxt-funding/$RESULTS_DIR/risk_${risk}_30d_${TIMESTAMP}.log" 2>&1
    cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/risk_${risk}_30d_${TIMESTAMP}.json"
done

# Test APR thresholds
echo "💰 Testing APR thresholds..."
for apr in "${APR_THRESHOLDS[@]}"; do
    echo "  Testing APR threshold: $apr%"
    pnpm backtest --ml -d 30 -m $apr > "../ccxt-funding/$RESULTS_DIR/apr_${apr}_30d_${TIMESTAMP}.log" 2>&1
    cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/apr_${apr}_30d_${TIMESTAMP}.json"
done

# Test filters
echo "🔍 Testing volatility filter..."
pnpm backtest --ml -d 30 --volatility-filter > "../ccxt-funding/$RESULTS_DIR/volatility_30d_${TIMESTAMP}.log" 2>&1
cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/volatility_30d_${TIMESTAMP}.json"

echo "📈 Testing momentum filter..."
pnpm backtest --ml -d 30 --momentum-filter > "../ccxt-funding/$RESULTS_DIR/momentum_30d_${TIMESTAMP}.log" 2>&1
cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/momentum_30d_${TIMESTAMP}.json"

echo "🔄 Testing combined filters..."
pnpm backtest --ml -d 30 --volatility-filter --momentum-filter > "../ccxt-funding/$RESULTS_DIR/combined_filters_30d_${TIMESTAMP}.log" 2>&1
cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/combined_filters_30d_${TIMESTAMP}.json"

# Test optimal combinations
echo "🎯 Testing optimal combinations..."
# High selectivity: low risk, high APR, with filters
pnpm backtest --ml -d 30 --risk-threshold 0.3 -m 7 --volatility-filter --momentum-filter > "../ccxt-funding/$RESULTS_DIR/optimal_conservative_30d_${TIMESTAMP}.log" 2>&1
cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/optimal_conservative_30d_${TIMESTAMP}.json"

# Balanced: medium risk, medium APR
pnpm backtest --ml -d 30 --risk-threshold 0.5 -m 6 --volatility-filter > "../ccxt-funding/$RESULTS_DIR/optimal_balanced_30d_${TIMESTAMP}.log" 2>&1
cp backtest-optimized.json "../ccxt-funding/$RESULTS_DIR/optimal_balanced_30d_${TIMESTAMP}.json"

cd "../ccxt-funding"

echo "✅ Parameter sweep completed!"
echo "📁 Results saved to: $RESULTS_DIR/"
echo "🔍 Check the JSON files for detailed performance metrics"

# Create summary report
echo "📊 Generating summary report..."
node -e "
const fs = require('fs');
const path = require('path');

const resultsDir = '$RESULTS_DIR';
const files = fs.readdirSync(resultsDir).filter(f => f.endsWith('.json'));

console.log('\\n🎯 PARAMETER SWEEP SUMMARY');
console.log('=========================\\n');

const results = files.map(file => {
    const data = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
    return {
        file: file.replace('.json', ''),
        return: data.summary.totalReturn,
        trades: data.summary.numberOfTrades,
        winRate: data.summary.winRate,
        maxDrawdown: data.summary.maxDrawdown,
        days: data.summary.totalDays
    };
});

results.sort((a, b) => b.return - a.return);

results.forEach(r => {
    console.log(\`\${r.file}\`);
    console.log(\`  Return: \${r.return.toFixed(2)}% | Trades: \${r.trades} | Win Rate: \${r.winRate.toFixed(1)}% | Max DD: \${r.maxDrawdown.toFixed(1)}%\`);
    console.log('');
});

console.log('🏆 Best performing configuration: ' + results[0].file);
console.log('📈 Best return: ' + results[0].return.toFixed(2) + '%');
"

echo "🎉 Analysis complete!"