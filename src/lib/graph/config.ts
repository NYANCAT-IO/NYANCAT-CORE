/**
 * Graph Protocol configuration management for ROFL backtest data
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

config();

export interface GraphConfig {
  graph: {
    network: 'TESTNET' | 'MAINNET';
    apiUrl: string;
    ipfsUrl: string;
  };
  wallet: {
    privateKey?: string;
    address?: string;
  };
  space: {
    id?: string;
    name?: string;
  };
  app: {
    nodeEnv: string;
    logLevel: string;
  };
}

/**
 * Load and validate Graph Protocol configuration from environment variables
 */
export function loadGraphConfig(): GraphConfig {
  const requiredVars = ['GRAPH_NETWORK', 'GRAPH_API_URL'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required Graph Protocol environment variables: ${missingVars.join(', ')}\n` +
      'Please add the Graph Protocol configuration to your .env file.'
    );
  }

  const network = process.env.GRAPH_NETWORK as 'TESTNET' | 'MAINNET';
  if (!['TESTNET', 'MAINNET'].includes(network)) {
    throw new Error('GRAPH_NETWORK must be either TESTNET or MAINNET');
  }

  return {
    graph: {
      network,
      apiUrl: process.env.GRAPH_API_URL!,
      ipfsUrl: process.env.GRAPH_IPFS_URL || 'https://ipfs.hypergraph.xyz',
    },
    wallet: {
      privateKey: process.env.PRIVATE_KEY,
      address: process.env.WALLET_ADDRESS,
    },
    space: {
      id: process.env.SPACE_ID,
      name: process.env.SPACE_NAME || 'ROFL Backtest Results',
    },
    app: {
      nodeEnv: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'info',
    },
  };
}

/**
 * Check if Graph Protocol is configured
 */
export function isGraphConfigured(): boolean {
  try {
    loadGraphConfig();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if wallet is configured for Graph Protocol publishing
 */
export function isWalletConfigured(): boolean {
  const config = loadGraphConfig();
  return !!(config.wallet.privateKey && config.wallet.address);
}

/**
 * Check if required environment file exists
 */
export function checkEnvFile(): boolean {
  const envPath = join(process.cwd(), '.env');
  return existsSync(envPath);
}

/**
 * Get default Graph Protocol configuration for development
 */
export function getDefaultGraphConfig(): Partial<GraphConfig> {
  return {
    graph: {
      network: 'TESTNET',
      apiUrl: 'https://hypergraph-v2-testnet.up.railway.app',
      ipfsUrl: 'https://ipfs.hypergraph.xyz',
    },
    space: {
      name: 'ROFL Backtest Results',
    },
    app: {
      nodeEnv: 'development',
      logLevel: 'info',
    },
  };
}