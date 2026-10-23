#!/usr/bin/env python3
"""Read-only SQLite artifact structure report. No user row values are exported."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sqlite3
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

MAX_BYTES = 2 * 1024 * 1024 * 1024
ALLOWED = {".db", ".sqlite", ".sqlite3", ".db3"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def quote_identifier(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def stable_stat_tuple(st: os.stat_result) -> tuple[int, int, int, int]:
    # Windows updates st_ctime when a file is opened, so it cannot be used as
    # an immutable-content signal during a read-only analysis.
    return (st.st_dev, st.st_ino, st.st_size, st.st_mtime_ns)


def hash_descriptor(fd: int) -> str:
    digest = hashlib.sha256()
    os.lseek(fd, 0, os.SEEK_SET)
    while True:
        chunk = os.read(fd, 1024 * 1024)
        if not chunk:
            break
        digest.update(chunk)
    os.lseek(fd, 0, os.SEEK_SET)
    return digest.hexdigest()


def analyze(path: Path, integrity_check: bool) -> dict:
    source = path.expanduser().absolute()
    before_path = source.lstat()
    if stat.S_ISLNK(before_path.st_mode):
        raise ValueError("Symbolic links are rejected; supply a regular file path.")
    if not stat.S_ISREG(before_path.st_mode):
        raise ValueError("Input must be a regular file.")
    if source.suffix.lower() not in ALLOWED:
        raise ValueError(f"Unsupported extension. Accepted extensions: {', '.join(sorted(ALLOWED))}")
    if before_path.st_size > MAX_BYTES:
        raise ValueError("Database exceeds the 2 GiB analysis limit.")

    no_follow = getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(source, os.O_RDONLY | no_follow)
    connection = None
    try:
        before_fd = os.fstat(fd)
        if stable_stat_tuple(before_path) != stable_stat_tuple(before_fd):
            raise ValueError("Source changed during analysis initialization; retry with a stable file.")
        source_hash = hash_descriptor(fd)

        # Open via SQLite's read-only URI mode; `query_only` independently prevents writes.
        uri = f"file:{quote(source.as_posix(), safe='/:')}?mode=ro"
        connection = sqlite3.connect(uri, uri=True, timeout=5.0)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only = ON")
        connection.execute("BEGIN")  # maintain a consistent read snapshot for the report

        db_version = connection.execute("SELECT sqlite_version() AS version").fetchone()["version"]
        table_rows = connection.execute(
            "SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
        tables = []
        for table_row in table_rows:
            name = table_row["name"]
            quoted = quote_identifier(name)
            columns = [dict(row) for row in connection.execute(f"PRAGMA table_info({quoted})").fetchall()]
            foreign_keys = [dict(row) for row in connection.execute(f"PRAGMA foreign_key_list({quoted})").fetchall()]
            row_count = None
            row_count_status = "ok"
            try:
                row_count = int(connection.execute(f"SELECT COUNT(*) FROM {quoted}").fetchone()[0])
            except sqlite3.Error as error:
                # Virtual tables or damaged structures may not support a simple count.
                row_count_status = type(error).__name__
            tables.append({
                "name": name,
                "createSql": table_row["sql"],
                "columns": columns,
                "foreignKeys": foreign_keys,
                "rowCount": row_count,
                "rowCountStatus": row_count_status,
            })

        check_result = None
        if integrity_check:
            check_result = [row[0] for row in connection.execute("PRAGMA integrity_check").fetchall()]

        # File data must remain stable throughout this operation.
        after_fd = os.fstat(fd)
        after_path = source.lstat()
        if stable_stat_tuple(before_fd) != stable_stat_tuple(after_fd) or stable_stat_tuple(after_path) != stable_stat_tuple(after_fd):
            raise ValueError("Source file changed during analysis; discard this report and retry from a stable artifact.")
        if after_fd.st_size > MAX_BYTES:
            raise ValueError("Database grew beyond the 2 GiB analysis limit during processing.")

        return {
            "reportVersion": 1,
            "analyzedAt": utc_now(),
            "artifactName": source.name,
            "sizeBytes": after_fd.st_size,
            "sha256": source_hash,
            "sqliteVersion": db_version,
            "readOnly": True,
            "recordValuesExported": False,
            "tableCount": len(tables),
            "tables": tables,
            "integrityCheck": check_result,
            "integrityPassed": None if check_result is None else check_result == ["ok"],
            "limitations": [
                "This report inspects the currently visible SQLite schema and rows only; it does not recover deleted records from freelists, WAL files or rollback journals.",
                "A matching SHA-256 hash establishes byte identity with this report, not original provenance, authenticity or legal admissibility.",
                "The report is not digitally signed; preserve it in access-controlled storage if used as evidence metadata.",
                "Attached WAL/journal artifacts should be preserved and analyzed separately; this report does not package them into a forensic snapshot."
            ],
        }
    finally:
        if connection is not None:
            connection.rollback()
            connection.close()
        os.close(fd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("database", type=Path, help="SQLite .db/.sqlite/.sqlite3/.db3 file")
    parser.add_argument("--integrity-check", action="store_true", help="Run full PRAGMA integrity_check (may be slow for large databases)")
    parser.add_argument("--output", type=Path, help="Write JSON report to a new file (otherwise print to stdout)")
    args = parser.parse_args()
    try:
        report = analyze(args.database, args.integrity_check)
        rendered = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
        if args.output:
            target = args.output.expanduser().absolute()
            target.parent.mkdir(parents=True, exist_ok=True)
            flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL
            fd = os.open(target, flags, 0o600)
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                stream.write(rendered)
            print(str(target))
        else:
            sys.stdout.write(rendered)
        return 0
    except (OSError, sqlite3.Error, ValueError) as error:
        print(f"SQLite analysis error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
