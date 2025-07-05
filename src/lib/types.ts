/**
 * Type definitions for the funding rate CLI tool
 */

/**
 * Supported exchanges
 */
export type Exchange = 'bybit' | 'hyperliquid';

/**
 * Funding rate data from an exchange
 */
export interface FundingRate {
  exchange: Exchange;
  symbol: string;
  rate: number; // Current funding rate as a decimal (e.g., 0.0001 = 0.01%)
  timestamp: number; // Unix timestamp in milliseconds
  nextFundingTime: number; // Unix timestamp for next funding payment
  interval: string; // Funding interval (e.g., '8h' or '1h')
  annualizedRate: number; // Calculated annual percentage yield
}

/**
 * Result of comparing funding rates between exchanges
 */
export interface ComparisonResult {
  symbol: string;
  bybit: FundingRate | null;
  hyperliquid: FundingRate | null;
  spread: number; // Difference in rates (percentage points)
  favorableExchange: Exchange | 'none'; // Which exchange has better rate for long position
}

/**
 * Configuration for exchange connections
 */
export interface ExchangeConfig {
  bybit: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
    symbols: string[];
  };
  hyperliquid: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
    symbols: string[];
  };
}

/**
 * CLI configuration options
 */
export interface CliConfig {
  symbols: string[];
  outputFormat: 'table' | 'json' | 'csv';
  debug: boolean;
}

/**
 * Error types specific to funding operations
 */
export class FundingError extends Error {
  constructor(
    message: string,
    public readonly exchange?: Exchange,
    public readonly symbol?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FundingError';
  }
}

/**
 * Exchange adapter interface
 */
export interface IExchangeAdapter {
  readonly name: Exchange;
  connect(): Promise<void>;
  fetchFundingRate(symbol: string): Promise<FundingRate>;
  fetchFundingRates(symbols: string[]): Promise<FundingRate[]>;
  disconnect(): Promise<void>;
}