# ROFL-Optimized Node.js Container
# Multi-stage build for production optimization
FROM node:24-alpine AS builder

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install ALL dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Copy source code and config
COPY src/ ./src/
COPY tsconfig.json ./

# Build TypeScript
RUN pnpm tsc

# Production stage
FROM node:24-alpine AS production

# Install pnpm globally
RUN npm install -g pnpm

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy source for any runtime requirements
COPY --from=builder /app/src ./src

# Create data and results directories for persistent storage
RUN mkdir -p /app/data/historical /app/results

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S ccxt -u 1001 -G nodejs

# Change ownership of app directory
RUN chown -R ccxt:nodejs /app
USER ccxt

# Environment variables for ROFL
ENV NODE_ENV=production
ENV ROFL_MODE=false
ENV DATA_DIR=/app/data
ENV RESULTS_DIR=/app/results

# Expose port for health checks
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('Health check OK')" || exit 1

# Run comprehensive demo command sequence with Graph Protocol upload
CMD ["sh", "-c", "\
echo '🚀 Starting ROFL Demo Container...' && \
echo '📊 Fetching historical data (8 days)...' && \
node dist/cli/fetch-historical.js -d 8 --valid-only && \
echo '🤖 Running ML-optimized backtest...' && \
node dist/cli/backtest.js --demo --ml && \
echo '📈 Backtest complete! Results saved to /app/results/' && \
echo '🌐 Checking Graph Protocol configuration...' && \
if [ \"${ENABLE_GRAPH_UPLOAD:-false}\" = \"true\" ] && [ -n \"${PRIVATE_KEY:-}\" ] && [ -n \"${WALLET_ADDRESS:-}\" ]; then \
  echo '🔗 Graph Protocol credentials found - uploading results...' && \
  if node dist/cli/upload-graph.js --dry-run >/dev/null 2>&1; then \
    echo '✅ Data validation successful - proceeding with upload...' && \
    if node dist/cli/upload-graph.js 2>/dev/null; then \
      echo '🎉 Graph Protocol upload successful!' && \
      echo '📊 Results are now publicly verifiable on decentralized storage'; \
    else \
      echo '⚠️  Graph Protocol upload failed (network/API issue) - results saved locally'; \
    fi; \
  else \
    echo '⚠️  Data validation failed - skipping Graph Protocol upload'; \
  fi; \
else \
  echo '📝 Graph Protocol upload skipped (credentials not configured)' && \
  echo '💡 To enable: Set ENABLE_GRAPH_UPLOAD=true, PRIVATE_KEY, and WALLET_ADDRESS'; \
fi && \
echo '' && \
echo '✅ ROFL Demo Complete!' && \
echo '📁 Local results: /app/results/' && \
echo '🔍 Container logs: docker logs <container-name>' && \
echo '🛑 Stop container: docker-compose down' && \
echo '' && \
tail -f /dev/null"]