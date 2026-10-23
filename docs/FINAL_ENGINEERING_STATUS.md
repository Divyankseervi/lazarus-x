# LAZARUS-X Final Engineering Status

Review date: 2026-10-23

## What this release candidate contains

- Core concept reset and schema-first dashboard: each case defines/persists its own typed target schema, backed by a dedicated additive SQLite migration for existing databases. UI supports schema setup, manual and CSV evidence intake share one batch API, synthetic walkthrough submits marked sample evidence, candidate view language avoids false claims of consensus, recommendation labels are explicit about heuristic candidate weights, and reopened cases restore schema and recent observations. See `docs/CORE_IDEA_REALIGNMENT.md` for explicit scope and limitations.

- Corrected project identity and academic materials for LAZARUS-X system. The assessment document remains a draft: the student must capture real timestamped output screenshots and not submit invented results.
- SQLite-only Prisma/runtime configuration, consistent environment variable names, removal of the fixed example encryption key, and no default administrator credentials.
- Current frontend source is built during `npm start` and Docker build. Legacy generated assets are excluded from the release archive so an old bundle cannot override the source.
- Database readiness check (`/api/health/ready`) distinct from process liveness, plus production token-gated metrics.
- Read-only artifact intake and manifest verification CLI with SHA-256 hashing, regular-file/no-symlink checks, 2 GiB limit, metadata-change detection, repeat intake behavior and tamper-detection tests. Added a separate Python standard-library SQLite inspector that reports schema, columns, declared foreign keys, row counts, SHA-256 and optional integrity-check result without exporting record values; it explicitly does not recover deleted rows. The hash manifest records byte identity only; it does not prove evidence origin or sign the manifest. The SQLite analyzer inspects the currently visible schema/rows without returning record values; neither utility recovers deleted rows.
- SQLite-native online backup and guarded restore scripts; backup integrity check; a GitHub Actions drill that creates a disposable database, backs it up, restores it, verifies SQLite integrity and compares a known row.
- Node 24 Debian-slim container build and CI; container healthcheck; non-root runtime, read-only root filesystem, reduced capabilities, tmpfs for transient writes, persistent database and backup volumes, and container smoke test in CI. Debian-slim is selected for more predictable glibc/native-binary compatibility than Alpine for bcrypt/Prisma dependencies.
- Browser E2E test job, API readiness/metrics tests, read-only SQLite analyzer tests, and an actual native SQLite backup → restore → integrity/data verification drill added to the automated pipeline.
- Research specification and UI language relabeled as draft technical research material rather than a filed/granted patent or a claim of legal admissibility.
- ER diagram/data dictionary/assessment report qualified to say 3NF-oriented design; a formal proof requires an explicit functional dependency set. BCNF is not claimed.

## Verification performed and confirmed

- `npm run validate:db` — Prisma schema validates against active SQLite models.
- `npm run typecheck:backend` — `tsc --noEmit` completed with **0 errors**.
- `npm run lint:frontend` — `oxlint` completed with **0 warnings and 0 errors**.
- `npm run test:backend` — All 11 suites passed (100%):
  - `src/engine/test.ts` (3 checks)
  - `src/engine/audit_test.ts`
  - `src/engine/oracle_test.ts`
  - `src/engine/csp_fuzzy_provenance.test.ts` (20 checks)
  - `src/provenance_test.ts` (8 checks)
  - `src/engine/audit_bundle_test.ts` (1 test)
  - `src/engine/branching_test.ts` (6 tests)
  - `src/research_claim_consistency.test.ts` (7 concepts)
  - `src/engine/schema_definition.test.ts`
  - `src/database_url.test.ts` (3 tests)
  - `src/security.test.ts` (17 tests, SQLite DB-backed transactions, key rotation, immutability)
- `npm run test:frontend` — All 3 test files passed (**25/25 vitest tests**):
  - `src/schemaTypes.test.ts` (3 passed)
  - `src/evidenceCsv.test.ts` (7 passed)
  - `src/App.test.tsx` (15 passed)
- `npm run dbms:demo` — All 7 DBMS criteria verified successfully (11 models, CRUD, joins, aggregate queries, SQL views `vw_case_activity_summary` and `vw_candidate_ranking`, database triggers `trg_audit_evidence_insert` and `trg_seal_insert_guard`, transactions, query plan, and backup/restore).
- `node scripts/verify_live_api.js` — All 8 core operations passed against live server.
- `npm run test:e2e` — 3/3 Playwright browser tests passed.
- `python scripts/test_analyze_sqlite.py` — passed.
- `node scripts/test_ingest_artifact.js` — passed.

## External items requiring student setup

Deploying to custom domains, creating branches/commits/collaborators on GitHub, adding external CI secrets, and publishing to Docker Hub require external account credentials and cannot be automated from within the source code alone.

## Release checks

On a network-enabled machine with Node 24 and Docker/SQLite tools where relevant:

```bash
npm run install:all
npm run validate:db
npm run typecheck:backend
npm run lint:frontend
npm test
npm run test:e2e
python scripts/test_analyze_sqlite.py
npm run build:frontend
npm run dbms:demo
bash -n scripts/backup_database.sh scripts/restore_database.sh
```

Then run `docker compose config`, `docker compose build`, and `docker compose up`; verify the login, role restrictions, case ownership isolation, evidence/provenance paths and a restore from a real backup. Deploying, configuring DNS, pushing a GitHub repository, creating branches/commits/collaborators, adding external secrets, and publishing a container require account access and cannot be established by the source ZIP itself.

## Next feature with highest research value

Implement a separate, isolated SQLite forensic-parser adapter that can analyze database pages, freelists, WAL and rollback journals against a synthetic ground-truth corpus. Projects such as [xsqlite](https://github.com/NetherlandsForensicInstitute/xsqlite) and [sqlite-forensic / sqlite4n6](https://github.com/SecurityRonin/sqlite-forensic) are reference points. This feature is **not integrated** in this release. It needs a license review, read-only isolation, regression corpus, and a clear distinction between parsed facts and inferred recovery candidates. Current LAZARUS-X intake does not recover deleted rows.
