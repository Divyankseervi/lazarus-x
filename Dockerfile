# Multi-stage Dockerfile for LAZARUS-X
# Stage 1: Build Frontend Assets
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend Application
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate --schema prisma/schema.prisma

# Stage 3: Production Runtime
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install SQLite tools for native backup/restore
RUN apk add --no-cache sqlite bash

COPY --from=backend-builder /app/backend/node_modules ./backend/node_modules
COPY --from=backend-builder /app/backend/prisma ./backend/prisma
COPY --from=backend-builder /app/backend/src ./backend/src
COPY --from=backend-builder /app/backend/package.json ./backend/package.json
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

EXPOSE 3000

WORKDIR /app/backend
CMD ["npx", "ts-node", "--transpile-only", "src/index.ts"]
