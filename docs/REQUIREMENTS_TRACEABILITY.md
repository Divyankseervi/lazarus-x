# Assessment Requirements Traceability and Verification Status

LAZARUS-X Relational Forensics Subsystem Specifications

This matrix maps the supplied project to the assessment handout. A source file is evidence of implementation intent, not proof of a successful runtime demonstration. External requirements such as GitHub repository configuration, deployment URL, and custom domain must be verified in the student's own accounts.

| Assessment requirement | Current project evidence | Status / action before submission |
|---|---|---|
| Project proposal, objectives, scope, stack, deliverables and timeline | `docs/TECHNICAL_SPECIFICATION_REPORT.md` | Review for truth and align with the actually observed run. |
| ER diagram and relational schema with at least 8 tables | `docs/ER_diagram.md`, `backend/prisma/schema.prisma` (11 models) | Run Prisma validation; capture schema evidence. |
| PKs, FKs, uniqueness/defaults/indexes and normalization discussion | Prisma schema, `docs/data_dictionary.md` | Validate constraints against active schema. Do not assert formal BCNF proof without documenting dependencies. |
| ORM-based database interaction | Prisma calls in `backend/src/index.ts` and database demo | Validate Prisma and run the demo. |
| CRUD and joins/aggregates | API routes and `backend/src/database/dbms_features_demonstration.ts` | Run the DBMS demonstration on its isolated temporary database and record output. |
| Views and triggers where supported | SQLite view/trigger creation in the DBMS demonstration | Run the demo and verify the assertions. Triggers created by the demo persist in that temporary database only. |
| Stored procedure / transactional routine where supported | `prisma.$transaction` case-sealing logic | SQLite does not support native stored procedures; explain the application-level transaction in the viva. `backend/db/init/01_advanced_features.sql` is PostgreSQL-specific reference SQL and is not executed by the current runtime. |
| Responsive application, separate role dashboards, login, search/filter, pagination, validation and error handling | `frontend/src/App.tsx`, `frontend/e2e/auth-portals.spec.ts`, API routes | Investigator reconstruction and Administrator control-center dashboards are role-separated; frontend tests 25/25, production build, and Playwright browser flows passed locally. |
| At least two roles, one users table, API authorization | `User.role`, authentication and authorization middleware in `backend/src/index.ts` | Run tests for role restrictions and cross-user case isolation. Admin must be provisioned explicitly. |
| Password hashing, SQL injection protections and secret management | `backend/src/security/password.ts`, Prisma ORM, `.gitignore`, `.env.example` | Check `git status`, secret scanning and security tests; never commit `.env`. |
| Native database backup and recovery | `scripts/backup_database.sh`, `scripts/backup_database.bat`, `scripts/restore_database.sh`, admin backup route, CI backup/restore drill | Windows native backup passed locally with `sqlite3`; the DBMS demonstration also verified isolated restore and row counts. |
| Version control: private repo, collaborators, branches, 10 meaningful commits and PRs | `.github/workflows/ci.yml` is source only | Must be configured and demonstrated in GitHub; cannot be satisfied by the ZIP itself. |
| Docker and CI/CD | `Dockerfile`, `docker-compose.yml`, `.github/workflows/ci.yml` | CI workflow and Docker packaging are present. Docker execution and remote GitHub status were not available in this local environment and must be verified before submission. |
| Live URL / custom domain | No verified deployment is bundled | Deploy independently and enter the real URL. Do not claim an unverified URL or domain. |
| Additional industry practice | Automated tests, audit/provenance code, metrics, backup scripts | Demonstrate at least one that actually passes at runtime. |
| Read-only artifact intake, manifest verification and SQLite structure analysis (additional feature) | `scripts/ingest_artifact.js`, `scripts/verify_artifact_manifest.js`, `scripts/analyze_sqlite.py`, and their tests | Run `npm run test:intake` and `python scripts/test_analyze_sqlite.py`; analysis reports schema/metadata and row counts but does not recover deleted rows or export record values. |

## Current verification record

## Observed local verification (2026-10-23)

The local toolchain passed `npm test` (all backend suites, frontend 25/25, and artifact intake), `npm run test:sqlite-analysis`, `npm run test:e2e` (3/3), `npm run validate:db`, `npm run typecheck:backend`, `npm run build:frontend`, `npm run dbms:demo`, and `npm run lint:frontend` (passes with 6 warnings). The DBMS demo confirms 11 tables, ORM CRUD, joins/aggregates, views, triggers, application-level transactions, composite-index use, and isolated copy/restore. `scripts\backup_database.bat` (SQLite integrity check passed) and a local start with `/api/health` and `/` returning HTTP 200 were also recorded earlier on 2026-10-23.

**No grade or full-compliance claim is made here.** GitHub repository privacy/collaborators/branches/commit history, remote CI status, Docker Hub publishing, live deployment, and custom domain remain external submission obligations. The faculty assigns marks based on source, timestamped screenshots, live demonstration and the external requirements in the handout.
