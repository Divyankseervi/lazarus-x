@echo off
title LAZARUS-X Forensic Platform
cd /d "%~dp0"

if not exist "backend\.env" (
  echo Missing backend\.env. Copy backend\.env.example to backend\.env and set PROVENANCE_ENCRYPTION_KEY.
  pause
  exit /b 1
)
if not exist "backend\node_modules\.bin\ts-node.cmd" (
  cd backend
  call npm ci
  if errorlevel 1 exit /b 1
  cd ..
)
if not exist "frontend\node_modules\.bin\vite.cmd" (
  cd frontend
  call npm ci
  if errorlevel 1 exit /b 1
  cd ..
)
cd frontend
call npm run build
if errorlevel 1 exit /b 1
cd ..
cd backend
call npx prisma db push --schema prisma\schema.prisma
if errorlevel 1 exit /b 1
start "" http://localhost:3000
call npx ts-node --files src/index.ts
