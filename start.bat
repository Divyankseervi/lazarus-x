@echo off
title LAZARUS-X Forensic Platform
echo ========================================================
echo   LAZARUS-X: Forensic Database Reconstruction Platform
echo   Running Unified Engine on http://localhost:3000
echo ========================================================
echo.

if not exist "backend\node_modules\" (
    echo [1/3] Installing backend dependencies...
    cd backend && call npm install && cd ..
)

if not exist "frontend\dist\" (
    echo [2/3] Building frontend assets...
    cd frontend && call npm install && call npm run build && cd ..
)

echo [3/3] Opening browser at http://localhost:3000 ...
timeout /t 2 /nobreak >nul
start http://localhost:3000

echo.
echo ========================================================
echo   Server is running! Press Ctrl+C in this terminal to stop.
echo ========================================================
cd backend
call npx ts-node src/index.ts
