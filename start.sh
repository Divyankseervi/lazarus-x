#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

echo "LAZARUS-X setup"
if [ ! -f backend/.env ]; then
  echo "Missing backend/.env. Copy backend/.env.example to backend/.env and set PROVENANCE_ENCRYPTION_KEY."
  exit 1
fi

if [ ! -x backend/node_modules/.bin/ts-node ] || [ ! -x backend/node_modules/.bin/prisma ]; then
  (cd backend && npm ci)
fi
if [ ! -x frontend/node_modules/.bin/vite ] || [ ! -x frontend/node_modules/.bin/tsc ]; then
  (cd frontend && npm ci)
fi

echo "Building frontend..."
(cd frontend && npm run build)
echo "Applying Prisma schema to SQLite..."
(cd backend && npx prisma db push --schema prisma/schema.prisma)
echo "Starting LAZARUS-X at http://localhost:3000"
(cd backend && npx ts-node --files src/index.ts)
