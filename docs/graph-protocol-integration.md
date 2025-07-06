# Graph Protocol Integration - ROFL Backtest Upload

## 📋 Overview

The ROFL system now includes comprehensive integration with The Graph Protocol to upload ML-optimized backtest results to decentralized storage. This allows for:

- **Permanent Storage**: Backtest results stored on IPFS with blockchain verification
- **Queryable Data**: Rich entity relationships for complex data analysis
- **Verifiable Results**: Immutable proof of ROFL TEE-generated trading performance
- **Public Sharing**: Shareable space IDs for community verification

## 🎯 Key Features

### **Automatic File Detection**
- Auto-detects `backtest-optimized.json` (highest priority for ML results)
- Searches in `RESULTS_DIR`, current directory, and `./results/`
- Lists all available backtest files with metadata

### **Rich Data Modeling**
- **BacktestRun**: Summary metrics and metadata
- **EquityPoint**: Time series portfolio value data (21 points)
- **Position**: Individual trade details (16 positions)
- **TradingSignals**: ML entry/exit recommendations
- **FundingMomentum**: Funding rate trend analysis
- **Volatility**: Market volatility metrics

### **Docker Compatibility**
- Works in both local development and Docker container
- Respects `RESULTS_DIR` and `DATA_DIR` environment variables
- Seamless integration with existing ROFL workflow

## ⚙️ Configuration

### **Environment Variables (.env)**

```bash
# ========== GRAPH PROTOCOL CONFIGURATION ==========
# The Graph Protocol for uploading backtest results to decentralized storage
# Get testnet ETH from: https://faucet.conduit.xyz/geo-test-zc16z3tcvf

# The Graph Protocol Network Configuration
GRAPH_NETWORK=TESTNET
GRAPH_API_URL=https://hypergraph-v2-testnet.up.railway.app
GRAPH_IPFS_URL=https://ipfs.hypergraph.xyz

# Wallet Configuration (for publishing backtest data to Graph Protocol)
# WARNING: Use a dedicated wallet for this, not your main trading wallet
PRIVATE_KEY=your_private_key_here
WALLET_ADDRESS=your_wallet_address_here

# Optional: Custom Graph Protocol space configuration
# Leave blank to auto-create a new space for your backtest data
SPACE_ID=your_space_id_here
SPACE_NAME="ROFL Backtest Results"
```

### **Prerequisites**

1. **Testnet Wallet**: Get a dedicated wallet for publishing data
2. **Testnet ETH**: Obtain from https://faucet.conduit.xyz/geo-test-zc16z3tcvf
3. **Backtest Data**: Run a backtest to generate JSON data

## 🚀 Usage

### **Basic Commands**

```bash
# List available backtest files
pnpm upload-graph --list-files

# Validate data without uploading (dry run)
pnpm upload-graph --dry-run

# Upload auto-detected backtest-optimized.json
pnpm upload-graph

# Upload specific file
pnpm upload-graph -f /path/to/backtest.json

# Create new space and upload
pnpm upload-graph --create-space --space-name "My ROFL Results"
```

### **Complete Workflow Example**

```bash
# 1. Generate ML-optimized backtest data
pnpm backtest --demo --ml

# 2. Validate data before upload
pnpm upload-graph --dry-run

# 3. Upload to Graph Protocol
pnpm upload-graph

# 4. View results in Geo Browser
# Opens: https://www.geobrowser.io/space/{SPACE_ID}
```

### **Docker Workflow**

```bash
# Build container with Graph Protocol integration
docker-compose build

# Run demo and generate results
docker-compose run --rm funding-arbitrage sh -c "
  node dist/cli/fetch-historical.js -d 8 --valid-only &&
  node dist/cli/backtest.js --demo --ml &&
  node dist/cli/upload-graph.js --dry-run
"

# Upload from container (with credentials configured)
docker-compose run --rm funding-arbitrage node dist/cli/upload-graph.js
```

## 📊 Data Upload Results

### **Example Upload Summary**
```
🎉 ROFL backtest data successfully uploaded to The Graph Protocol!

📋 Upload Summary:
🆔 Space ID: space-id-123abc
📦 IPFS CID: ipfs://bafkreicgegvqtdjexjdjr6ffpdruojgftvfkorc4uyubajzd3jq2wqzdju
⛓️  Transaction: 0x1234567890abcdef...
🔍 Backtest Run ID: backtest-run-456def
📊 Total Entities: 102

💡 Next steps:
• Query your data: pnpm upload-graph --list-files
• View in Geo Browser: https://www.geobrowser.io/space/space-id-123abc
• Share results: Space ID space-id-123abc
```

### **Typical Entity Counts**
- **1 BacktestRun**: Main summary entity
- **21 EquityPoints**: Portfolio value over time
- **16 Positions**: Individual trades
- **32 TradingSignals**: Entry/exit signals (2 per position)
- **32 Market Indicators**: Funding momentum + volatility data

**Total**: ~102 entities with 623 Graph Protocol operations

## 🔍 Data Verification

### **Local Testing**
```bash
# Check configuration
pnpm upload-graph --dry-run

# List detected files with metadata
pnpm upload-graph --list-files

# Validate data structure
node -e "console.log(JSON.parse(require('fs').readFileSync('./backtest-optimized.json')).summary)"
```

### **Container Testing**
```bash
# Verify Graph Protocol CLI in container
docker-compose run --rm funding-arbitrage node dist/cli/upload-graph.js --list-files

# Test dry run in container environment
docker-compose run --rm funding-arbitrage node dist/cli/upload-graph.js --dry-run
```

## 🛠️ Technical Implementation

### **File Structure**
```
src/lib/graph/
├── backtest-models.ts      # Data type definitions
├── config.ts               # Configuration management
├── entity-factory.ts       # Graph Protocol entity creation
├── graph-entities.ts       # Property and type definitions
└── index.ts                # Module exports

src/cli/
└── upload-graph.ts         # CLI tool implementation
```

### **Key Dependencies**
- `@graphprotocol/grc-20`: Core Graph Protocol library
- `graphql`: GraphQL support
- `graphql-request`: GraphQL client

### **Integration Points**
- **Data Source**: Backtest JSON files from `src/cli/backtest.ts`
- **Path Resolution**: Uses `RESULTS_DIR` environment variable
- **Container Compatibility**: Works with `/app/results/` mount point

## 📈 Performance Metrics

### **Upload Performance**
- **Data Processing**: ~1-2 seconds for 16 positions
- **IPFS Publishing**: ~3-5 seconds  
- **Transaction**: ~10-30 seconds (depending on network)
- **Total Time**: ~15-40 seconds for complete upload

### **Storage Efficiency**
- **JSON Source**: ~120KB for 7-day backtest
- **Graph Entities**: 623 operations for 102 entities
- **IPFS Storage**: Compressed and deduplicated

## 🚨 Troubleshooting

### **Configuration Issues**
```bash
# Missing Graph Protocol config
Error: Missing required Graph Protocol environment variables: GRAPH_NETWORK, GRAPH_API_URL

# Solution: Add Graph Protocol configuration to .env file
```

### **Wallet Issues**
```bash
# Missing wallet credentials
Error: Wallet not configured

# Solution: Add PRIVATE_KEY and WALLET_ADDRESS to .env
```

### **File Detection Issues**
```bash
# No backtest files found
📭 No backtest JSON files found.

# Solution: Run backtest first
pnpm backtest --demo --ml
```

### **Network Issues**
```bash
# Transaction failed
Error: Failed to get calldata: Internal Server Error

# Possible causes:
# - Testnet API down
# - Invalid space ID
# - Network connectivity issues
# - Insufficient testnet ETH
```

## 🔐 Security Considerations

### **Wallet Security**
- ⚠️ **Use dedicated wallet** for Graph Protocol publishing
- ⚠️ **Never use main trading wallet** for uploads
- ⚠️ **Keep private keys secure** and never commit to git

### **Data Privacy**
- 📊 **Backtest data is public** once uploaded to Graph Protocol
- 🔍 **Anyone can query** your published results
- 🌐 **IPFS storage is permanent** and globally accessible

### **Best Practices**
- ✅ Test with `--dry-run` before uploading
- ✅ Use testnet for development and testing
- ✅ Verify space ID and transaction hash
- ✅ Keep environment variables secure

## 📚 Next Steps

### **Planned Enhancements**
- **Real-time Updates**: Stream live backtest results during execution
- **Advanced Queries**: GraphQL query examples for data analysis
- **Performance Dashboard**: Visual analytics for uploaded results
- **Multi-chain Support**: Extend to other Graph Protocol networks

### **Integration Opportunities**
- **ROFL Oracle**: Direct integration with on-chain oracle publishing
- **DeFi Protocols**: Share verified performance with DeFi platforms
- **Community Verification**: Public leaderboards and performance comparisons
- **Automated Reporting**: Scheduled uploads of daily/weekly results

## 🎯 Hackathon Value

This Graph Protocol integration showcases:

1. **Verifiable AI Trading**: ML-optimized results stored immutably
2. **TEE + Blockchain**: Combining Intel TDX security with decentralized storage
3. **Professional Infrastructure**: Enterprise-grade Web3 fintech stack
4. **Community Transparency**: Public verification of trading algorithm performance

The integration transforms private ROFL backtests into publicly verifiable, queryable, and shareable trading performance data, demonstrating the power of combining confidential computing with decentralized storage protocols.