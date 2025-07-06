#!/bin/bash

# Docker Testing Script for ROFL Integration  
# Test containerization with standard Docker workflow before ROFL deployment
# Run from project root: ./scripts/test-docker.sh

set -e

echo "🚀 ROFL Local Testing - Delta-Neutral Funding Arbitrage"
echo "======================================================="

# Detect available container tool
COMPOSE_CMD=""
if command -v docker-compose &> /dev/null; then
    COMPOSE_CMD="docker-compose"
    echo "✅ Using docker-compose"
elif command -v podman-compose &> /dev/null; then
    COMPOSE_CMD="podman-compose"
    echo "✅ Using podman-compose"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
    echo "✅ Using docker compose"
else
    echo "❌ No container compose tool found!"
    echo "Please install one of: docker-compose, podman-compose, or docker with compose plugin"
    exit 1
fi

# Create necessary directories
echo "📁 Creating data directories..."
mkdir -p data/rofl
mkdir -p data/historical

# Copy configuration
echo "⚙️  Setting up configuration..."
cp rofl/config.json data/rofl/ || echo "⚠️  Config copy failed (non-critical)"

# Build and start containers
echo "🔨 Building container..."
$COMPOSE_CMD build

echo "🚀 Starting container..."
$COMPOSE_CMD up -d

# Wait for container to be ready
echo "⏳ Waiting for container to be ready..."
sleep 10

# Check container status
echo "📊 Container status:"
$COMPOSE_CMD ps

# Check health
echo "🏥 Health check:"
if $COMPOSE_CMD exec funding-arbitrage node -e "console.log('✅ Container healthy')" 2>/dev/null; then
    echo "✅ Container is healthy"
else
    echo "❌ Container health check failed"
fi

# Show logs
echo "📄 Recent logs:"
$COMPOSE_CMD logs --tail=20 funding-arbitrage

# Test the application
echo "🧪 Testing application..."
if $COMPOSE_CMD exec funding-arbitrage node dist/cli/index.js --help 2>/dev/null; then
    echo "✅ Application is working"
else
    echo "❌ Application test failed"
fi

echo ""
echo "🎯 Testing complete!"
echo ""
echo "Next steps:"
echo "  • View logs: $COMPOSE_CMD logs -f funding-arbitrage"
echo "  • Stop container: $COMPOSE_CMD down"
echo "  • Test health: $COMPOSE_CMD exec funding-arbitrage node dist/cli/index.js --health-check"
echo "  • Check volumes: docker volume ls (or podman volume ls)"
echo ""
echo "Ready for ROFL deployment when tests pass! 🚀"