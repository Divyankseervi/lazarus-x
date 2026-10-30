@echo off
setlocal EnableExtensions
title LAZARUS-X One-Click Launcher
cd /d "%~dp0"

echo.
echo  LAZARUS-X ^| One-Click Local Setup
echo  ----------------------------------

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed. Install Node.js 22.12 or newer, then run this file again.
  pause
  exit /b 1
)
for /f "tokens=1,2 delims=." %%A in ('node -p "process.versions.node"') do (set "NODE_MAJOR=%%A" & set "NODE_MINOR=%%B")
if %NODE_MAJOR% LSS 22 (
  echo [ERROR] Node.js 22.12 or newer is required. Detected %NODE_MAJOR%.%NODE_MINOR%.
  pause
  exit /b 1
)
if %NODE_MAJOR% EQU 22 if %NODE_MINOR% LSS 12 (
  echo [ERROR] Node.js 22.12 or newer is required. Detected %NODE_MAJOR%.%NODE_MINOR%.
  pause
  exit /b 1
)
if %NODE_MAJOR% EQU 23 (
  echo [ERROR] Use Node.js 22.12+ or 24+. Node.js 23 is outside the supported project range.
  pause
  exit /b 1
)
echo [OK] Node.js %NODE_MAJOR%.%NODE_MINOR% detected.

if not exist "backend\.env" (
  if not exist "backend\.env.example" (
    echo [ERROR] backend\.env.example is missing.
    pause
    exit /b 1
  )
  copy "backend\.env.example" "backend\.env" >nul
  if errorlevel 1 (
    echo [ERROR] Could not create backend\.env.
    pause
    exit /b 1
  )
  echo [SETUP] Created backend\.env from the safe project template.
)

node -e "const fs=require('node:fs');const c=require('node:crypto');const p='backend/.env';let s=fs.readFileSync(p,'utf8');const marker='REPLACE_WITH_64_HEX_CHAR_RANDOM_KEY';if(s.includes(marker)){s=s.replace(marker,c.randomBytes(32).toString('hex'));fs.writeFileSync(p,s);console.log('[SETUP] Generated a private local provenance key in backend/.env.');}const m=s.match(/^PROVENANCE_ENCRYPTION_KEY=(.*)$/m);const q=String.fromCharCode(34,39);const k=m&&m[1].trim().replace(new RegExp('^['+q+']|['+q+']$','g'),'');if(!k||!/^[a-f0-9]{64}$/i.test(k)){console.error('[ERROR] PROVENANCE_ENCRYPTION_KEY must be 64 hexadecimal characters in backend/.env.');process.exit(1);}"
if errorlevel 1 (
  pause
  exit /b 1
)

if not exist "backend\node_modules\.bin\ts-node.cmd" (
  echo [SETUP] Installing backend dependencies...
  pushd backend
  call npm ci
  if errorlevel 1 (popd & echo [ERROR] Backend dependency installation failed. & pause & exit /b 1)
  popd
)
if not exist "frontend\node_modules\.bin\vite.cmd" (
  echo [SETUP] Installing frontend dependencies...
  pushd frontend
  call npm ci
  if errorlevel 1 (popd & echo [ERROR] Frontend dependency installation failed. & pause & exit /b 1)
  popd
)

echo [BUILD] Building the web app...
pushd frontend
call npm run build
if errorlevel 1 (popd & echo [ERROR] Frontend build failed. & pause & exit /b 1)
popd

set "API_ALREADY_READY=0"
powershell -NoProfile -Command "try { $r=Invoke-RestMethod -TimeoutSec 2 'http://localhost:3000/api/health/ready'; if ($r.status -eq 'READY') { exit 0 } } catch {}; exit 1" >nul 2>nul
if not errorlevel 1 (
  set "API_ALREADY_READY=1"
  echo [OK] A ready LAZARUS-X API is already using the configured database; skipping Prisma client regeneration.
  goto :database_ready
)

:initialize_database
echo [DATABASE] Setting up the configured Prisma database...
pushd backend
call npm run db:setup
if errorlevel 1 (popd & echo [ERROR] Database setup failed. Check the provider and connection settings in backend\.env. & pause & exit /b 1)
popd

:database_ready
if "%API_ALREADY_READY%"=="0" (
  echo [START] Launching the LAZARUS-X API...
  start "LAZARUS-X API" /min "%ComSpec%" /k "cd /d ""%~dp0backend"" && npx ts-node --files src/index.ts"
)

echo [WAIT] Waiting for the API and configured database...
powershell -NoProfile -Command "$ready=$false; for($i=0;$i -lt 45 -and -not $ready;$i++){try{$r=Invoke-RestMethod -TimeoutSec 2 'http://localhost:3000/api/health/ready';$ready=($r.status -eq 'READY')}catch{};if(-not $ready){Start-Sleep -Seconds 1}};if(-not $ready){exit 1}"
if errorlevel 1 (
  echo [ERROR] LAZARUS-X did not become ready. Check the minimized LAZARUS-X API window for details.
  pause
  exit /b 1
)

echo [READY] LAZARUS-X is running at http://localhost:3000
if "%LAZARUS_NO_BROWSER%"=="1" goto :browser_skipped
start "" "http://localhost:3000"
echo Keep the minimized LAZARUS-X API window open while using the app.
echo Close that API window to stop the local server.
goto :finish
:browser_skipped
echo Browser opening skipped by LAZARUS_NO_BROWSER=1.
:finish
pause
endlocal
