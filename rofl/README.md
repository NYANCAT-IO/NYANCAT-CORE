# ROFL Deployment Configuration

This directory contains configuration files for deploying the delta-neutral funding arbitrage application on Oasis Protocol's ROFL (Runtime OFfchain Logic) platform.

## Files

### `manifest.yaml`
Primary ROFL deployment manifest defining:
- Resource requirements (512MB RAM, 1 CPU, 2GB storage)
- TEE configuration (Intel TDX)
- Persistent storage mounts
- Secrets management
- Network policies
- Oracle integration

### `config.json` 
Runtime configuration for the application:
- Application settings and strategy parameters
- Storage and monitoring configuration
- Security and optimization settings
- Simulation mode settings for local testing

## Deployment Modes

### Local Simulation (Current Phase)
```bash
# Test with docker-compose or podman-compose
cd docker/
./test-local.sh

# Or manually:
docker-compose up --build -d

# Test container health
docker-compose exec funding-arbitrage node dist/cli/index.js --health-check

# Test with JSON output
docker-compose exec funding-arbitrage node dist/cli/index.js --health-check --json
```

### ROFL Deployment (Future Phase)
```bash
# Deploy to Oasis ROFL
rofl deploy manifest.yaml

# Monitor deployment
rofl status funding-arbitrage

# View logs
rofl logs funding-arbitrage
```

## Cost Optimization

- **Memory**: 512MB (vs 4GB standard) = 87% savings
- **CPU**: 1 core (vs 2 cores standard) = 50% savings  
- **Storage**: 2GB (vs 32GB standard) = 94% savings
- **Total**: ~70% cost reduction

## Security Features

- Encrypted secrets management for API keys
- Persistent storage with disk encryption
- TEE attestation for code integrity
- Network isolation with egress filtering
- No external access to sensitive data

## Budget Management

- **Budget**: 150 TEST tokens
- **Escrow**: Automatic recovery on failure
- **Monitoring**: Real-time cost tracking
- **Alerts**: Budget threshold warnings

## Troubleshooting

### Known Issues
- **Container backtest functionality**: ES module import error (see troubleshooting guide)
- **Missing historical data**: Container lacks historical cache for backtests

### Working Functionality
- ✅ Container health checks with `--health-check` flag
- ✅ Infrastructure verification and testing
- ✅ Local development with all CLI commands

### Detailed Troubleshooting
See comprehensive troubleshooting guide: `docs/rofl-container-troubleshooting.md`

### Quick Health Check
```bash
# Verify container is working
docker-compose exec funding-arbitrage node dist/cli/index.js --health-check
# Expected: "✅ Container health check passed - infrastructure working!"
```