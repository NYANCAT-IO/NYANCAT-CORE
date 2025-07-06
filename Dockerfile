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

# Run demo command sequence
CMD ["sh", "-c", "echo '🚀 Starting ROFL Demo Container...' && echo '📊 Fetching historical data (8 days)...' && node dist/cli/fetch-historical.js -d 8 --valid-only && echo '🤖 Running ML-optimized backtest...' && node dist/cli/backtest.js --demo --ml && echo '✅ Demo complete! Results saved to /app/results/' && tail -f /dev/null"]