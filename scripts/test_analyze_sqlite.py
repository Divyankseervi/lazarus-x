#!/usr/bin/env python3
"""Self-contained tests for the read-only SQLite analyzer; uses only Python stdlib."""
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "analyze_sqlite.py"


def run(*args):
    return subprocess.run([sys.executable, str(SCRIPT), *map(str, args)], text=True, capture_output=True, check=False)


def main():
    with tempfile.TemporaryDirectory(prefix="lazarus-sqlite-analysis-", ignore_cleanup_errors=True) as tmp:
        root = Path(tmp)
        db = root / "case.db"
        with sqlite3.connect(db) as conn:
            conn.execute("PRAGMA foreign_keys=ON")
            conn.execute("CREATE TABLE cases(id INTEGER PRIMARY KEY, title TEXT NOT NULL UNIQUE)")
            conn.execute("CREATE TABLE evidence(id INTEGER PRIMARY KEY, case_id INTEGER NOT NULL REFERENCES cases(id), sha256 TEXT NOT NULL)")
            conn.execute("INSERT INTO cases(title) VALUES ('synthetic-case')")
            conn.execute("INSERT INTO evidence(case_id, sha256) VALUES (1, 'abc123')")
        original = db.read_bytes()
        original_stat = db.stat()

        result = run(db, "--integrity-check")
        assert result.returncode == 0, result.stderr
        report = json.loads(result.stdout)
        assert report["readOnly"] is True
        assert report["recordValuesExported"] is False
        assert report["tableCount"] == 2
        assert report["integrityPassed"] is True
        cases = next(table for table in report["tables"] if table["name"] == "cases")
        evidence = next(table for table in report["tables"] if table["name"] == "evidence")
        assert cases["rowCount"] == 1
        assert any(fk["table"] == "cases" for fk in evidence["foreignKeys"])
        assert "synthetic-case" not in result.stdout, "report must not disclose record contents"
        assert db.read_bytes() == original, "analysis must not modify the source database"
        after_stat = db.stat()
        assert original_stat.st_mtime_ns == after_stat.st_mtime_ns

        out = root / "report.json"
        output_result = run(db, "--output", out)
        assert output_result.returncode == 0, output_result.stderr
        assert json.loads(out.read_text())["sha256"] == report["sha256"]
        duplicate_output = run(db, "--output", out)
        assert duplicate_output.returncode != 0, "output should not overwrite an existing file"

        if os.name != "nt":
            link = root / "linked.db"
            link.symlink_to(db)
            symlink_result = run(link)
            assert symlink_result.returncode != 0, "symlink must be rejected"

        invalid = root / "payload.exe"
        invalid.write_text("not a database")
        assert run(invalid).returncode != 0, "unsupported extension must be rejected"

        corrupt = root / "corrupt.db"
        corrupt.write_bytes(b"not-sqlite")
        assert run(corrupt).returncode != 0, "invalid database must fail analysis"

    print("SQLite analyzer tests passed (read-only schema inspection, FKs, row counts, optional integrity check, no record-value disclosure, no-overwrite output, symlink/extension/corrupt-file rejection).")


if __name__ == "__main__":
    main()
