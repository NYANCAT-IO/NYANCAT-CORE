/**
 * Factory for creating Graph Protocol entities from ROFL backtest data
 */

import { Graph, Op } from '@graphprotocol/grc-20';
import {
  BacktestData,
  BacktestMetadata,
  EquityPoint,
  Position,
  TradingSignals,
  FundingMomentum,
  Volatility,
} from './backtest-models.js';
import {
  GraphProperty,
  BACKTEST_PROPERTIES,
  BACKTEST_TYPES,
} from './graph-entities.js';

export class ROFLBacktestEntityFactory {
  private ops: Op[] = [];

  /**
   * Initialize properties and types needed for ROFL backtest entities
   */
  async initializeSchema(): Promise<Op[]> {
    this.ops = [];

    // Create all properties
    await this.createProperties();
    
    // Create all types
    await this.createTypes();

    return this.ops;
  }

  /**
   * Create all necessary properties for ROFL backtest entities
   */
  private async createProperties(): Promise<void> {
    const propertyDefinitions: Array<{ id: string; name: string; dataType: GraphProperty['type'] }> = [
      // BacktestRun properties
      { id: BACKTEST_PROPERTIES.INITIAL_CAPITAL, name: 'Initial Capital', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.FINAL_CAPITAL, name: 'Final Capital', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.TOTAL_RETURN, name: 'Total Return (%)', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.TOTAL_RETURN_DOLLARS, name: 'Total Return ($)', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.NUMBER_OF_TRADES, name: 'Number of Trades', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.WINNING_TRADES, name: 'Winning Trades', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.WIN_RATE, name: 'Win Rate (%)', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.MAX_DRAWDOWN, name: 'Max Drawdown (%)', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.TOTAL_DAYS, name: 'Total Days', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.STRATEGY, name: 'Strategy', dataType: 'TEXT' },
      { id: BACKTEST_PROPERTIES.CREATED_AT, name: 'Created At', dataType: 'TIME' },
      { id: BACKTEST_PROPERTIES.VERSION, name: 'Version', dataType: 'TEXT' },
      
      // EquityPoint properties
      { id: BACKTEST_PROPERTIES.TIMESTAMP, name: 'Timestamp', dataType: 'TIME' },
      { id: BACKTEST_PROPERTIES.VALUE, name: 'Portfolio Value', dataType: 'NUMBER' },
      
      // Position properties
      { id: BACKTEST_PROPERTIES.SYMBOL, name: 'Symbol', dataType: 'TEXT' },
      { id: BACKTEST_PROPERTIES.ENTRY_TIME, name: 'Entry Time', dataType: 'TIME' },
      { id: BACKTEST_PROPERTIES.EXIT_TIME, name: 'Exit Time', dataType: 'TIME' },
      { id: BACKTEST_PROPERTIES.ENTRY_SPOT_PRICE, name: 'Entry Spot Price', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.ENTRY_PERP_PRICE, name: 'Entry Perp Price', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.EXIT_SPOT_PRICE, name: 'Exit Spot Price', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.EXIT_PERP_PRICE, name: 'Exit Perp Price', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.QUANTITY, name: 'Quantity', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.TOTAL_PNL, name: 'Total PnL', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.ENTRY_FUNDING_RATE, name: 'Entry Funding Rate', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.ENTRY_FUNDING_APR, name: 'Entry Funding APR (%)', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.EXIT_FUNDING_RATE, name: 'Exit Funding Rate', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.EXIT_FUNDING_APR, name: 'Exit Funding APR (%)', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.EXIT_REASON, name: 'Exit Reason', dataType: 'TEXT' },
      { id: BACKTEST_PROPERTIES.HOLDING_PERIOD_HOURS, name: 'Holding Period (Hours)', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.FUNDING_PERIODS_HELD, name: 'Funding Periods Held', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.SPOT_PNL, name: 'Spot PnL', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.PERP_PNL, name: 'Perp PnL', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.TOTAL_FUNDING, name: 'Total Funding', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.ENTRY_FEES, name: 'Entry Fees', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.EXIT_FEES, name: 'Exit Fees', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.CONCURRENT_POSITIONS, name: 'Concurrent Positions', dataType: 'NUMBER' },
      
      // Signal properties
      { id: BACKTEST_PROPERTIES.TREND, name: 'Funding Trend', dataType: 'TEXT' },
      { id: BACKTEST_PROPERTIES.STRENGTH, name: 'Trend Strength', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.AVG_DECLINE, name: 'Avg Decline', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.CURRENT_VOL, name: 'Current Volatility', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.AVG_VOL, name: 'Average Volatility', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.VOL_PERCENTILE, name: 'Volatility Percentile', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.IS_LOW_VOL, name: 'Is Low Volatility', dataType: 'CHECKBOX' },
      { id: BACKTEST_PROPERTIES.RISK_SCORE, name: 'ML Risk Score', dataType: 'NUMBER' },
      { id: BACKTEST_PROPERTIES.ENTRY_RECOMMENDATION, name: 'Entry Recommendation', dataType: 'TEXT' },
      { id: BACKTEST_PROPERTIES.EXIT_RECOMMENDATION, name: 'Exit Recommendation', dataType: 'TEXT' },
      
      // Relation properties
      { id: BACKTEST_PROPERTIES.HAS_EQUITY_POINT, name: 'Has Equity Point', dataType: 'RELATION' },
      { id: BACKTEST_PROPERTIES.HAS_POSITION, name: 'Has Position', dataType: 'RELATION' },
      { id: BACKTEST_PROPERTIES.HAS_ENTRY_SIGNALS, name: 'Has Entry Signals', dataType: 'RELATION' },
      { id: BACKTEST_PROPERTIES.HAS_EXIT_SIGNALS, name: 'Has Exit Signals', dataType: 'RELATION' },
      { id: BACKTEST_PROPERTIES.HAS_FUNDING_MOMENTUM, name: 'Has Funding Momentum', dataType: 'RELATION' },
      { id: BACKTEST_PROPERTIES.HAS_VOLATILITY, name: 'Has Volatility', dataType: 'RELATION' },
    ];

    for (const prop of propertyDefinitions) {
      const { ops } = Graph.createProperty({
        id: prop.id,
        name: prop.name,
        dataType: prop.dataType,
      });
      this.ops.push(...ops);
    }
  }

  /**
   * Create all necessary types for ROFL backtest entities
   */
  private async createTypes(): Promise<void> {
    const typeDefinitions: Array<{ id: string; name: string; properties: string[] }> = [
      {
        id: BACKTEST_TYPES.BACKTEST_RUN,
        name: 'ROFL Backtest Run',
        properties: [
          BACKTEST_PROPERTIES.INITIAL_CAPITAL,
          BACKTEST_PROPERTIES.FINAL_CAPITAL,
          BACKTEST_PROPERTIES.TOTAL_RETURN,
          BACKTEST_PROPERTIES.TOTAL_RETURN_DOLLARS,
          BACKTEST_PROPERTIES.NUMBER_OF_TRADES,
          BACKTEST_PROPERTIES.WINNING_TRADES,
          BACKTEST_PROPERTIES.WIN_RATE,
          BACKTEST_PROPERTIES.MAX_DRAWDOWN,
          BACKTEST_PROPERTIES.TOTAL_DAYS,
          BACKTEST_PROPERTIES.STRATEGY,
          BACKTEST_PROPERTIES.CREATED_AT,
          BACKTEST_PROPERTIES.VERSION,
          BACKTEST_PROPERTIES.HAS_EQUITY_POINT,
          BACKTEST_PROPERTIES.HAS_POSITION,
        ],
      },
      {
        id: BACKTEST_TYPES.EQUITY_POINT,
        name: 'Portfolio Equity Point',
        properties: [
          BACKTEST_PROPERTIES.TIMESTAMP,
          BACKTEST_PROPERTIES.VALUE,
        ],
      },
      {
        id: BACKTEST_TYPES.POSITION,
        name: 'Trading Position',
        properties: [
          BACKTEST_PROPERTIES.SYMBOL,
          BACKTEST_PROPERTIES.ENTRY_TIME,
          BACKTEST_PROPERTIES.EXIT_TIME,
          BACKTEST_PROPERTIES.ENTRY_SPOT_PRICE,
          BACKTEST_PROPERTIES.ENTRY_PERP_PRICE,
          BACKTEST_PROPERTIES.EXIT_SPOT_PRICE,
          BACKTEST_PROPERTIES.EXIT_PERP_PRICE,
          BACKTEST_PROPERTIES.QUANTITY,
          BACKTEST_PROPERTIES.TOTAL_PNL,
          BACKTEST_PROPERTIES.ENTRY_FUNDING_RATE,
          BACKTEST_PROPERTIES.ENTRY_FUNDING_APR,
          BACKTEST_PROPERTIES.EXIT_FUNDING_RATE,
          BACKTEST_PROPERTIES.EXIT_FUNDING_APR,
          BACKTEST_PROPERTIES.EXIT_REASON,
          BACKTEST_PROPERTIES.HOLDING_PERIOD_HOURS,
          BACKTEST_PROPERTIES.FUNDING_PERIODS_HELD,
          BACKTEST_PROPERTIES.SPOT_PNL,
          BACKTEST_PROPERTIES.PERP_PNL,
          BACKTEST_PROPERTIES.TOTAL_FUNDING,
          BACKTEST_PROPERTIES.ENTRY_FEES,
          BACKTEST_PROPERTIES.EXIT_FEES,
          BACKTEST_PROPERTIES.CONCURRENT_POSITIONS,
          BACKTEST_PROPERTIES.HAS_ENTRY_SIGNALS,
          BACKTEST_PROPERTIES.HAS_EXIT_SIGNALS,
        ],
      },
      {
        id: BACKTEST_TYPES.TRADING_SIGNALS,
        name: 'ML Trading Signals',
        properties: [
          BACKTEST_PROPERTIES.RISK_SCORE,
          BACKTEST_PROPERTIES.ENTRY_RECOMMENDATION,
          BACKTEST_PROPERTIES.EXIT_RECOMMENDATION,
          BACKTEST_PROPERTIES.HAS_FUNDING_MOMENTUM,
          BACKTEST_PROPERTIES.HAS_VOLATILITY,
        ],
      },
      {
        id: BACKTEST_TYPES.FUNDING_MOMENTUM,
        name: 'Funding Rate Momentum',
        properties: [
          BACKTEST_PROPERTIES.SYMBOL,
          BACKTEST_PROPERTIES.TREND,
          BACKTEST_PROPERTIES.STRENGTH,
          BACKTEST_PROPERTIES.AVG_DECLINE,
        ],
      },
      {
        id: BACKTEST_TYPES.VOLATILITY,
        name: 'Market Volatility',
        properties: [
          BACKTEST_PROPERTIES.SYMBOL,
          BACKTEST_PROPERTIES.CURRENT_VOL,
          BACKTEST_PROPERTIES.AVG_VOL,
          BACKTEST_PROPERTIES.VOL_PERCENTILE,
          BACKTEST_PROPERTIES.IS_LOW_VOL,
        ],
      },
    ];

    for (const type of typeDefinitions) {
      const { ops } = Graph.createType({
        id: type.id,
        name: type.name,
        properties: type.properties,
      });
      this.ops.push(...ops);
    }
  }

  /**
   * Create a ROFL backtest run entity from backtest data
   */
  createBacktestRunEntity(
    backtestData: BacktestData,
    metadata: BacktestMetadata
  ): { id: string; ops: Op[] } {
    const { summary } = backtestData;
    
    const { id, ops } = Graph.createEntity({
      name: metadata.name,
      description: metadata.description,
      types: [BACKTEST_TYPES.BACKTEST_RUN],
      values: [
        {
          property: BACKTEST_PROPERTIES.INITIAL_CAPITAL,
          value: Graph.serializeNumber(summary.initialCapital),
        },
        {
          property: BACKTEST_PROPERTIES.FINAL_CAPITAL,
          value: Graph.serializeNumber(summary.finalCapital),
        },
        {
          property: BACKTEST_PROPERTIES.TOTAL_RETURN,
          value: Graph.serializeNumber(summary.totalReturn),
        },
        {
          property: BACKTEST_PROPERTIES.TOTAL_RETURN_DOLLARS,
          value: Graph.serializeNumber(summary.totalReturnDollars),
        },
        {
          property: BACKTEST_PROPERTIES.NUMBER_OF_TRADES,
          value: Graph.serializeNumber(summary.numberOfTrades),
        },
        {
          property: BACKTEST_PROPERTIES.WINNING_TRADES,
          value: Graph.serializeNumber(summary.winningTrades),
        },
        {
          property: BACKTEST_PROPERTIES.WIN_RATE,
          value: Graph.serializeNumber(summary.winRate),
        },
        {
          property: BACKTEST_PROPERTIES.MAX_DRAWDOWN,
          value: Graph.serializeNumber(summary.maxDrawdown),
        },
        {
          property: BACKTEST_PROPERTIES.TOTAL_DAYS,
          value: Graph.serializeNumber(summary.totalDays),
        },
        {
          property: BACKTEST_PROPERTIES.STRATEGY,
          value: metadata.strategy,
        },
        {
          property: BACKTEST_PROPERTIES.CREATED_AT,
          value: Graph.serializeDate(metadata.createdAt),
        },
        {
          property: BACKTEST_PROPERTIES.VERSION,
          value: metadata.version,
        },
      ],
    });

    return { id, ops };
  }

  /**
   * Create equity point entities and relations to backtest run
   */
  createEquityPointEntities(
    backtestRunId: string,
    equityCurve: EquityPoint[]
  ): Op[] {
    const ops: Op[] = [];

    for (const point of equityCurve) {
      const { id: pointId, ops: createOps } = Graph.createEntity({
        name: `Equity ${new Date(point.timestamp).toISOString()}`,
        description: `Portfolio value: $${point.value.toFixed(2)} at ${new Date(point.timestamp).toISOString()}`,
        types: [BACKTEST_TYPES.EQUITY_POINT],
        values: [
          {
            property: BACKTEST_PROPERTIES.TIMESTAMP,
            value: Graph.serializeDate(new Date(point.timestamp)),
          },
          {
            property: BACKTEST_PROPERTIES.VALUE,
            value: Graph.serializeNumber(point.value),
          },
        ],
      });

      ops.push(...createOps);

      // Create relation from backtest run to equity point
      const { ops: relationOps } = Graph.createRelation({
        fromEntity: backtestRunId,
        toEntity: pointId,
        type: BACKTEST_PROPERTIES.HAS_EQUITY_POINT,
      });

      ops.push(...relationOps);
    }

    return ops;
  }

  /**
   * Create position entities and their related signal entities
   */
  createPositionEntities(backtestRunId: string, positions: Position[]): Op[] {
    const ops: Op[] = [];

    for (const position of positions) {
      // Create position entity
      const { id: positionId, ops: positionOps } = Graph.createEntity({
        name: `${position.symbol} Position`,
        description: `${position.symbol} trade: $${position.totalPnL.toFixed(2)} PnL (${position.exitReason})`,
        types: [BACKTEST_TYPES.POSITION],
        values: [
          {
            property: BACKTEST_PROPERTIES.SYMBOL,
            value: position.symbol,
          },
          {
            property: BACKTEST_PROPERTIES.ENTRY_TIME,
            value: Graph.serializeDate(new Date(position.entryTime)),
          },
          {
            property: BACKTEST_PROPERTIES.EXIT_TIME,
            value: Graph.serializeDate(new Date(position.exitTime)),
          },
          {
            property: BACKTEST_PROPERTIES.ENTRY_SPOT_PRICE,
            value: Graph.serializeNumber(position.entrySpotPrice),
          },
          {
            property: BACKTEST_PROPERTIES.ENTRY_PERP_PRICE,
            value: Graph.serializeNumber(position.entryPerpPrice),
          },
          {
            property: BACKTEST_PROPERTIES.EXIT_SPOT_PRICE,
            value: Graph.serializeNumber(position.exitSpotPrice),
          },
          {
            property: BACKTEST_PROPERTIES.EXIT_PERP_PRICE,
            value: Graph.serializeNumber(position.exitPerpPrice),
          },
          {
            property: BACKTEST_PROPERTIES.QUANTITY,
            value: Graph.serializeNumber(position.quantity),
          },
          {
            property: BACKTEST_PROPERTIES.TOTAL_PNL,
            value: Graph.serializeNumber(position.totalPnL),
          },
          {
            property: BACKTEST_PROPERTIES.ENTRY_FUNDING_RATE,
            value: Graph.serializeNumber(position.entryFundingRate),
          },
          {
            property: BACKTEST_PROPERTIES.ENTRY_FUNDING_APR,
            value: Graph.serializeNumber(position.entryFundingAPR),
          },
          {
            property: BACKTEST_PROPERTIES.EXIT_FUNDING_RATE,
            value: Graph.serializeNumber(position.exitFundingRate),
          },
          {
            property: BACKTEST_PROPERTIES.EXIT_FUNDING_APR,
            value: Graph.serializeNumber(position.exitFundingAPR),
          },
          {
            property: BACKTEST_PROPERTIES.EXIT_REASON,
            value: position.exitReason,
          },
          {
            property: BACKTEST_PROPERTIES.HOLDING_PERIOD_HOURS,
            value: Graph.serializeNumber(position.holdingPeriodHours),
          },
          {
            property: BACKTEST_PROPERTIES.FUNDING_PERIODS_HELD,
            value: Graph.serializeNumber(position.fundingPeriodsHeld),
          },
          {
            property: BACKTEST_PROPERTIES.SPOT_PNL,
            value: Graph.serializeNumber(position.spotPnL),
          },
          {
            property: BACKTEST_PROPERTIES.PERP_PNL,
            value: Graph.serializeNumber(position.perpPnL),
          },
          {
            property: BACKTEST_PROPERTIES.TOTAL_FUNDING,
            value: Graph.serializeNumber(position.totalFunding),
          },
          {
            property: BACKTEST_PROPERTIES.ENTRY_FEES,
            value: Graph.serializeNumber(position.entryFees),
          },
          {
            property: BACKTEST_PROPERTIES.EXIT_FEES,
            value: Graph.serializeNumber(position.exitFees),
          },
          {
            property: BACKTEST_PROPERTIES.CONCURRENT_POSITIONS,
            value: Graph.serializeNumber(position.concurrentPositions),
          },
        ],
      });

      ops.push(...positionOps);

      // Create relation from backtest run to position
      const { ops: backtestPositionRelationOps } = Graph.createRelation({
        fromEntity: backtestRunId,
        toEntity: positionId,
        type: BACKTEST_PROPERTIES.HAS_POSITION,
      });

      ops.push(...backtestPositionRelationOps);

      // Create entry signals entities
      const entrySignalsOps = this.createSignalEntities(
        positionId,
        position.entrySignals,
        'Entry',
        BACKTEST_PROPERTIES.HAS_ENTRY_SIGNALS
      );
      ops.push(...entrySignalsOps);

      // Create exit signals entities
      const exitSignalsOps = this.createSignalEntities(
        positionId,
        position.exitSignals,
        'Exit',
        BACKTEST_PROPERTIES.HAS_EXIT_SIGNALS
      );
      ops.push(...exitSignalsOps);
    }

    return ops;
  }

  /**
   * Create signal entities (entry or exit signals)
   */
  private createSignalEntities(
    positionId: string,
    signals: TradingSignals,
    signalType: 'Entry' | 'Exit',
    relationProperty: string
  ): Op[] {
    const ops: Op[] = [];

    // Create trading signals entity
    const { id: signalsId, ops: signalsOps } = Graph.createEntity({
      name: `${signalType} ML Signals`,
      description: `${signalType} signals: ${signals.entryRecommendation}/${signals.exitRecommendation} (Risk: ${signals.riskScore})`,
      types: [BACKTEST_TYPES.TRADING_SIGNALS],
      values: [
        {
          property: BACKTEST_PROPERTIES.RISK_SCORE,
          value: Graph.serializeNumber(signals.riskScore),
        },
        {
          property: BACKTEST_PROPERTIES.ENTRY_RECOMMENDATION,
          value: signals.entryRecommendation,
        },
        {
          property: BACKTEST_PROPERTIES.EXIT_RECOMMENDATION,
          value: signals.exitRecommendation,
        },
      ],
    });

    ops.push(...signalsOps);

    // Create relation from position to signals
    const { ops: positionSignalsRelationOps } = Graph.createRelation({
      fromEntity: positionId,
      toEntity: signalsId,
      type: relationProperty,
    });

    ops.push(...positionSignalsRelationOps);

    // Create funding momentum entity
    const fundingMomentumOps = this.createFundingMomentumEntity(
      signalsId,
      signals.fundingMomentum
    );
    ops.push(...fundingMomentumOps);

    // Create volatility entity
    const volatilityOps = this.createVolatilityEntity(signalsId, signals.volatility);
    ops.push(...volatilityOps);

    return ops;
  }

  /**
   * Create funding momentum entity
   */
  private createFundingMomentumEntity(
    signalsId: string,
    fundingMomentum: FundingMomentum
  ): Op[] {
    const { id: momentumId, ops: momentumOps } = Graph.createEntity({
      name: `${fundingMomentum.symbol} Funding Momentum`,
      description: `Funding trend: ${fundingMomentum.trend} (strength: ${fundingMomentum.strength})`,
      types: [BACKTEST_TYPES.FUNDING_MOMENTUM],
      values: [
        {
          property: BACKTEST_PROPERTIES.SYMBOL,
          value: fundingMomentum.symbol,
        },
        {
          property: BACKTEST_PROPERTIES.TREND,
          value: fundingMomentum.trend,
        },
        {
          property: BACKTEST_PROPERTIES.STRENGTH,
          value: Graph.serializeNumber(fundingMomentum.strength),
        },
        {
          property: BACKTEST_PROPERTIES.AVG_DECLINE,
          value: Graph.serializeNumber(fundingMomentum.avgDecline),
        },
      ],
    });

    // Create relation from signals to funding momentum
    const { ops: relationOps } = Graph.createRelation({
      fromEntity: signalsId,
      toEntity: momentumId,
      type: BACKTEST_PROPERTIES.HAS_FUNDING_MOMENTUM,
    });

    return [...momentumOps, ...relationOps];
  }

  /**
   * Create volatility entity
   */
  private createVolatilityEntity(signalsId: string, volatility: Volatility): Op[] {
    const { id: volatilityId, ops: volatilityOps } = Graph.createEntity({
      name: `${volatility.symbol} Volatility`,
      description: `Vol: ${(volatility.currentVol * 100).toFixed(1)}% (${volatility.isLowVol ? 'Low' : 'High'})`,
      types: [BACKTEST_TYPES.VOLATILITY],
      values: [
        {
          property: BACKTEST_PROPERTIES.SYMBOL,
          value: volatility.symbol,
        },
        {
          property: BACKTEST_PROPERTIES.CURRENT_VOL,
          value: Graph.serializeNumber(volatility.currentVol),
        },
        {
          property: BACKTEST_PROPERTIES.AVG_VOL,
          value: Graph.serializeNumber(volatility.avgVol),
        },
        {
          property: BACKTEST_PROPERTIES.VOL_PERCENTILE,
          value: Graph.serializeNumber(volatility.volPercentile),
        },
        {
          property: BACKTEST_PROPERTIES.IS_LOW_VOL,
          value: Graph.serializeCheckbox(volatility.isLowVol),
        },
      ],
    });

    // Create relation from signals to volatility
    const { ops: relationOps } = Graph.createRelation({
      fromEntity: signalsId,
      toEntity: volatilityId,
      type: BACKTEST_PROPERTIES.HAS_VOLATILITY,
    });

    return [...volatilityOps, ...relationOps];
  }

  /**
   * Get all operations created during entity building
   */
  getOps(): Op[] {
    return this.ops;
  }

  /**
   * Clear operations array
   */
  clearOps(): void {
    this.ops = [];
  }
}