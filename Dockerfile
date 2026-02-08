# Build stage
FROM node:22.20-alpine AS builder

WORKDIR /app

# Install dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files and prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source files first (needed for prisma output path)
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma client (for Linux)
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Copy generated prisma to dist
RUN cp -r src/generated dist/

# Production stage
FROM node:22.20-alpine AS production

WORKDIR /app

# Install dependencies for native modules (bcrypt)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install production dependencies + tsx for ESM support
RUN npm ci --omit=dev && npm install tsx

# Copy built files from builder (includes generated prisma)
COPY --from=builder /app/dist ./dist/

# Copy prisma schema (needed for migrations if any)
COPY prisma ./prisma/

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Set ownership
RUN chown -R nodejs:nodejs /app

USER nodejs

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1

# Start the application
CMD ["npx", "tsx", "dist/index.js"]
