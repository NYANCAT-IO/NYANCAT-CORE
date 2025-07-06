#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { 
  loadGraphConfig, 
  isGraphConfigured, 
  isWalletConfigured,
  ROFLBacktestEntityFactory,
  BacktestData,
  createBacktestMetadata
} from '../lib/graph/index.js';
import { Graph, Ipfs, getWalletClient } from '@graphprotocol/grc-20';

const program = new Command();

program
  .name('upload-graph')
  .description('Upload ROFL backtest results to The Graph Protocol')
  .option('-f, --file <path>', 'Specific JSON file to upload (default: auto-detect backtest-optimized.json)')
  .option('-n, --name <name>', 'Name for the backtest run')
  .option('-s, --strategy <strategy>', 'Strategy name', 'Delta-Neutral Funding Arbitrage (ROFL)')
  .option('-v, --version <version>', 'Version number', '1.0.0')
  .option('--space-id <id>', 'Space ID to upload to (overrides .env)')
  .option('--space-name <name>', 'Space name for new space (overrides .env)')
  .option('--dry-run', 'Validate and preview data without publishing')
  .option('--create-space', 'Create a new public space for the data')
  .option('--list-files', 'List available backtest JSON files and exit')
  .action(async (options) => {
    let spinner = ora('Starting Graph Protocol upload...').start();

    try {
      // Handle list-files option
      if (options.listFiles) {
        spinner.stop();
        await listAvailableFiles();
        return;
      }

      // Check Graph Protocol configuration
      spinner.text = 'Checking configuration...';
      if (!isGraphConfigured()) {
        spinner.fail('Graph Protocol not configured');
        console.log(chalk.yellow('\n💡 Please add Graph Protocol configuration to your .env file:'));
        console.log('GRAPH_NETWORK=TESTNET');
        console.log('GRAPH_API_URL=https://hypergraph-v2-testnet.up.railway.app');
        console.log('GRAPH_IPFS_URL=https://ipfs.hypergraph.xyz');
        console.log('PRIVATE_KEY=your_private_key_here');
        console.log('WALLET_ADDRESS=your_wallet_address_here');
        console.log('\n🔗 Get testnet ETH: https://faucet.conduit.xyz/geo-test-zc16z3tcvf');
        return;
      }

      const config = loadGraphConfig();
      spinner.succeed('Configuration loaded');

      // Find and load JSON file
      spinner = ora('Finding backtest data...').start();
      const filePath = await findBacktestFile(options.file);
      
      if (!filePath) {
        spinner.fail('No backtest JSON file found');
        console.log(chalk.yellow('\n💡 Available options:'));
        console.log('1. Run a backtest first: pnpm backtest --demo --ml');
        console.log('2. Specify a file: pnpm upload-graph -f /path/to/backtest.json');
        console.log('3. List available files: pnpm upload-graph --list-files');
        return;
      }

      const backtestData = await loadBacktestData(filePath);
      const fileName = filePath.split('/').pop() || 'unknown';
      const metadata = createBacktestMetadata(
        backtestData,
        options.name,
        options.strategy,
        options.version,
        fileName
      );

      spinner.succeed(`Loaded backtest data from ${fileName}`);

      // Show data summary
      console.log(chalk.blue('\n📊 ROFL Backtest Data Summary:'));
      console.log(`📁 File: ${fileName}`);
      console.log(`📈 Name: ${metadata.name}`);
      console.log(`🎯 Strategy: ${metadata.strategy}`);
      console.log(`🔢 Version: ${metadata.version}`);
      console.log(`💰 Initial Capital: $${backtestData.summary.initialCapital.toLocaleString()}`);
      console.log(`📊 Final Capital: $${backtestData.summary.finalCapital.toLocaleString()}`);
      console.log(`📈 Total Return: ${backtestData.summary.totalReturn.toFixed(2)}%`);
      console.log(`💵 Return ($): $${backtestData.summary.totalReturnDollars.toFixed(2)}`);
      console.log(`🔄 Trades: ${backtestData.summary.numberOfTrades}`);
      console.log(`🎯 Win Rate: ${backtestData.summary.winRate.toFixed(1)}%`);
      console.log(`📉 Max Drawdown: ${backtestData.summary.maxDrawdown.toFixed(2)}%`);
      console.log(`📅 Total Days: ${backtestData.summary.totalDays}`);
      console.log(`📈 Equity Points: ${backtestData.equityCurve.length}`);
      console.log(`📍 Positions: ${backtestData.positions.length}`);

      if (options.dryRun) {
        console.log(chalk.green('\n✅ Dry run completed - data is valid and ready for publishing'));
        console.log(chalk.blue('\n💡 To upload to Graph Protocol, run without --dry-run flag'));
        return;
      }

      // Check wallet configuration
      if (!isWalletConfigured()) {
        spinner.fail('Wallet not configured');
        console.log(chalk.yellow('\n💡 Please add your wallet credentials to .env:'));
        console.log('PRIVATE_KEY=your_private_key_here');
        console.log('WALLET_ADDRESS=your_wallet_address_here');
        console.log('\n⚠️  Use a dedicated wallet for this, not your main trading wallet');
        return;
      }

      // Initialize wallet client
      spinner = ora('Initializing wallet...').start();
      const walletClient = await getWalletClient({
        privateKey: config.wallet.privateKey as `0x${string}`,
      });
      spinner.succeed('Wallet initialized');

      // Determine space ID
      let spaceId = options.spaceId || config.space.id;
      
      if (!spaceId || options.createSpace) {
        spinner = ora('Creating new public space...').start();
        const spaceName = options.spaceName || config.space.name || 'ROFL Backtest Results';
        
        const space = await Graph.createSpace({
          editorAddress: config.wallet.address!,
          name: spaceName,
          network: config.graph.network,
        });
        
        spaceId = space.id;
        spinner.succeed(`Created space: ${spaceId}`);
        
        console.log(chalk.green(`\n🎉 New space created: ${spaceId}`));
        console.log(chalk.yellow('💡 Add this to your .env file: ') + `SPACE_ID=${spaceId}`);
      }

      // Initialize entity factory and create schema
      spinner = ora('Initializing Graph schema...').start();
      const factory = new ROFLBacktestEntityFactory();
      const schemaOps = await factory.initializeSchema();
      spinner.succeed('Graph schema initialized');

      // Create entities
      spinner = ora('Creating entities...').start();
      
      // Create backtest run entity
      const { id: backtestRunId, ops: backtestOps } = factory.createBacktestRunEntity(
        backtestData,
        metadata
      );

      // Create equity point entities
      const equityOps = factory.createEquityPointEntities(
        backtestRunId,
        backtestData.equityCurve
      );

      // Create position entities (with signals)
      const positionOps = factory.createPositionEntities(
        backtestRunId,
        backtestData.positions
      );

      // Combine all operations
      const allOps = [...schemaOps, ...backtestOps, ...equityOps, ...positionOps];
      
      const totalEntities = 1 + backtestData.equityCurve.length + backtestData.positions.length + 
        (backtestData.positions.length * 4); // Each position has entry/exit signals + momentum + volatility
      
      spinner.succeed(`Created ${allOps.length} operations for ${totalEntities} entities`);

      // Publish to IPFS
      spinner = ora('Publishing to IPFS...').start();
      const { cid } = await Ipfs.publishEdit({
        name: `ROFL Import: ${metadata.name}`,
        ops: allOps,
        author: config.wallet.address! as `0x${string}`,
        network: config.graph.network,
      });
      spinner.succeed(`Published to IPFS: ${cid}`);

      // Get onchain calldata
      spinner = ora('Preparing onchain transaction...').start();
      const response = await fetch(`${config.graph.apiUrl}/space/${spaceId}/edit/calldata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cid }),
      });

      if (!response.ok) {
        throw new Error(`Failed to get calldata: ${response.statusText}`);
      }

      const responseData = await response.json() as { to: string; data: string };
      spinner.succeed('Transaction prepared');

      // Submit transaction
      spinner = ora('Submitting transaction...').start();
      if (!walletClient.account) {
        throw new Error('Wallet account not available');
      }

      const txResult = await walletClient.sendTransaction({
        account: walletClient.account,
        to: responseData.to as `0x${string}`,
        value: 0n,
        data: responseData.data as `0x${string}`,
        chain: null,
      });
      spinner.succeed(`Transaction submitted: ${txResult}`);

      // Success message
      console.log(chalk.green('\n🎉 ROFL backtest data successfully uploaded to The Graph Protocol!'));
      console.log(chalk.blue('\n📋 Upload Summary:'));
      console.log(`🆔 Space ID: ${spaceId}`);
      console.log(`📦 IPFS CID: ${cid}`);
      console.log(`⛓️  Transaction: ${txResult}`);
      console.log(`🔍 Backtest Run ID: ${backtestRunId}`);
      console.log(`📊 Total Entities: ${totalEntities}`);
      
      console.log(chalk.yellow('\n💡 Next steps:'));
      console.log(`• Query your data: pnpm upload-graph --list-files`);
      console.log(`• View in Geo Browser: https://www.geobrowser.io/space/${spaceId}`);
      console.log(`• Share results: Space ID ${spaceId}`);

    } catch (error) {
      spinner.fail('Failed to upload data');
      
      if (error instanceof Error) {
        if (error.message.includes('File not found')) {
          console.log(chalk.yellow(`\n💡 Backtest file not found. Try running:`));
          console.log('pnpm backtest --demo --ml');
          console.log('pnpm upload-graph --list-files');
        } else if (error.message.includes('Invalid JSON')) {
          console.log(chalk.yellow('\n💡 The file contains invalid JSON. Please check the format.'));
        } else if (error.message.includes('Private key') || error.message.includes('Wallet')) {
          console.log(chalk.yellow('\n💡 Please configure your wallet in the .env file'));
        } else if (error.message.includes('configuration')) {
          console.log(chalk.yellow('\n💡 Please check your Graph Protocol configuration'));
        } else {
          console.log(chalk.red(`\n❌ Error: ${error.message}`));
        }
      } else {
        console.log(chalk.red('\n❌ Unknown error occurred'));
      }
      
      process.exit(1);
    }
  });

/**
 * Find the backtest JSON file to upload
 */
async function findBacktestFile(specifiedFile?: string): Promise<string | null> {
  // If file is specified, use it
  if (specifiedFile) {
    const fullPath = resolve(specifiedFile);
    if (existsSync(fullPath)) {
      return fullPath;
    }
    throw new Error(`File not found: ${specifiedFile}`);
  }

  // Auto-detect file in RESULTS_DIR or current directory
  const searchDirs = [
    process.env.RESULTS_DIR || '.',
    '.',
    './results',
  ].filter(Boolean).map(dir => resolve(dir));

  // Priority order for auto-detection
  const priorityFiles = [
    'backtest-optimized.json',  // ML-optimized results (highest priority)
    'backtest-comprehensive.json',
    'backtest-results.json',
  ];

  for (const dir of searchDirs) {
    for (const fileName of priorityFiles) {
      const filePath = join(dir, fileName);
      if (existsSync(filePath)) {
        return filePath;
      }
    }
  }

  return null;
}

/**
 * Load and validate backtest data from JSON file
 */
async function loadBacktestData(filePath: string): Promise<BacktestData> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as BacktestData;
    
    // Basic validation
    if (!data.summary || !data.equityCurve || !data.positions) {
      throw new Error('Invalid backtest data structure');
    }
    
    if (typeof data.summary.totalReturn !== 'number' || 
        typeof data.summary.numberOfTrades !== 'number') {
      throw new Error('Invalid summary data');
    }

    return data;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON format');
    }
    throw error;
  }
}

/**
 * List available backtest JSON files
 */
async function listAvailableFiles(): Promise<void> {
  console.log(chalk.blue('🔍 Searching for backtest JSON files...\n'));
  
  const searchDirs = [
    process.env.RESULTS_DIR || '.',
    '.',
    './results',
  ].filter(Boolean).map(dir => resolve(dir));

  const allFiles: Array<{path: string, size: number, modified: Date}> = [];

  for (const dir of searchDirs) {
    try {
      if (!existsSync(dir)) continue;
      
      const files = await fs.readdir(dir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && f.includes('backtest'));
      
      for (const file of jsonFiles) {
        const fullPath = join(dir, file);
        const stats = await fs.stat(fullPath);
        allFiles.push({
          path: fullPath,
          size: stats.size,
          modified: stats.mtime,
        });
      }
    } catch (error) {
      // Directory doesn't exist or can't be read, skip
    }
  }

  if (allFiles.length === 0) {
    console.log(chalk.yellow('📭 No backtest JSON files found.'));
    console.log(chalk.blue('\n💡 To create backtest data:'));
    console.log('pnpm backtest --demo --ml');
    return;
  }

  // Sort by priority, then by modification time
  allFiles.sort((a, b) => {
    const aFileName = a.path.split('/').pop() || '';
    const bFileName = b.path.split('/').pop() || '';
    
    // Priority order
    const priority = ['optimized', 'comprehensive', 'results'];
    const aPriority = priority.findIndex(p => aFileName.includes(p));
    const bPriority = priority.findIndex(p => bFileName.includes(p));
    
    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }
    
    return b.modified.getTime() - a.modified.getTime();
  });

  console.log(chalk.green(`📁 Found ${allFiles.length} backtest JSON file(s):\n`));
  
  allFiles.forEach((file, index) => {
    const fileName = file.path.split('/').pop();
    const sizeKB = (file.size / 1024).toFixed(1);
    const timeAgo = getTimeAgo(file.modified);
    const priority = index === 0 ? ' ⭐ (auto-detected)' : '';
    
    console.log(`${index + 1}. ${chalk.cyan(fileName)}${priority}`);
    console.log(`   📍 ${file.path}`);
    console.log(`   📊 ${sizeKB} KB, modified ${timeAgo}`);
    console.log('');
  });

  console.log(chalk.blue('💡 To upload a specific file:'));
  console.log(`pnpm upload-graph -f "${allFiles[0]?.path}"`);
  console.log('\n💡 To upload the auto-detected file:');
  console.log('pnpm upload-graph');
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

program.parse();

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}