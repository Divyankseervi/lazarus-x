#!/usr/bin/env python3
"""
LAZARUS-X GPT Codebase Packaging Utility
Creates a clean, token-efficient, and dependency-free ZIP archive of the
LAZARUS-X codebase specifically tailored for upload to GPT / LLM environments.
"""

import os
import sys
import fnmatch
import zipfile
from pathlib import Path

# Directories to exclude from the GPT archive
EXCLUDE_DIRS = {
    'node_modules',
    '.venv',
    '.venv-1',
    'venv',
    '.git',
    '.agents',
    '.claude',
    '.cursor',
    '.devin',
    'dist',
    'build',
    'coverage',
    'test-results',
    'playwright-report',
    'backups',
    '__pycache__',
    '.pytest_cache',
    'evidence-manifests',
    'supervisor'
}

# Individual files and glob patterns to exclude
EXCLUDE_EXACT_FILES = {
    '.env',
    'dev.db',
    '.DS_Store',
    'Thumbs.db',
    'AUTONOMOUS_EXECUTION_LOG.md',
    '09_repository_audit.md',
    'AGENTS.md'
}

EXCLUDE_PATTERNS = [
    '*.zip',
    '*.tar.gz',
    '*.db',
    '*.db-wal',
    '*.db-shm',
    '*.db-journal',
    '*.log',
    '*.docx',
    '*.pptx',
    '*.pdf'
]

def create_gpt_archive(root_dir: str = '.', output_filename: str = 'LAZARUS-X-GPT.zip') -> str:
    root_path = Path(root_dir).resolve()
    output_path = root_path / output_filename

    matched_files = []
    for current_root, dirs, files in os.walk(root_path):
        # Filter directories in-place
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]

        for file_name in files:
            # Check exact exclusions
            if file_name in EXCLUDE_EXACT_FILES:
                continue
            # Check pattern exclusions
            if any(fnmatch.fnmatch(file_name, pattern) for pattern in EXCLUDE_PATTERNS):
                continue

            full_file_path = Path(current_root) / file_name
            rel_file_path = full_file_path.relative_to(root_path).as_posix()
            matched_files.append((full_file_path, rel_file_path))

    matched_files.sort(key=lambda item: item[1])

    # Build the ZIP archive
    print(f"Creating GPT archive: {output_path.name}...")
    with zipfile.ZipFile(output_path, mode='w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zipf:
        for full_path, rel_path in matched_files:
            zipf.write(full_path, arcname=rel_path)

    uncompressed_bytes = sum(p.stat().st_size for p, _ in matched_files)
    compressed_bytes = output_path.stat().st_size

    print("\n" + "=" * 60)
    print("   LAZARUS-X ARCHIVE CREATED SUCCESSFULLY FOR GPT")
    print("=" * 60)
    print(f"  Archive Path       : {output_path}")
    print(f"  Total Files        : {len(matched_files)}")
    print(f"  Uncompressed Size  : {uncompressed_bytes / (1024 * 1024):.2f} MB ({uncompressed_bytes:,} bytes)")
    print(f"  Compressed Size    : {compressed_bytes / (1024 * 1024):.2f} MB ({compressed_bytes:,} bytes)")
    print(f"  Compression Ratio  : {((1.0 - compressed_bytes / uncompressed_bytes) * 100):.1f}% reduction")
    print("=" * 60 + "\n")

    return str(output_path)

if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'LAZARUS-X-GPT.zip'
    create_gpt_archive('.', target)
