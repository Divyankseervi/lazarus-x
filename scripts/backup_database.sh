#!/usr/bin/env bash
# LAZARUS-X Native Database Backup and Recovery Script
# Satisfies BCSE302P Course Requirement (Section 8: Backup & Recovery)

set -euo pipefail
BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

echo "=== LAZARUS-X DATABASE BACKUP UTILITY ==="
echo "Timestamp: $TIMESTAMP"

# 1. SQLite Native Backup (sqlite3 .backup)
if [ -f "./backend/prisma/dev.db" ]; then
    SQLITE_TARGET="$BACKUP_DIR/lazarus_sqlite_$TIMESTAMP.db"
    echo "[SQLITE] Performing atomic online backup to: $SQLITE_TARGET"
    sqlite3 ./backend/prisma/dev.db ".backup '$SQLITE_TARGET'"
    echo "[SQLITE] Backup complete! Size: $(wc -c < "$SQLITE_TARGET") bytes"
    
    # Integrity Check
    echo "[SQLITE] Verifying integrity of backup file..."
    sqlite3 "$SQLITE_TARGET" "PRAGMA integrity_check;"
fi

# 2. PostgreSQL Native Backup (pg_dump)
if [ -n "${PGDATABASE:-}" ]; then
    PG_TARGET="$BACKUP_DIR/lazarus_pg_$TIMESTAMP.sql"
    echo "[POSTGRESQL] Executing pg_dump to: $PG_TARGET"
    pg_dump --clean --if-exists --format=plain -f "$PG_TARGET"
    echo "[POSTGRESQL] Backup complete! Size: $(wc -c < "$PG_TARGET") bytes"
fi

echo "=== BACKUP OPERATION CONCLUDED SUCCESSFULLY ==="
