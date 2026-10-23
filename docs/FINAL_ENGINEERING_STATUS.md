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

## Verification actually performed in this packaging environment

- Engine test files run with globally available `ts-node` (transpile-only): `src/engine/test.ts` (3 checks), `audit_test.ts`, `oracle_test.ts`, `csp_fuzzy_provenance.test.ts` (20 checks), `provenance_test.ts` (8 tests), `audit_bundle_test.ts` (1 test), `branching_test.ts`, `research_claim_consistency.test.ts`, `schema_definition.test.ts`, and `database_url.test.ts` (3 tests) — passed on 2026-10-23. These targeted tests do not replace the full dependency-managed backend test suite or integration tests.

- `node --check scripts/ingest_artifact.js`, `scripts/verify_artifact_manifest.js`, and `scripts/test_ingest_artifact.js` — passed.
- TypeScript strict-check for isolated schema/CSV utility modules — passed. TypeScript/TSX syntax transpilation for 49 application source files — 0 syntax diagnostics (not a full dependency-aware typecheck).
- Additive target-schema migration smoke test using Python SQLite — passed; a pre-existing case receives the `{}` compatibility default and database integrity remains `ok`. The Prisma-backed migration integration test is included but could not be executed here without the generated Prisma client.
- Frontend utility smoke tests for schema presets, typed conflict walkthrough, refusing a false conflict when no non-unique field exists, BOM/quoted CSV parsing, invalid CSV syntax, negative locators, undeclared fields, and type validation — passed.
- `python scripts/test_analyze_sqlite.py` — passed.
- `python -m py_compile scripts/analyze_sqlite.py scripts/test_analyze_sqlite.py` — passed.
- `node scripts/test_ingest_artifact.js` — passed, covering hash correctness, source remains unchanged, idempotent intake, manifest verification, content tampering, unsupported extension, and symbolic link rejection.
- `bash -n scripts/backup_database.sh scripts/restore_database.sh start.sh` — passed.
- Parsed root/backend/frontend package manifests and backend/frontend lockfiles as JSON — passed.
- Parsed `docker-compose.yml` and `.github/workflows/ci.yml` with YAML parser — passed. GitHub expressions and actual runner behavior still require CI execution.
- Parsed Dockerfile exec-form `CMD` as JSON — passed.
- Confirmed package.json direct dependencies/devDependencies/engines match each checked-in npm lockfile — passed.
- Corrected optional Docker Hub publishing conditions to use job environment values, not secrets directly in `if` expressions.
- Confirmed the active Prisma schema defines 11 models and CI references the renamed research-disclosure consistency test — passed.
- Confirmed no legacy compiled frontend bundles or fixed fallback encryption key are included in the source candidate.

## Checks that are not yet run successfully here

The environment cannot resolve `registry.npmjs.org` (`npm ping` failed with `EAI_AGAIN`). Therefore the dependency installation did not complete, and this environment could not run the full backend test/typecheck, Prisma validation/generation, frontend Vitest/lint/production build, Playwright browser run, SQLite CLI restore drill, or Docker build/start. A standalone global TypeScript invocation also stopped because the project type definitions (`@testing-library/jest-dom`, `node`, and `vite/client`) were unavailable; it is not treated as a project type-check result. These are **unverified**, not claimed to pass. The new CI workflow is configured to run those checks on GitHub, but no remote CI run or deployment was performed from this ZIP session.

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
