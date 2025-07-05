# Performance Analysis: 30-Day Backtest with Valid Delta-Neutral Pairs

## Executive Summary

After implementing a valid pairs discovery system and filtering to only tradeable delta-neutral pairs (those with both spot and perpetual markets), the backtest results remain disappointing:

- **Total Return**: -9.09% over 30 days
- **Win Rate**: 1.8% (only 2 winning trades out of 112)
- **Max Drawdown**: 18.3%
- **Annualized Return**: -110.6%

## Key Findings

### 1. Valid Pairs Performance
Despite using only the top 30 liquid pairs with confirmed spot and perpetual markets, the strategy still performed poorly. This eliminates market availability as the issue and points to deeper strategy problems.

### 2. Timing Issues
The primary problem appears to be entry and exit timing:
- Strategy enters when funding is positive (often 10.95% APR)
- Funding rates quickly turn negative within 8-24 hours
- Average holding period when losing: 8-16 hours
- No ability to predict funding rate reversals

### 3. Funding Rate Volatility
Analysis of the trades reveals extreme funding rate volatility:
- Entry rates: Often 10.95% APR (maximum positive)
- Exit rates: Frequently -5% to -20% APR
- Rapid reversals: Many positions see funding flip negative within 1-2 funding periods

### 4. Symbol Performance
All symbols performed poorly:
- BTC: -$19.55 loss across 8 trades
- ETH: -$18.15 loss across 9 trades
- ARB: -$22.58 loss across 11 trades (worst performer)
- Best performers still negative: INJ had 1 winning trade out of 7

## Root Causes

### 1. Mean Reversion of Funding Rates
Funding rates exhibit strong mean reversion:
- When funding is extremely positive (>10% APR), it tends to revert to negative
- The strategy enters at peak positive funding, exactly when reversal is most likely

### 2. No Predictive Edge
The strategy has no mechanism to predict funding rate changes:
- Enters based on current high funding only
- No analysis of funding rate trends
- No consideration of market sentiment or order flow

### 3. Market Efficiency
The funding arbitrage opportunity appears to be efficiently priced:
- High positive funding rates compensate shorts for directional risk
- When that risk materializes (price moves), funding quickly adjusts
- No free lunch in simply capturing positive funding

## Recommendations

### 1. Abandon Pure Funding Arbitrage
The data strongly suggests that simple funding rate arbitrage is not profitable:
- Market is too efficient
- Funding rates mean-revert too quickly
- Transaction costs exceed the brief positive funding captured

### 2. Alternative Approaches
If continuing with delta-neutral strategies, consider:
- **Funding Rate Prediction**: Use ML to predict funding rate changes
- **Market Making**: Provide liquidity instead of taking funding
- **Statistical Arbitrage**: Find actual price discrepancies between spot/perp
- **Options Strategies**: Use options for better risk/reward

### 3. Risk Management Improvements
If the strategy must continue:
- Exit immediately when funding approaches zero (not waiting for negative)
- Smaller position sizes
- Diversification across uncorrelated strategies
- Stop losses on directional moves

## Conclusion

The comprehensive backtest with valid pairs confirms that the delta-neutral funding arbitrage strategy, as currently implemented, is not viable. The strategy consistently enters at funding rate peaks and suffers from rapid mean reversion. Without predictive capabilities or significant strategy modifications, this approach will continue to lose money.

The -9.09% loss over 30 days with only a 1.8% win rate represents a fundamentally flawed strategy, not an implementation issue. The team should consider pivoting to alternative approaches or significantly enhancing the strategy with predictive elements.