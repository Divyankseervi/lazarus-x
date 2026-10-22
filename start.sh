#!/usr/bin/env bash
set -e

echo "========================================================"
echo "  LAZARUS-X: Forensic Database Reconstruction Platform"
echo "  Running Unified Engine on http://localhost:3000"
echo "========================================================"
echo ""

if [ ! -d "backend/node_modules" ]; then
    echo "[1/3] Installing backend dependencies..."
    (cd backend && npm install)
fi

if [ ! -d "frontend/dist" ]; then
    echo "[2/3] Building frontend assets..."
    (cd frontend && npm install && npm run build)
fi

echo "[3/3] Launching server on http://localhost:3000 ..."
echo "Open http://localhost:3000 in your browser."
echo "Press Ctrl+C to stop the server."
(cd backend && npx ts-node src/index.ts)
