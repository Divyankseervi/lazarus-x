# Multi-stage Dockerfile for LAZARUS-X
# Stage 1: Build Frontend Assets
FROM node:24-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend Application
FROM node:24-bookworm-slim AS backend-builder
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN DATABASE_URL=file:./data/dev.db npx prisma generate --schema prisma/schema.prisma \
    && npx tsc --project tsconfig.json

# Stage 3: Production Runtime with production-only dependencies
FROM node:24-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOME=/tmp/lazarus-home
ENV npm_config_cache=/tmp/npm-cache
ENV XDG_CACHE_HOME=/tmp/cache

# Install SQLite tools for native backup/restore
RUN apt-get update && apt-get install -y --no-install-recommends sqlite3 bash openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma
RUN mkdir -p ./prisma/data \
    && DATABASE_URL=file:./data/dev.db npm ci --omit=dev \
    && DATABASE_URL=file:./data/dev.db npx prisma generate --schema prisma/schema.prisma
COPY --from=backend-builder --chown=node:node /app/backend/dist ./dist
COPY --from=frontend-builder --chown=node:node /app/frontend/dist /app/frontend/dist

RUN mkdir -p /app/backups /app/backend/prisma/data && chown -R node:node /app/backend/prisma /app/backups
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/ready').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

EXPOSE 3000

WORKDIR /app/backend
# Initialize a fresh persistent SQLite volume from the committed Prisma schema.
CMD ["sh", "-c", "mkdir -p \"$HOME\" \"$npm_config_cache\" \"$XDG_CACHE_HOME\" && npx prisma db push --schema prisma/schema.prisma --skip-generate && node dist/index.js"]
