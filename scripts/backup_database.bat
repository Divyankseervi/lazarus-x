@echo off
setlocal EnableExtensions
REM LAZARUS-X native SQLite backup utility. Requires sqlite3.exe on PATH.
set "BACKUP_DIR=backups"
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
for /f %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TIMESTAMP=%%i"
set "SOURCE_DB=backend\prisma\dev.db"
set "TARGET_DB=%BACKUP_DIR%\lazarus_sqlite_%TIMESTAMP%.db"

echo === LAZARUS-X DATABASE BACKUP ===
if not exist "%SOURCE_DB%" (
  echo ERROR: Database not found at %SOURCE_DB%.
  echo Set up the application and create the database before backing up.
  exit /b 1
)
where sqlite3 >nul 2>nul
if errorlevel 1 (
  echo ERROR: sqlite3.exe is required for a consistent online backup.
  exit /b 1
)
sqlite3 "%SOURCE_DB%" ".backup '%TARGET_DB%'"
if errorlevel 1 exit /b 1
if not exist "%TARGET_DB%" exit /b 1
for /f "delims=" %%i in ('sqlite3 "%TARGET_DB%" "PRAGMA integrity_check;"') do set "INTEGRITY=%%i"
if not "%INTEGRITY%"=="ok" (
  echo ERROR: Backup integrity check failed: %INTEGRITY%
  exit /b 1
)
echo Backup created and integrity check passed: %TARGET_DB%
endlocal
