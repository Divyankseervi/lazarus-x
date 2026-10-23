# LAZARUS-X Developer Handoff

## Review pass — 2026-10-23 (Fault Report Resolution & Complete Verification)

- **F1 (Shared Default Credentials)**: Seeding is strictly gated behind `SEED_DEFAULT_USERS=true` or non-production environment; duplicate accounts removed; clear security warnings emitted when run under `NODE_ENV=production`; seeding errors are explicitly logged.
- **F2 (TypeScript 6 Provenance Head Narrowing)**: Fixed `TS18048` optional chaining in `backend/src/index.ts` across lines 1003, 1067, 1111 (`cachedHead?.hash`, `inMemoryHead?.hash`). `npm run typecheck:backend` now passes with 0 errors.
- **F3 (Frontend Test Multiple Matching Elements)**: Fixed `screen.getByText(/LAZARUS/)` ambiguous match in `frontend/src/App.test.tsx` using `screen.getAllByText(/LAZARUS/)[0]`. Frontend unit tests now pass **25/25** without failures.
- **F4 (Provenance Ledger Sequence in Stored Procedure)**: Corrected `sp_seal_forensic_case` in `backend/db/init/01_advanced_features.sql` and the demo script to never overwrite `provenanceSequence` with evidence counts (preserving event-sequence integrity), and added admin role validation (`role = 'ADMIN'`).
- **F5 (Assessment Instruction 7 Student Identity)**: Bound student identity (`Divyank Seervi`, `24BCE0793`, `BCSE302P L25+L26`) into variables/methods in `dbms_features_demonstration.ts`, server startup banner in `backend/src/index.ts`, login hero banner, and topbar badges in `frontend/src/App.tsx`.
- **F6 & F7 (Prior-Art Matrix & Patentability Disclaimers)**: Added *Guided Data Repair* (Yakout et al., SIGMOD 2011) and *Probabilistic Unclean Databases* (ICDT 2019 / HoloClean) to `research/05_prior_art_claim_matrix.md`; reinforced non-patentability disclaimers under Section 3(k) of the Indian Patents Act and CRI Guidelines 2025 across `PatentSpecificationModal.tsx` and docs.
- **F8 (Views & Triggers in Applied Migration)**: Created and applied migration `20261023160000_views_and_triggers` to SQLite `dev.db`, creating `vw_case_activity_summary`, `vw_candidate_ranking`, `trg_audit_evidence_insert`, and `trg_seal_insert_guard`. Verified target domain models (`Department`, `Employee`, `Order`) are clearly justified as benchmark target schema.
- **F9 (Verification Traceability)**: Re-ran all test suites locally and recorded actual observed passing outputs.
- **F10 (Frontend Linter Warnings)**: Resolved all 6 oxlint warnings (clean regexes, module-scoped exports, useCallback dependencies); `npx oxlint` reports **0 warnings, 0 errors**.
- **F11 (Packaging & Clutter Removal)**: Removed `scripts/supervisor/` logs, `AUTONOMOUS_EXECUTION_LOG.md`, and `09_repository_audit.md`; updated `.env.example` to default to `NODE_ENV=development`; cleaned `backend/package.json`.
- **F12 (External Deliverables Scope)**: Explicitly catalogued local verified components versus external hosting requirements.

## Current state

LAZARUS-X is an academic forensic relational database reconstruction prototype. The active Prisma runtime targets SQLite. PostgreSQL DDL under `backend/db/init/01_advanced_features.sql` is a reference script only.

Verified locally:
- `npm run typecheck:backend` — 0 errors
- `npm run lint:frontend` — 0 warnings, 0 errors
- `npm test` — all backend test suites passed (11/11 suites, 100%), frontend unit tests passed (25/25), intake tests passed
- `npm run dbms:demo` — all 7 DBMS requirements verified (11 tables, CRUD, joins, aggregates, views, triggers, transactions, EXPLAIN QUERY PLAN, copy/restore)
- `node scripts/verify_live_api.js` — 8/8 live server operations passed
- `npm run test:e2e` — 3/3 Playwright browser tests passed

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
