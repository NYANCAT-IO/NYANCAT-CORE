/**
 * Graph Protocol entity models for ROFL backtest data
 */

import { Id } from '@graphprotocol/grc-20';

export interface GraphEntity {
  id: string;
  name: string;
  description: string;
  types: string[];
  cover?: string;
  values: GraphValue[];
  relations?: Record<string, GraphRelation>;
}

export interface GraphValue {
  property: string;
  value: string;
  options?: GraphValueOptions;
}

export interface GraphValueOptions {
  type: 'text' | 'number' | 'time' | 'point' | 'checkbox' | 'relation';
  language?: string;
  unit?: string;
}

export interface GraphRelation {
  toEntity: string;
  id?: string;
  position?: string;
  values?: GraphValue[];
}

export interface GraphProperty {
  id: string;
  name: string;
  type: 'TEXT' | 'NUMBER' | 'TIME' | 'POINT' | 'CHECKBOX' | 'RELATION';
  description?: string;
}

export interface GraphType {
  id: string;
  name: string;
  cover?: string;
  properties: string[];
  description?: string;
}

/**
 * Predefined property IDs for ROFL backtest entities
 */
export const BACKTEST_PROPERTIES = {
  // BacktestRun properties
  INITIAL_CAPITAL: Id.generate(),
  FINAL_CAPITAL: Id.generate(),
  TOTAL_RETURN: Id.generate(),
  TOTAL_RETURN_DOLLARS: Id.generate(),
  NUMBER_OF_TRADES: Id.generate(),
  WINNING_TRADES: Id.generate(),
  WIN_RATE: Id.generate(),
  MAX_DRAWDOWN: Id.generate(),
  TOTAL_DAYS: Id.generate(),
  STRATEGY: Id.generate(),
  CREATED_AT: Id.generate(),
  VERSION: Id.generate(),
  
  // EquityPoint properties
  TIMESTAMP: Id.generate(),
  VALUE: Id.generate(),
  
  // Position properties
  SYMBOL: Id.generate(),
  ENTRY_TIME: Id.generate(),
  EXIT_TIME: Id.generate(),
  ENTRY_SPOT_PRICE: Id.generate(),
  ENTRY_PERP_PRICE: Id.generate(),
  EXIT_SPOT_PRICE: Id.generate(),
  EXIT_PERP_PRICE: Id.generate(),
  QUANTITY: Id.generate(),
  TOTAL_PNL: Id.generate(),
  ENTRY_FUNDING_RATE: Id.generate(),
  ENTRY_FUNDING_APR: Id.generate(),
  EXIT_FUNDING_RATE: Id.generate(),
  EXIT_FUNDING_APR: Id.generate(),
  EXIT_REASON: Id.generate(),
  HOLDING_PERIOD_HOURS: Id.generate(),
  FUNDING_PERIODS_HELD: Id.generate(),
  SPOT_PNL: Id.generate(),
  PERP_PNL: Id.generate(),
  TOTAL_FUNDING: Id.generate(),
  ENTRY_FEES: Id.generate(),
  EXIT_FEES: Id.generate(),
  CONCURRENT_POSITIONS: Id.generate(),
  
  // Signal properties
  TREND: Id.generate(),
  STRENGTH: Id.generate(),
  AVG_DECLINE: Id.generate(),
  CURRENT_VOL: Id.generate(),
  AVG_VOL: Id.generate(),
  VOL_PERCENTILE: Id.generate(),
  IS_LOW_VOL: Id.generate(),
  RISK_SCORE: Id.generate(),
  ENTRY_RECOMMENDATION: Id.generate(),
  EXIT_RECOMMENDATION: Id.generate(),
  
  // Relation properties
  HAS_EQUITY_POINT: Id.generate(),
  HAS_POSITION: Id.generate(),
  HAS_ENTRY_SIGNALS: Id.generate(),
  HAS_EXIT_SIGNALS: Id.generate(),
  HAS_FUNDING_MOMENTUM: Id.generate(),
  HAS_VOLATILITY: Id.generate(),
} as const;

/**
 * Predefined type IDs for ROFL backtest entities
 */
export const BACKTEST_TYPES = {
  BACKTEST_RUN: Id.generate(),
  EQUITY_POINT: Id.generate(),
  POSITION: Id.generate(),
  TRADING_SIGNALS: Id.generate(),
  FUNDING_MOMENTUM: Id.generate(),
  VOLATILITY: Id.generate(),
} as const;