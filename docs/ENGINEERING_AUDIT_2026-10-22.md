# Engineering Audit and Finalization Notes

**Review date:** 2026-10-22  
**Scope:** Static review of the submitted ZIP, project configuration, and assessment requirements. This document distinguishes code changes from checks that still require execution.

## High-impact fixes applied

1. **Encryption key configuration:** Backend reads `PROVENANCE_ENCRYPTION_KEY`; the environment templates now use that exact variable and no longer ship a fixed default key. Generate a unique 32-byte key and keep it secret.
2. **Docker database mismatch:** The old Compose file started PostgreSQL while the app was configured for SQLite, and included a hard-coded password/key fallback. Compose now uses persistent SQLite and requires an explicit provenance key. PostgreSQL needs a real provider/schema migration before use.
3. **Fresh database initialization:** The repository has no initial migration containing the complete schema. The Docker startup command now applies the checked-in Prisma schema using `prisma db push` before starting the API.
4. **Frontend asset preference:** Backend now prefers `frontend/dist` when it exists, avoiding the legacy `backend/public` bundle overriding the current Vite build.
5. **Assessment identity:** Project source/docs labels were updated to LAZARUS-X platform standards. Check the final submission PDF name and screenshots manually.
6. **Readiness claims:** Removed unsupported guaranteed-score / court-admissibility claims and documented that passing tests and deployment are still required.
7. **Developer commands:** Added root commands for backend type-check, Prisma validation, frontend tests, and combined tests.

## Important caveat about database initialization

`prisma db push` is used in the Docker startup flow because the project does not contain a complete initial migration. This is suitable for a fresh academic/demo database but is not a substitute for a controlled production migration strategy. Back up any existing data before schema changes. For a future production release, create and review a baseline migration and use `prisma migrate deploy`.

## Commands to run from a clean checkout

Copy `backend/.env.example` to `backend/.env`, set `DATABASE_URL=file:./dev.db`, and generate a unique `PROVENANCE_ENCRYPTION_KEY` with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Then run:

```bash
npm run install:all
npm run validate:db
npm run typecheck:backend
npm run build:frontend
npm test
docker compose config
docker compose build
docker compose up
```

Verify all of the following manually or with integration tests:
- Register, login, logout, and authenticated-user retrieval.
- Admin-only routes and investigator denial.
- Cross-user case isolation.
- Case creation, evidence submission, candidate comparison, and sealing.
- Provenance verification, inclusion proofs, and audit bundle export.
- Backup and restore on a disposable database.
- Browser refresh, deep links, empty states, validation errors, and API failures.
- Health/readiness behavior and a clean shutdown.

## Remaining high-value work

- Add end-to-end API tests using a disposable SQLite database and real Prisma client.
- Add a safe read-only artifact ingestion pipeline: upload size/type limits, SHA-256 source hash, metadata manifest, quarantine, and parsing outside the request process.
- Add backup/restore integration tests and documented retention.
- Add request IDs, rate-limit metrics, dependency auditing, and operational alerting.
- Benchmark realistic datasets with reproducible seeds and report P50/P95/P99, memory, candidate count, and correctness.
- Add a reviewed baseline Prisma migration before any production migration workflow.

## External references reviewed

- xsqlite, Netherlands Forensic Institute: https://github.com/NetherlandsForensicInstitute/xsqlite
- FQLite: https://github.com/pawlaszczyk/fqlite
- OWASP Node.js Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html
- Express production security guidance: https://expressjs.com/advanced/best-practice-security/

These are design references, not claims that their code is integrated into this project.


## Additional finalization pass

- Added `scripts/ingest_artifact.js`: dependency-free, read-only SHA-256 manifest generation for selected SQLite artifact extensions, with a 2 GiB size limit.
- Added `scripts/test_ingest_artifact.js`: smoke tests verify manifest hash and size, ensure source bytes remain unchanged, and reject unsupported extensions.
- Added `scripts/restore_database.sh`: validates backup integrity before restoring to a target, refuses overwrite unless explicitly forced, and validates the restored copy.
- Added root package scripts for artifact intake and smoke tests; `npm test` now includes the intake smoke test after the existing backend and frontend suites.
- Added README instructions for intake, backup/restore, and fresh setup.
- Local verification performed in this finalization pass: `node scripts/test_ingest_artifact.js` passed; `node --check` passed for both new JavaScript files; all three package JSON files parsed successfully; final ZIP integrity passed.
- Not run / not verified here: backend TypeScript test suites, Prisma validation, frontend build/tests, SQLite restore drill (sqlite3 CLI not present), Docker build/start (Docker CLI not present), live deployment, and external GitHub CI.


## Addendum: source review of final-release candidate

The release candidate required additional corrections after reviewing the exact archive: the compiled frontend contained stale evaluator credential autofill, the source UI asserted a patent-pending status without filing evidence, app identity labels were inconsistent, the CI image tag referenced another hard-coded registry account, and documentation described PostgreSQL production support although the checked-in runtime was SQLite. These were removed/corrected in the final source candidate. The compiled `frontend/dist` and legacy `backend/public` assets are excluded from the final source archive to prevent an obsolete bundle from overriding the current source. Rebuild assets during startup/Docker build.
