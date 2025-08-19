# Use Node.js 20 slim variant for broader compatibility during builds
FROM node:20-bookworm-slim AS base

# Install dependencies only when needed
FROM base AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Copy package files
COPY package*.json ./
# Install production deps only and skip lifecycle scripts (husky)
ENV HUSKY=0
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application (if needed)
RUN npm run build || echo "No build step required"

# Production image, copy all the files and run node
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application
COPY --from=builder --chown=nodejs:nodejs /app ./
COPY --from=deps --chown=nodejs:nodejs /app/node_modules ./node_modules

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && chown -R nodejs:nodejs /app/logs
RUN mkdir -p /app/uploads && chown -R nodejs:nodejs /app/uploads

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "src/app.js"]
