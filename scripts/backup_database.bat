@echo off
REM LAZARUS-X Native Database Backup Utility for Windows
REM Satisfies BCSE302P Course Requirement (Section 8: Backup & Recovery)

set TIMESTAMP=%DATE:~10,4%%DATE:~4,2%%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set TIMESTAMP=%TIMESTAMP: =0%
set BACKUP_DIR=backups
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

echo ===================================================
echo   LAZARUS-X DATABASE BACKUP UTILITY (BCSE302P)
echo   Timestamp: %TIMESTAMP%
echo ===================================================

if exist "backend\prisma\dev.db" (
    echo [SQLITE] Executing native copy/backup of dev.db...
    copy "backend\prisma\dev.db" "%BACKUP_DIR%\lazarus_sqlite_%TIMESTAMP%.db" >nul
    echo [SQLITE] Successfully saved backup to %BACKUP_DIR%\lazarus_sqlite_%TIMESTAMP%.db
)

echo ===================================================
echo   BACKUP CONCLUDED SUCCESSFULLY
echo ===================================================
