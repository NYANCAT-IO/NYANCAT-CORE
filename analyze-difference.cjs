#!/usr/bin/env node

// Quick analysis of why demo is positive but 59-day is negative
// This helps us understand the key differences before running full parameter sweep

const fs = require('fs');

console.log('🔍 Analyzing Demo vs 59-day ML Backtest Performance');
console.log('================================================\n');

// Read the current demo results (7-day)
let demoResults = null;
try {
    demoResults = JSON.parse(fs.readFileSync('backtest-optimized.json', 'utf8'));
    console.log('📊 Demo Results (7 days):');
    console.log(`  Return: ${demoResults.summary.totalReturn.toFixed(2)}%`);
    console.log(`  Trades: ${demoResults.summary.numberOfTrades}`);
    console.log(`  Win Rate: ${demoResults.summary.winRate.toFixed(1)}%`);
    console.log(`  Max Drawdown: ${demoResults.summary.maxDrawdown.toFixed(1)}%`);
    console.log('');
} catch (e) {
    console.log('❌ Could not read demo results (backtest-optimized.json)');
}

// Key parameters analysis
console.log('🎯 Key Parameter Differences:');
console.log('-----------------------------');
console.log('Demo mode (--demo):');
console.log('  - Duration: 7 days');
console.log('  - minAPR: 5% (lower threshold)');
console.log('  - Risk threshold: 0.6 (default)');
console.log('  - Filters: None by default');
console.log('');

console.log('59-day mode (--ml -d 59):');
console.log('  - Duration: 59 days');
console.log('  - minAPR: 6% (8% - 2% for ML)');
console.log('  - Risk threshold: 0.6 (default)');
console.log('  - Filters: None by default');
console.log('');

console.log('🤔 Potential Issues with 59-day backtest:');
console.log('----------------------------------------');
console.log('1. **Market Conditions**: 59 days includes more market volatility');
console.log('2. **Risk Threshold**: 0.6 may be too permissive for longer periods');
console.log('3. **APR Threshold**: 6% may not be selective enough');
console.log('4. **No Filters**: Volatility/momentum filters not enabled');
console.log('5. **Position Sizing**: May need adjustment for longer periods');
console.log('');

console.log('💡 Recommended Parameter Tests:');
console.log('-------------------------------');
console.log('1. Lower risk threshold: 0.3-0.5 (more selective)');
console.log('2. Higher APR threshold: 7-8% (better opportunities)');
console.log('3. Enable volatility filter (avoid high volatility)');
console.log('4. Enable momentum filter (avoid declining funding)');
console.log('5. Test intermediate durations: 14, 30 days');
console.log('');

// If we have demo results, analyze the trades
if (demoResults && demoResults.trades) {
    console.log('📈 Demo Trade Analysis:');
    console.log('----------------------');
    
    const profitableTrades = demoResults.trades.filter(t => t.totalReturn > 0);
    const unprofitableTrades = demoResults.trades.filter(t => t.totalReturn <= 0);
    
    console.log(`  Profitable trades: ${profitableTrades.length}`);
    console.log(`  Unprofitable trades: ${unprofitableTrades.length}`);
    
    if (profitableTrades.length > 0) {
        const avgProfit = profitableTrades.reduce((sum, t) => sum + t.totalReturn, 0) / profitableTrades.length;
        console.log(`  Average profit per winning trade: ${avgProfit.toFixed(2)}%`);
    }
    
    if (unprofitableTrades.length > 0) {
        const avgLoss = unprofitableTrades.reduce((sum, t) => sum + t.totalReturn, 0) / unprofitableTrades.length;
        console.log(`  Average loss per losing trade: ${avgLoss.toFixed(2)}%`);
    }
    
    // Analyze funding rates
    const fundingRates = demoResults.trades.map(t => t.expectedFundingRate || 0);
    if (fundingRates.length > 0) {
        const avgFunding = fundingRates.reduce((sum, r) => sum + r, 0) / fundingRates.length;
        console.log(`  Average funding rate: ${(avgFunding * 100).toFixed(3)}%`);
    }
}

console.log('\n🚀 Next Steps:');
console.log('-------------');
console.log('1. Run parameter sweep: ./param-sweep.sh');
console.log('2. Focus on risk threshold and APR combinations');
console.log('3. Test with volatility/momentum filters');
console.log('4. Analyze results to find optimal configuration');
console.log('');