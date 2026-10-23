#!/usr/bin/env bash
# Restore a verified SQLite backup. Usage: scripts/restore_database.sh BACKUP.db [TARGET.db] [--force]
set -euo pipefail
if [[ $# -lt 1 || $# -gt 3 ]]; then
  echo "Usage: $0 BACKUP.db [TARGET.db] [--force]" >&2; exit 2
fi
BACKUP_INPUT="$1"
[[ -f "$BACKUP_INPUT" && ! -L "$BACKUP_INPUT" ]] || { echo "Backup must be an existing regular file, not a symlink." >&2; exit 1; }
BACKUP_DIR="$(cd "$(dirname "$BACKUP_INPUT")" && pwd -P)"
BACKUP="$BACKUP_DIR/$(basename "$BACKUP_INPUT")"
TARGET_INPUT="${2:-./backend/prisma/dev.db}"
FORCE="${3:-}"
if [[ "$FORCE" != "" && "$FORCE" != "--force" ]]; then
  echo "Third argument must be --force." >&2; exit 2
fi
[[ -f "$BACKUP" && -s "$BACKUP" ]] || { echo "Backup is missing or empty." >&2; exit 1; }
command -v sqlite3 >/dev/null 2>&1 || { echo "sqlite3 is required." >&2; exit 1; }
[[ "$(sqlite3 "$BACKUP" 'PRAGMA integrity_check;')" == "ok" ]] || { echo "Backup failed integrity_check." >&2; exit 1; }
TARGET_DIR="$(dirname "$TARGET_INPUT")"
mkdir -p "$TARGET_DIR"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd -P)"
TARGET="$TARGET_DIR/$(basename "$TARGET_INPUT")"
[[ ! -L "$TARGET" ]] || { echo "Refusing to restore over a symbolic link." >&2; exit 1; }
if [[ -e "$TARGET" && "$FORCE" != "--force" ]]; then
  echo "Target already exists; choose another target or pass --force after backing it up." >&2; exit 1
fi
TMP="${TARGET}.restore.$$"
trap 'rm -f "$TMP"' EXIT
sqlite3 "$BACKUP" ".backup '$TMP'"
[[ "$(sqlite3 "$TMP" 'PRAGMA integrity_check;')" == "ok" ]] || { echo "Restored copy failed integrity_check." >&2; exit 1; }
mv -f "$TMP" "$TARGET"
trap - EXIT
echo "Restore verified: $TARGET"
