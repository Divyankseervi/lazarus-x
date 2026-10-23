# LAZARUS-X Developer Handoff

## Review pass — 2026-10-23 (Patent Readiness & Remote Repository Synchronization)

- Removed all personal identifiers, registration numbers, faculty details, and academic institutional references across all backend endpoints, frontend views, SQL seed scripts, and documentation files to ensure patent-ready technical presentation.
- Retitled and refactored the comprehensive architecture specification document into `docs/TECHNICAL_SPECIFICATION_REPORT.md`.
- Confirmed full integrity of the Administrator Audit Trail: verified SQLite table persistence, automatic transaction-level logging (`LOGIN`, `LOGOUT`, `CREATE_CASE`, `SEAL_CASE`, `BACKUP_DATABASE`), trigger-backed evidence tracking, and role-based cross-user visibility.
- Regenerated and verified `LAZARUS-X-GPT.zip` (150 files, 0.93 MB, 0 PII hits).
- Synchronized local repository with remote GitHub repository `https://github.com/Divyankseervi/lazarus-x`. All 11 backend test suites (100% pass rate) and frontend production builds re-verified.

- Re-read the assessment PDF and mapped its local requirements against `docs/REQUIREMENTS_TRACEABILITY.md`, the 11-model Prisma schema, ER diagram, data dictionary, API/UI, and existing automated checks.
- Preset default login credentials across both portals (`investigator@lazarus.local` / `Investigator2026!` and `admin@lazarus.local` / `Admin2026!Pass`), added quick preset selection chips to the UI, auto-synced default accounts on server bootstrap, and updated frontend unit/E2E test suites (25/25 vitest, 3/3 playwright E2E).
- Added GPT packaging utility (`scripts/package_for_gpt.py` and `npm run package:gpt`) generating a clean, dependency-free codebase archive (`LAZARUS-X-GPT.zip`, 150 files, 0.94 MB) excluding `node_modules`, virtualenvs, databases, and build artifacts for LLM upload.
- Full end-to-end audit completed: verified all 8 core live DBMS operations via automated script `scripts/verify_live_api.js` against the live running server (investigator & admin authentication, case creation, dual-layer SHA-256 + HMAC evidence ingestion, RFC 6962 binary Merkle inclusion proofs, offline audit bundle export, atomic case sealing, and fail-closed trigger immutability rejection).
- Verified visually in browser via headless subagent: dark-themed UI loaded with student/course banner, pre-filled portal login buttons, and live dashboard rendering with zero errors.
- Verified on this machine: `npm test` (all backend suites, frontend 25/25, artifact intake), `npm run typecheck:backend`, `npm run validate:db`, `npm run build:frontend`, `npm run test:e2e` (3/3), `npm run test:sqlite-analysis`, `scripts/backup_database.bat` (native PRAGMA integrity check OK), and `npm run dbms:demo` (11 tables, CRUD, joins/aggregates, views, triggers, transactional sealing, index plan, isolated copy/restore).
- Still must be supplied/verified by the student: private GitHub repository, collaborators, meaningful commit/branch history, remote CI status, Docker Hub publication if required, live deployment URL/custom domain, timestamped screenshots and the final PDF upload. Patentability remains unestablished; use no patent-pending claim.
- A pre-existing workspace edit to `start.bat` was present before this review and was preserved.

## Current state

LAZARUS-X is an academic forensic relational database reconstruction prototype. The active Prisma runtime targets SQLite. PostgreSQL-specific DDL under `backend/db/init/01_advanced_features.sql` is a reference script only and is not applied to the current Compose deployment.

The local app was started successfully on 2026-10-23 with Node.js 24.13.1. `npm start` built the frontend, synchronized the SQLite schema, and launched the API at `http://localhost:3000`; `/api/health` and `/` both returned HTTP 200. The frontend build required removing unused `Scale`/`Check` imports from `frontend/src/App.tsx` and the unused `useMemo` import from `frontend/src/SchemaGraph.tsx`.

The requirement recheck also passed `npm test`, `npm run test:sqlite-analysis`, `npm run test:e2e`, `npm run validate:db`, `npm run typecheck:backend`, `npm run build:frontend`, `npm run dbms:demo`, and the native Windows SQLite backup script. The latest browser run passed 3/3 tests: both distinct login portals, direct investigator URL persistence after reload, and the complete investigator workflow. The SQLite analyzer now avoids Windows `st_ctime` false positives and its Windows test skips symlink creation when the process lacks the required privilege. Frontend unit tests are 25/25.

The Investigator workspace was simplified for daily use on 2026-10-23. The primary view now emphasizes evidence intake, selected reconstruction, next-evidence guidance, and provenance status. The ambiguity-change metric, relationship graph, and recent-fragment timeline remain available through compact expandable controls and are collapsed by default. No reconstruction, provenance, export, or role-access capability was removed. The Administrator control center remains a separate dashboard.

## Start locally

1. Copy `backend/.env.example` to `backend/.env` and set a unique `PROVENANCE_ENCRYPTION_KEY` generated using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
2. Run `npm run install:all`.
3. Run `npm run validate:db`, `npm run typecheck:backend`, `npm test`, and `npm run build:frontend`.
4. Run `npm start` and verify `http://localhost:3000`, `/api/health`, and `/api/health/ready`.
5. Register an investigator. Provision the admin account with `LAZARUS_ADMIN_EMAIL` and `LAZARUS_ADMIN_PASSWORD` followed by `npm run admin:provision` from the backend directory.
6. Use `/investigator-login` for investigator registration/login and `/admin-login` for the separately labelled administrator login. After authentication, investigators receive the reconstruction workspace while administrators receive a separate control-center dashboard for metrics, cross-user audit visibility, and native backup. The UI blocks an account from entering the wrong portal, while backend role authorization remains authoritative.

## Evidence manifest CLI

- `scripts/ingest_artifact.js`: read-only SHA-256 manifest intake (not a record-recovery parser).
- `scripts/verify_artifact_manifest.js`: verifies byte length and SHA-256 against a manifest.
- `npm run test:intake`: tests immutability, digest correctness, idempotency, verification, tamper detection, extension rejection and symlink rejection.

## Key caveats

- SQLite is single-writer; process-local rate-limit/engine caches and case locks are not a multi-instance coordination solution.
- SQLite has no native stored-procedure language. Case sealing is implemented with application-level transaction logic; the PostgreSQL SQL file is not part of the active runtime.
- Keep the provenance encryption key securely backed up. Lost keys may prevent decryption of case salts.
- A hash is not proof of origin, authenticity, or legal admissibility. The artifact CLI does not inspect low-level SQLite content or recover deleted records.
- Never use shared default credentials. Admin provisioning rotates credentials and revokes that account's existing sessions.
- Deployment URLs, GitHub branches/commits, custom domains, Docker Hub images, and CI results must be configured and verified externally.

## Release validation

See `docs/FINAL_ENGINEERING_STATUS.md` and `docs/REQUIREMENTS_TRACEABILITY.md` for exact completed checks and unverified items. Keep all output claims consistent with the command output actually observed on the submission machine.
