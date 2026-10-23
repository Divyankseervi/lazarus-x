#!/usr/bin/env bash
# Native SQLite online backup with integrity verification; PostgreSQL pg_dump optional.
set -euo pipefail
BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
mkdir -p "$BACKUP_DIR"
BACKUP_CREATED=0

if [[ -f "./backend/prisma/dev.db" ]]; then
  command -v sqlite3 >/dev/null 2>&1 || { echo "ERROR: sqlite3 is required for an online backup." >&2; exit 1; }
  SQLITE_TARGET="$BACKUP_DIR/lazarus_sqlite_$TIMESTAMP.db"
  echo "[SQLite] Creating online backup: $SQLITE_TARGET"
  sqlite3 "./backend/prisma/dev.db" ".backup '$SQLITE_TARGET'"
  [[ -s "$SQLITE_TARGET" ]] || { echo "ERROR: SQLite backup is empty." >&2; exit 1; }
  INTEGRITY="$(sqlite3 "$SQLITE_TARGET" 'PRAGMA integrity_check;')"
  [[ "$INTEGRITY" == "ok" ]] || { echo "ERROR: SQLite integrity check failed: $INTEGRITY" >&2; exit 1; }
  echo "[SQLite] Backup verified ($(wc -c < "$SQLITE_TARGET") bytes)."
  BACKUP_CREATED=1
fi

if [[ -n "${PGDATABASE:-}" ]]; then
  command -v pg_dump >/dev/null 2>&1 || { echo "ERROR: pg_dump is required for PostgreSQL backup." >&2; exit 1; }
  PG_TARGET="$BACKUP_DIR/lazarus_pg_$TIMESTAMP.sql"
  echo "[PostgreSQL] Creating backup: $PG_TARGET"
  pg_dump --clean --if-exists --format=plain -f "$PG_TARGET"
  [[ -s "$PG_TARGET" ]] || { echo "ERROR: PostgreSQL backup is empty." >&2; exit 1; }
  echo "[PostgreSQL] Backup file created. Test restoration in an isolated database."
  BACKUP_CREATED=1
fi

if [[ "$BACKUP_CREATED" -ne 1 ]]; then
  echo "ERROR: No supported database found to back up." >&2
  exit 1
fi
echo "Backup operation completed. A restore drill is still required to validate recoverability."
