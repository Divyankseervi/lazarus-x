# LAZARUS-X Developer Handoff

## Vercel Live Production Web App Link Integration — 2026-10-31

- **Live Production URL Embedded**:
  - Embedded `https://lazarus-x-gbp1.vercel.app/` across all primary documentation, application interfaces, and report artifacts:
    - Page 1 Direct Header of the official submission DOCX and PDF (`Live Production Web App (Vercel): https://lazarus-x-gbp1.vercel.app/`).
    - Section 1.7 Major Deliverables, Section 8.1 Version Control & Live Deployment, and Section 10 Project Output Screenshots (caption footers).
    - `README.md` primary header links and deployment blueprint.
    - `frontend/src/ForensicReportModal.tsx` in both the certified investigators header card and the downloadable investigation Markdown report.
- **Deliverables Regenerated & Synced**:
  - `submission/24BCE0793_24BCE0786_L25+L26_IA9&10_Proj_DIVYANK_VIDUSHI.docx` & `.pdf` (27 pages, 1.96 MB).
  - Project root copies synchronized.
  - Pushed to `main` and `dev` on GitHub (`https://github.com/Divyankseervi/lazarus-x`).

## Direct Header Formatting (QP Instruction 1 Alignment) & Authentic Docker / Supabase Screenshots Integration — 2026-10-31

- **Cover Page Direct Header Refactoring (Zero Tables)**:
  - Addressed user feedback to eliminate Table 1 (Course Metadata) and Table 2 (Student Team Responsibilities) on Page 1 of the Word/PDF document.
  - Replaced tables with direct, clean, academic paragraphs strictly adhering to QP Instruction 1: *"1. Write your Name, Regno, Course code, Course Title, Slot on the top of the word document"*.
  - Explicitly formatted: Project Title, Student Names & Register Numbers (Divyank Seervi 24BCE0793 & Vidushi Negi 24BCE0786), Course Code & Title (BCSE302P – Database Systems Lab), Slot (L25 + L26), Class Number (VL2026270104025), Faculty Name (Dr. V. SIVAKUMAR), and direct GitHub URL (`https://github.com/Divyankseervi/lazarus-x`).
  - Student responsibilities structured directly as indented bullet items under student headers.

- **Authentic Docker Desktop & Supabase Cloud Integration**:
  - Incorporated user's authentic screenshots into `submission/screenshots/pristine/`:
    - `13_docker_containerization_deployment.png`: Docker Desktop GUI verifying the `lazarus-x` container deployment.
    - `14_supabase_managed_cloud_database.png`: Supabase Table Editor displaying all 15 public relational tables and analytical SQL views.
    - `15_supabase_database_triggers.png`: Supabase Database Functions console showing active PL/pgSQL triggers (`lazarus_audit_evidence_insert` and `lazarus_reject_evidence_for_sealed_case`).
    - `16_supabase_schema_visualizer.png`: Supabase Visual Relational Schema Graph displaying foreign key lines and schema topology.
  - Section 10 now features Figures 10.13 through 10.16 with full verification descriptions and live timestamps.

- **Definitive Submission Artifacts Generated**:
  - `submission/24BCE0793_24BCE0786_L25+L26_IA9&10_Proj_DIVYANK_VIDUSHI.docx` & `.pdf` (26 pages, 2.05 MB).
  - Mirrored in project root: `24BCE0793_24BCE0786_L25+L26_IA9&10_Proj_DIVYANK_VIDUSHI.docx` & `.pdf`.
  - Zero redundant, temporary, or loose `.docx`, `.pdf`, or `.md` files present in git tracking.

## Comprehensive 14-Feature Final Submission Document & High-Definition Screenshots Compilation — 2026-10-31

- Generated single definitive official submission DOCX and vectorized PDF fully compliant with Dr. V. SIVAKUMAR's Lab Assessment Rubric:
  - `submission/24BCE0793_24BCE0786_L25+L26_IA9&10_Proj_DIVYANK_VIDUSHI.docx` (3.28 MB)
  - `submission/24BCE0793_24BCE0786_L25+L26_IA9&10_Proj_DIVYANK_VIDUSHI.pdf` (1.98 MB)
  - Mirrored in project root for immediate access: `24BCE0793_24BCE0786_L25+L26_IA9&10_Proj_DIVYANK_VIDUSHI.docx` and `.pdf`.
- Captured all 14 project features at full 1920x1080 resolution, complete with timestamps and academic descriptions:
  1. `01_user_authentication_login.png`: Single-Table RBAC Authentication Portal (`/login`)
  2. `02_dashboard_and_evidence_intake.png`: Investigator Workspace, Active Case Telemetry & Evidence Intake Console
  3. `03_materialized_relational_tables.png`: Materialized Relational SQL Tables View (Department & Employee Records)
  4. `04_schema_dag_foreign_keys.png`: Relational Schema DAG & Foreign Key Dependency Topology Visualizer
  5. `05_candidate_diff_matrix.png`: Candidate Diff Matrix & Branching Hypotheses Disambiguation
  6. `06_cryptographic_provenance_ledger.png`: Cryptographic Provenance Ledger & RFC 6962 Binary Merkle Root Inspector
  7. `07_admin_audit_trail_modal.png`: Administrative System Audit Trail Modal (`/audit-logs`) with Database Triggers
  8. `08_forensic_case_dossier_modal.png`: Certified Forensic Case Dossier & Chain-of-Custody Modal
  9. `09_schema_studio_modal.png`: Interactive Schema Studio - Visual Relational Schema Designer & Entity Model Builder
  10. `10_department_verification_page.png`: Department Record Verification Console (`/department-verification`)
  11. `11_document_locator_page.png`: Physical Source Document Locator Console (`/document-locator`)
  12. `12_evidence_expiry_lab_page.png`: Evidence Expiry & Retention Lifecycle Lab (`/evidence-lifecycle`)
  13. `13_docker_containerization_deployment.png`: Docker Enterprise Containerization & Compose Architecture
  14. `14_supabase_managed_cloud_database.png`: Supabase Managed PostgreSQL Cloud Database (AWS Tokyo, 12 tables, RLS, Triggers, Views)
- All 5 architectural diagrams embedded (ER Diagram, System Architecture, Merkle Provenance Tree, ACID State Machine, Shannon Entropy Decay Curve) totaling 19 embedded figures.
- GitHub repository synchronized and pushed (`https://github.com/Divyankseervi/lazarus-x`): both `main` and `dev` branches are up-to-date with progressive commit history.
- Cluttered, duplicate, and redundant older DOCX/PDF files safely removed to satisfy the explicit directive ("not unnecessary docx and pdf and all").

## GitHub link in Forensic Report, Vercel & Render Deployment, and Repository Sync — 2026-10-30

- Fixed Render TypeScript compilation errors: moved all `@types/*` packages (`@types/node`, `@types/express`, `@types/cors`, `@types/bcrypt`) into `dependencies` in `backend/package.json` so that Render's production install (`NODE_ENV=production`) installs the type definitions.
- Configured `backend/tsconfig.json` to target and lib `ES2022` ensuring built-in support for `Buffer`, `Object.fromEntries`, `flatMap`, and `Promise.finally`.
- Resolved json response casting in `backend/src/security.test.ts`.
- `npm run typecheck:backend` and `npm run build:frontend` both passed with 0 errors.
- Fixed Render production build issue ("This is not the tsc command you are looking for"): moved `typescript` and `ts-node` from `devDependencies` to `dependencies` in `backend/package.json` and synchronized `backend/package-lock.json`. In production environments where `NODE_ENV=production` defaults `npm ci` to omit dev dependencies, the TypeScript compiler is now guaranteed to install locally.
- Added `npm run build` (`prisma generate --schema prisma/supabase/schema.prisma && tsc`) and `npm run start:prod` (`node scripts/db_setup.js && node dist/index.js`) to `backend/package.json` for streamlined deployment on Render.
- Embedded the direct GitHub repository link (`https://github.com/Divyankseervi/lazarus-x`) into the application's Forensic Investigation Report (`frontend/src/ForensicReportModal.tsx`):
  - In the downloadable Markdown investigation report dossier metadata.
  - In the top certified investigators banner in the printable dossier UI.
  - In Section 4 (Review Notes & Integrity Verification) linking the audit pipeline and source code directly to GitHub.
- Updated `docs/TECHNICAL_SPECIFICATION_REPORT.md` to explicitly reference `https://github.com/Divyankseervi/lazarus-x` in the specification header and Section 6.1 (Version Control & Git Hygiene).
- Added `frontend/vercel.json` and root `vercel.json` with SPA history fallback rewrites and build settings for zero-config Vercel deployment.
- Verified Dockerfile and `render.yaml` for Render deployment (supporting both single-service fullstack Docker deploy and split Render backend + Vercel frontend architecture).
- Verification:
  - Frontend build: `npm run build:frontend` passed cleanly.
  - Frontend Vitest: 43/43 tests passed across 9 test suites.
  - Backend engine test suites passed (oracle, audit, teacher input, equivalence).
  - PostgreSQL Prisma schema validated via `npx prisma validate --schema prisma/supabase/schema.prisma`.

## Neo-brutalist editorial visual system — 2026-10-29

- Updated `frontend/src/index.css` with a shared print-room design system for the investigator workspace, sign-in screen, and standalone tools: concrete paper canvas, ink rules, one hazard-orange accent, serif display headings, monospaced technical labels, square bordered modules, and subtle paper grain.
- Added short staggered entrance motion, tactile hard-shadow button hover states, responsive workspace adjustments, and reduced-motion support. No React behavior or route structure changed.
- Validation: `npm run build` from `frontend` passed (Vite 8.3.4; 2,331 modules transformed). The existing 658 kB JavaScript chunk advisory remains. No test suite was run.
- Scope: CSS-only visual pass. The prior dirty worktree contained numerous unrelated edits; none were modified as part of this pass.

## Supabase PostgreSQL preparation — 2026-10-28

- Added a separate PostgreSQL Prisma schema and a provider-specific initial migration under `backend/prisma/supabase/`, keeping the existing SQLite schema and migration history untouched.
- Added runtime provider selection (`DATABASE_PROVIDER=postgresql`) and Prisma commands for validation, client generation, and migration deployment. `DIRECT_URL` is used by Prisma migration config when available; use the Supabase pooler URL for runtime `DATABASE_URL` and the direct database URL for `DIRECT_URL`.
- Documented required environment variables and the supported setup sequence in `README.md` and `backend/.env.example`.
- The Postgres baseline contains the Prisma models and indexes; SQLite-only SQL views/triggers and native SQLite backup are not ported. Supabase project credentials and a live database were not available, so no remote migration was run.
- Next steps: provision the Supabase project; set secrets locally/at the backend host; run `npm run db:supabase:validate`, `npm run db:supabase:generate`, and `npm run db:supabase:migrate` from `backend`; then add PostgreSQL integration coverage and a Postgres backup/restore plan before production.
- Follow-up: the user provisioned Supabase project `ybztdpacxgmpuwhhoeao` (dashboard status Healthy, region ap-northeast-1). The direct host resolves IPv6-only and is unreachable from this workstation; the Session pooler on port 5432 is reachable. A connection attempt failed authentication, and no migration was applied. The supplied database password was exposed in chat; rotate it before the next attempt. The local `backend/.env` was cleared back to SQLite settings and the SQLite Prisma client was regenerated. Never record the password in this file.
- Connection completed: Supabase Session pooler credentials were updated locally in the ignored `backend/.env`; `DATABASE_PROVIDER=postgresql`, `DATABASE_URL`, and `DIRECT_URL` now point to the reachable session endpoint. `20261028000000_initial` was applied successfully, `prisma migrate status` reports up to date, and a Prisma query against `User` succeeded with zero rows. The baseline creates 12 tables. The PostgreSQL Prisma client is generated. `SEED_DEFAULT_USERS=false` prevents demo credentials from being seeded into the hosted database. Do not commit or copy credentials into tracked files. Rotate the credential shared in chat and update the local environment after rotation.
- Standard launch paths now call `backend/scripts/db_setup.js`, which validates/generates/pushes SQLite locally or validates/generates/deploys Prisma migrations for PostgreSQL. Root `npm start`, `start.bat`, and `start.sh` use this provider-aware setup. Verification after the update: `npm run db:setup`, `npx tsc --noEmit`, `node --check scripts/db_setup.js`, `npx prisma migrate status --schema prisma/supabase/schema.prisma`, and `git diff --check` passed.
- Supabase parity expansion: added a PostgreSQL migration with `vw_case_activity_summary`, `vw_candidate_ranking`, PL/pgSQL evidence-audit and sealed-case guard functions/triggers, and RLS on all 12 app tables with `anon`/`authenticated` grants revoked. Applied both Supabase migrations successfully. `npm run db:supabase:smoke` connected to the hosted database and passed the audit-trigger, view, sealed-insert-guard, and 12-table RLS checks; temporary test rows were cleaned up.
- Docker now builds the matching SQLite or PostgreSQL Prisma client using `DATABASE_PROVIDER`, runs the provider-aware setup script on startup, and excludes `.env` files from the build context. Added `docker-compose.supabase.yml`; updated the standard compose file to select SQLite and Render to require PostgreSQL secrets with demo-user seeding disabled. Docker CLI was unavailable on this machine, so image build/start remains unverified.
- Wide-screen case workspace now uses independent scrolling for cases/work/guidance and paired columns for overview/metrics, evidence/raw records, and graph/selected result; narrower screens retain stacked layout. Fixed a synthetic-demo key-selection timing issue in `DepartmentVerificationPage`. Final frontend verification: build passed, Vitest 42/42 passed, backend TypeScript check passed, Supabase smoke passed, and local API readiness returned READY. Vite retains its existing large-chunk advisory. Docker CLI is absent, so Docker build/start could not be run here.
- Docker follow-up: located the installed CLI via the Docker Desktop Start Menu shortcut. The first Supabase container start exposed that Prisma client generation tried to modify the read-only runtime filesystem. The provider-aware setup script now skips generation only when `PRISMA_CLIENT_GENERATED=true` (Docker images generate the matching client during build). Rebuilt and recreated the Supabase Compose service successfully; container is healthy and `GET /api/health/ready` returned HTTP 200 with database `UP`. Container logs confirm both migrations are applied and no migration is pending. Docker's credential-helper directory must be on PATH for this user's CLI session; that was done only for the build/run commands.
- Preset login follow-up: at the user's request, provisioned the frontend's existing preset INVESTIGATOR and ADMIN accounts in the connected Supabase database. Passwords were taken from the existing frontend presets without printing them; account verification returned successful logins for both roles. These demonstration credentials are shared with the source UI and must be rotated before any public or shared deployment.
- Supabase evidence workflow repair: reproduced the reported failure on bulk example evidence commits. The API was doing serial remote inserts inside Prisma's short default transaction window. It now batches fragment and provenance inserts on PostgreSQL and uses the sequential path for SQLite (Prisma 5.11's SQLite client has no `createMany` delegate); the transaction allows up to 60 seconds. API failure logs now include only the Prisma error code in addition to the error class, never request data or database messages. Both provider paths pass TypeScript/test compilation.
- End-to-end verification after the repair: signed in with the preset investigator, used **Start government recovery**, and confirmed the Supabase case contains 22 source updates, 22 provenance events, and four candidate reconstructions; the success notice rendered and the browser console had no errors. Final Docker image rebuilt and Compose container is healthy; readiness returned HTTP 200/database UP; in-container Supabase smoke passed trigger, sealed-case guard, view, and 12-table RLS checks. Full `npm test` passed backend tests, frontend 42/42, and artifact-intake smoke tests (run with the local SQLite provider/client for the SQLite integration tests).

## Government record recovery integration — 2026-10-27

- Added the `government-record-recovery` case template with eight relations: `Person`, `BirthRecord`, `SourceDocument`, `SourceObservation`, `GovernmentOffice`, `Department`, `ReviewDecision`, and `CaseAssignment`.
- Corrected the office relationship to use `GovernmentOffice.departmentId -> Department.id`; the office primary key is no longer incorrectly treated as the department key.
- Added the synthetic **Damaged birth register — Kolar** walkthrough with municipal, hospital, school, family-register, and office observations. It intentionally leaves competing dates of birth visible so the user can see why more evidence is needed.
- Government cases now select their matching scenario automatically, expose the scenario in the schema studio, and provide government-specific sample fragments. Existing incident-response and workforce/order scenarios remain available.
- Documented the evidence-recovery boundary in `README.md` and `PROJECT_CONTEXT.md`: no unsupported resurrection claims and no automatic legal identity certification.
- Validation after integration: frontend tests 29/29, frontend build passed, frontend lint passed, backend typecheck passed, Prisma schema validation passed, and `git diff --check` passed. The existing Vite large-chunk advisory remains non-blocking.

## Simpler government workflow and raw source records — 2026-10-27

- Added a prominent **Start government recovery** button so a user can open the Kolar birth-record example without designing a schema first.
- Simplified visible labels across the workspace: cases, source records, record types, possible answers, differences, case history, and close case. Older technical terms remain only as small compatibility labels where existing browser tests and accessibility contracts depend on them.
- Added **All source records** before the answer panels. It displays every entered source item in a table with record type, record number, detail, original value, source name, confidence, and time added.
- Added **Add another source record** to focus the source-entry form directly from the raw-data table.
- The case API now returns all accepted source entries for the raw-data table instead of limiting the response to the latest 50 items. Existing provenance and answer calculations are unchanged.
- Validation after this workflow update: frontend tests 29/29, Playwright E2E 3/3, frontend lint passed, frontend build passed, backend typecheck passed, and diff checks passed.

## Usable conclusions for every sample case — 2026-10-27

- Reworked all 10 built-in examples so each has a plain-language final conclusion and a useful next action, rather than only showing technical counts.
- Conclusions now cover:
  - Kolar birth record: person supported, birth date still needs certified confirmation.
  - Clean cyber case: records agree and are ready for review.
  - Records arriving later: links become complete when the missing record arrives.
  - Two names: stronger name is identified, but an official source is still needed.
  - Same record number twice: case must be corrected before acceptance.
  - Clean staff and purchase case: staff, departments, and purchases connect correctly.
  - Missing employee: locate the missing employee record before confirmation.
  - Two purchase amounts: invoice-backed amount is stronger but needs source checking.
  - Large cyber case and large purchase case: all submitted records connect into one reviewable answer.
- The example validation test now requires every case to contain a non-empty purpose and a conclusion beginning with `Conclusion:`.
- Replaced technical sample names in the visible scenario selectors with basic terms such as **Clean cyber case**, **Records arrive later**, **Two names for one person**, and **Large purchase case**.

## Final person result table — 2026-10-27

- Added a government-only **Final person result** section after the selected answer tables.
- It compares, row by row:
  - **What we had**: every source value entered for the person.
  - **What we found**: the value in the selected best-supported person record.
  - **Status**: Supported or Needs checking.
- The section includes a simple conclusion and the source names used, while explicitly retaining review-before-use wording for government decisions.
- Validation: complete `npm run test:all` passed, Playwright 3/3 passed, frontend 29/29 passed, and the running application returned HTTP 200.

## Dynamic raw-data summary for every case — 2026-10-27

- Replaced the government-only person summary with a generic **Final data summary** that works for every preset and custom schema.
- The table is built from the active case data and source history at runtime; it does not contain hardcoded person, government, or field names.
- For every record and field it shows:
  - every raw value entered under **What we had**,
  - the source names,
  - the current selected answer under **What we found**,
  - and **Supported** or **Needs checking** status.
- It includes records from all tables, not only `Person`, and automatically includes future record types and fields added by a user.
- Fixed auto-loaded scenarios so their source records are immediately available in the final summary; manually added records continue to use the same dynamic path.

## Dynamic primary-key table — 2026-10-27

- Added **Primary keys in this case** immediately before **What we had and what we found**.
- The table is generated from the active schema and case data, so it lists every record currently present rather than using government-only or person-only assumptions.
- Key selection is deterministic: a declared `id` column is preferred, then the first declared unique column, then the record number when a custom table has no declared key.
- Each row shows the record type, record number, key field, and key value. The existing raw-value comparison remains directly below it.
- Added styling for the new table without changing the existing case-engine or provenance behavior.
- Validation after this patch: frontend unit suite 29/29, complete `npm run test:all` passed including Playwright 3/3, frontend build passed, frontend lint passed, and `git diff --check` passed. The existing Vite large-chunk advisory remains non-blocking.

## Evidence relationship graph visibility — 2026-10-27

- Promoted the existing relationship graph from a collapsed optional section to an open, first-class case-workspace section so it is visible during demonstrations.
- Renamed it to **Evidence relationship graph** and clarified the two views:
  - **Observed record relationship map**: connects surviving record rows only when a value matches a declared foreign-key relationship.
  - **Declared schema & constraints**: shows the case tables, fields, and relationship definitions even when evidence is incomplete.
- Added plain-language guidance that an absent line means “not observed yet,” not proof that two records are unrelated.

## Administrator control center — 2026-10-27

- Expanded the administrator dashboard beyond basic counts and two action cards.
- Added a **Safe control center** with explicit actions for verified database backup, cross-user audit review, and exporting a counts-only administrator snapshot. The snapshot excludes raw evidence and credentials.
- Added a **Platform health** panel showing API/database readiness, audit availability, role protection, and backup freshness guidance. These are operational checks, not claims about the correctness or legal status of records.
- Added an **Operating picture** panel that reframes users, administrators, cases, evidence, and audit events as administrator attention metrics and shows when the protected overview was last refreshed.
- Kept privileged actions behind the existing administrator API and reused the existing overview, audit, and backup flows; no unsupported user-management controls were added.
- Validation: frontend tests 29/29, frontend build, frontend lint, and `git diff --check` passed. The existing Vite large-chunk advisory remains non-blocking.

## Separate Case Time Machine page — 2026-10-27

- Added a dedicated read-only route at `/case-time-machine?case=<case-id>`.
- The existing case workspace exposes only an **Open Case Time Machine** link from the recent-fragments area; the replay interface is not embedded into the main workspace.
- The page loads the selected case name and provenance commitments, then provides a slider to reveal the ledger events progressively.
- It shows the last known event at the selected point, the case-evolution list, event timestamps, and a clear read-only limitation notice.
- Authentication is carried through a session-scoped token set after login and removed on logout. The page never writes or mutates case evidence.
- Validation after this page: frontend tests 29/29, frontend build passed, frontend lint passed with no warnings, and `git diff --check` passed. The existing Vite large-chunk advisory remains non-blocking.

## Separate final data report page — 2026-10-27

- Removed the full **What we had and what we found** summary from the main case workspace so the investigation page stays focused on evidence collection, relationships, and candidate review.
- Added the final report hyperlink at the bottom of the main results section, after the selected reconstruction tables and conflict review: **View what we had and what we found**.
- Added a dedicated read-only route at `/final-data-summary?case=<case-id>`.
- The page loads the saved case state from the authenticated case endpoint and renders the existing dynamic summary, including primary keys, every raw value, sources, selected values, and review status for government, cyber, workforce, and custom schemas.
- The report is dynamic and uses the active case response; it does not hardcode a person, table, or field.
- Validation: frontend tests 29/29, frontend build, frontend lint, and `git diff --check` passed. The existing Vite large-chunk advisory remains non-blocking.

## UX reliability and explainability update — 2026-10-27

- Fixed the Candidate Conflict Matrix consuming the wrong response property. The API returns `candidateValues`, while the component only read `predictedValues`; competing values now render instead of falling back to the selected value.
- The matrix status line now says when fields still need independent evidence, rather than displaying “No surfaced conflict” beside a disputed count.
- Added plain-language guidance explaining why a field is disputed and what evidence resolves it, plus a workspace summary explaining what one or multiple surviving reconstructions mean.
- Changed **Start clean demo** / one-click scenario loading to always create an isolated matching case. Demo evidence no longer silently appends to an investigator's active case. Appending remains an explicit **Add to current case** action.
- Accepted-fragment notices now include the committed `field: value`, making the result immediately explainable and keeping the browser contract explicit.
- Replaced render-unstable timeline IDs with deterministic IDs and corrected the friend quick-start Node requirement to 22.12+ (or 24+).
- Final validation: `npm run test:all` passed; frontend unit suite passed 29/29; Playwright E2E passed 3/3; `npm run test:security` passed; `npm run lint:frontend` passed with 0 warnings/errors; `npm run build:frontend` passed. Vite still reports the existing non-failing large-chunk advisory.

## Professional case-workbench pass — 2026-10-27

- Added a plain-language **Case at a glance** block showing case stage, evidence count, and the next useful action.
- Added a lightweight investigation checklist covering schema setup, first evidence, answer review, and custody verification. It is intentionally local UI guidance and does not pretend to be a legal workflow record.
- Simplified workflow labels to **Set up case → Add evidence → Review answers → Check history** while retaining the technical detail in supporting text.
- Reworked the visual language toward a restrained evidence-room/case-management interface: navy and paper surfaces, quieter borders, reduced decorative gradients, clearer status colors, and stronger information hierarchy.
- Demo scenarios now visibly explain their real-world use case; the scenario strip references Indian workplace and cyber-incident examples without claiming that synthetic demo data is real evidence.
- Validation after redesign: frontend unit suite 29/29, Playwright E2E 3/3, production build passed, lint passed with 0 warnings/errors.

## Review pass — 2026-10-23 (Pristine Borderless 1080p Viewports & 5 High-Resolution Pictorial Architectural Charts)

- **Elimination of Blue Border Artifacts**:
  - Replaced browser-container captures with direct native Chromium Playwright viewports at 1920×1080 resolution.
  - Pixel perimeter validation verifies **0 blue edge pixels** across top, bottom, left, and right borders. Zero title bars, zero IDE recording halos.
- **5 High-Resolution Pictorial Architectural Charts Generated & Embedded**:
  - **Figure 1.1** ([`submission/charts/figure_2_system_architecture.png`](file:///c:/Users/divya/OneDrive/Desktop/std/dbms/LAZARUS-X-CORE-ALIGNED-FINAL/lazarus-x/submission/charts/figure_2_system_architecture.png)): System Architecture & 5-Layer Forensic Reconstruction Dataflow.
  - **Figure 2.1** ([`submission/charts/figure_1_er_diagram.png`](file:///c:/Users/divya/OneDrive/Desktop/std/dbms/LAZARUS-X-CORE-ALIGNED-FINAL/lazarus-x/submission/charts/figure_1_er_diagram.png)): Complete Crow's Foot Entity-Relationship (ER) Model (300 DPI, 4179×2679) with all 6 normalized entities, PK/FK badges, and cardinality lines.
  - **Figure 4.1** ([`submission/charts/figure_4_transaction_state_lifecycle.png`](file:///c:/Users/divya/OneDrive/Desktop/std/dbms/LAZARUS-X-CORE-ALIGNED-FINAL/lazarus-x/submission/charts/figure_4_transaction_state_lifecycle.png)): Database ACID Transaction State Flowchart & Sealed Case Finite State Machine with trigger guards and rollback loops.
  - **Figure 5.1** ([`submission/charts/figure_3_merkle_provenance_tree.png`](file:///c:/Users/divya/OneDrive/Desktop/std/dbms/LAZARUS-X-CORE-ALIGNED-FINAL/lazarus-x/submission/charts/figure_3_merkle_provenance_tree.png)): RFC 6962 Binary Merkle Tree & Sequential SHA-256 Hash Chaining.
  - **Figure 9.1** ([`submission/charts/figure_5_shannon_entropy_curve.png`](file:///c:/Users/divya/OneDrive/Desktop/std/dbms/LAZARUS-X-CORE-ALIGNED-FINAL/lazarus-x/submission/charts/figure_5_shannon_entropy_curve.png)): Information-Theoretic Disambiguation Shannon Entropy Decay vs. Evidence Intake Curve.
- **7 Pristine Native 1080p Screenshots Embedded in Section 10**:
  - Figures 10.1–10.7: Login interface, Investigator console, Materialized SQL relational grids, Schema DAG graph, Provenance ledger, Admin audit history modal, and Certified case dossier modal.
- **Final Word Submission File**:
  - Generated and copied to root: `24BCE0793_L25+L26_IA9&10_Proj_DIVYANK_SEERVI.docx` (2.70 MB, 156 paragraphs, 38 native tables, 12 total figures).
  - Also generated in `submission/` along with matching PDF backup.
- **Git & Repository Sync**:
  - Pushed to `main` and `dev` (`5a0136b`). Working tree clean. All backend and database verification tests pass.

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

## Feature update — 2026-10-23 (One-Click Example Scenarios & Multi-Row Database Recovery)

Added one-click example scenarios to populate empty cases with pre-configured demonstration evidence fragments without manual typing, fully guarded and explicitly labeled as DEMO data.

- **Frontend Scenario Definitions (`frontend/src/exampleScenarios.ts`)**:
  - Implemented typed `divyank24BCE0793_EXAMPLE_SCENARIOS` export containing scenarios A through I:
    - **A (`ir-clean`)**: Preset `incident-response`, clean incident evidence (Asha Rao, Ravi Kumar, LAPTOP-07, Phishing email, artifact, observation). Engine yields 1 surviving interpretation, entropy 0.000, 0 violations.
    - **B (`ir-out-of-order`)**: Preset `incident-response`, out-of-order evidence arrival (observation first, then artifact, incident, person). Foreign keys resolve monotonically from 2 resolvable violations to 0; 1 surviving interpretation.
    - **C (`ir-name-conflict`)**: Preset `incident-response`, conflicting name for Person 1 (conf 0.9 "Asha Rao" vs conf 0.4 "A. Rao"). Generates 2 surviving interpretations; recommendation targets `Person[1].name`; top candidate preserves "Asha Rao".
    - **D (`ir-unique-clash`)**: Preset `incident-response`, duplicate primary key `Person.id=1` ("Asha Rao" vs "Ravi Kumar"). Engine reports fatal violation, retains single interpretation with penalized score (~0.01).
    - **E (`wf-clean`)**: Preset `workforce-orders`, clean workforce evidence (Finance, Operations, Kiran, Lata, Order 1 & 2). Engine yields 1 interpretation, 0 violations, score 1.0.
    - **F (`wf-missing-parent`)**: Preset `workforce-orders`, Order pointing to unevidenced employee 7. Retains 1 resolvable violation on `Order.employeeId` (score 0.5); guides investigator to add employee.
    - **G (`wf-amount-conflict`)**: Preset `workforce-orders`, conflicting order amount (2500 conf 0.9 vs 250 conf 0.5). Generates 2 interpretations; recommendation targets `Order[1].amount`.
    - **H (`ir-multi-incident-cascade`)**: Preset `incident-response`, complex enterprise incident recovery scenario with **14 records across 5 distinct tables** (`Person` x4, `Device` x3, `Incident` x2, `Artifact` x3, `Observation` x2, 50 evidence fragments). Demonstrates foreign key cascading across multi-tier relational topologies under bounded AC-3 propagation.
    - **I (`wf-multi-dept-enterprise`)**: Preset `workforce-orders`, multi-department corporate supply chain scenario with **18 records across 3 distinct tables** (`Department` x4, `Employee` x6, `Order` x8, 50 evidence fragments). Demonstrates deep multi-row relational reconstruction with complex referential constraints.
  - Every fragment sets `sourceRef: "example:<scenario-id>"` so provenance records clearly display demonstration origin.
- **UI & Guards (`frontend/src/App.tsx`)**:
  - Replaced the single synthetic button with the Example Scenarios panel (`<select>` dropdown, scenario goal/preset card, expected note, and "Load scenario" action).
  - Kept the dynamic guided walkthrough available as an option in the dropdown.
  - Guarded: Enabled only when case is selected, status is not `SEALED`, evidence ledger is empty (`auditTotal === 0`), and case schema preset matches scenario preset (otherwise disabled with tooltip indicating which preset to create).
  - Modal warning: `window.confirm("Load N EXAMPLE fragments into this case? These are demo values, not recovered evidence, and cannot be removed individually.")`.
  - Batch commit path reused; displays banner: `Example '<title>' loaded (N fragments)`.
  - Fully accessible with `aria-label`s and existing CSS tokens.

## Automated Evidence Ingestion & Auto-Fill Update — 2026-10-23

Simplified evidence intake workflows to be intuitive, clean, and accessible in 1 click:
- **`⚡ 1-Click Auto-Load` in Example Scenarios (`frontend/src/App.tsx`)**:
  - Added a prominent primary `⚡ 1-Click Auto-Load` button right next to the scenario dropdown.
  - Automatically loads the chosen scenario into the active case if compatible, or auto-creates a matching case and ingests all evidence immediately if presets differ or case is sealed.
  - Preserves the legacy `Load scenario` button and tooltip invariants for unit test suite compatibility.
- **Form Auto-Fill Toolbar (`frontend/src/App.tsx`)**:
  - Added an intuitive **`⚡ AUTO-FILL INPUTS:`** quick bar directly above the Evidence Intake form fields.
  - **Sample Fragment Selector**: Dropdown pre-populated with schema-aware observations (e.g. `Employee #1: Kiran`, `Order #1: Amount 2500`, `Department #10: Engineering`, `Person #1: Asha Rao`, etc.). Selecting any item immediately fills the form fields (`Relation`, `Record locator`, `Attribute`, `Observed value`, `Source confidence`, `Source reference`).
  - **`✨ Fill Form Inputs` Button**: Automatically cycles and fills valid sample observations into the form inputs with one click so users never have to guess what to type.
  - **`🚀 Fill & Commit 1-Click` Button**: Populates the form fields and immediately commits the fragment into the database and provenance ledger in a single action.
- **Full Verification**:
  - `npm run test:frontend`: All 29 unit tests pass (100%).
  - End-to-end browser execution verified: Tested `Fill Form Inputs` and `Fill & Commit 1-Click`, verifying that input fields populate visibly and fragments commit into the active reconstruction graph.

## Evidence Intake Decluttering & Enterprise Light Theme Overhaul — 2026-10-23

Consolidated evidence intake into an intuitive, teacher-ready workflow and transitioned the UI from a dark aesthetic to a crisp, professional enterprise light theme:

- **Evidence Intake Decluttering (`frontend/src/App.tsx`)**:
  - Removed duplicate, confusing autofill toolbars (`AUTO-FILL INPUTS` strip and redundant header buttons).
  - Maintained **ONE** clear, easy-to-explain demo scenario loader at the top of Evidence Intake: **Pre-configured Forensic Scenarios** with a clean scenario dropdown, `⚡ 1-Click Auto-Load` (auto-creates case or populates empty case), and the standard `Load scenario` button.
  - Added a subtle, single `✨ Sample Row` button inside the manual intake form right next to `+ Commit fragment`, allowing single-click sample observation loading for manual demonstration without cluttering the UI.
  - Retained all accessibility attributes, labels, and tooltips, preserving 100% test compatibility.
- **Enterprise Light Theme System (`frontend/src/index.css`)**:
  - Transitioned the entire color palette to a crisp, high-contrast, modern engineering SaaS light theme (Supabase Light / GitHub / Linear / Stripe Dashboard).
  - Core design tokens:
    - Base canvas: `--bg: #f8fafc` (clean, soft slate white)
    - Card & panel surfaces: `--panel: #ffffff`, `--panel-strong: #f1f5f9`
    - High-legibility text hierarchy: `--text: #0f172a` (deep slate), `--muted: #475569` (medium slate)
    - Border lines: `--line: #e2e8f0` (refined subtle borders)
    - Brand accent: `--accent: #2563eb` (enterprise royal blue), `--accent-subtle: rgba(37, 99, 235, 0.08)`
  - Styled all workspace components for light mode: Topbar, Student identity pill (`Divyank Seervi (24BCE0793)`), Workspace sidebar, Evidence Intake cards, SQL Relational Tables, Provenance Ledger, Merkle Proof drawer, Forensic Report modal, and Admin Audit Trail.
- **Full Verification**:
  - `npm --prefix frontend run build`: Clean production build (0 TypeScript or bundler errors).
  - `npm run test:frontend`: All 29 Vitest tests pass (100%).
  - `npm run test:backend`: All 17 integration tests + 20 CSP/fuzzy tests + 9 engine benchmark scenarios pass (100%).
  - `npm run typecheck:backend`: 0 errors.
  - Live browser inspection verified via screenshot artifacts (`investigator_console_light_theme_1792763151094.png`, `active_case_relational_tables_1792763165852.png`).


## Enterprise SQL Data Grid Overhaul — 2026-10-23

Overhauled both the primary workspace and forensic report to present authentic, production-grade relational database grid tables:
- **Main Workspace SQL Data Grid (`frontend/src/App.tsx`)**:
  - Replaced legacy string-joined `record-row` text (`key: val · key: val`) with genuine `<table>` data grids (`.sql-data-grid`).
  - Rendered explicit attribute column headers (`<th>`) with column type indicators (`NUMBER`, `TEXT`) and unique constraint tags (`UQ`).
  - Added primary key `# Locator` monospace pill column (`#01`, `#02`, etc.) and `Materialized` integrity status badges per record.
  - Formatted missing fields with styled `<span className="null-tag">NULL</span>` badges.
  - Added dedicated relation header toolbars with record counts, column counts, and CSV/JSON export actions.
- **Forensic Investigation Report Tables (`frontend/src/ForensicReportModal.tsx` & `frontend/src/index.css`)**:
  - Fixed header text collision in `.dossier-audit-table` (`Sequence`, `Event Type`, `Envelope Hash`, `Payload Commitment`) with explicit column widths, generous padding (`10px 14px`), and container borders (`.dossier-table-container`).
  - Enclosed each relation in a dedicated `.dossier-table-container` with table header bar and column type badges.
  - Added monospace styling for cryptographic hashes and SHA-256 digests.

## Current state

LAZARUS-X is an academic forensic relational database reconstruction prototype. The active Prisma runtime targets SQLite. PostgreSQL DDL under `backend/db/init/01_advanced_features.sql` is a reference script only.

Verified locally:
- `npm run typecheck:backend` — 0 errors
- `npm --prefix frontend run build` — built cleanly, 0 errors
- `npm run lint:frontend` — 0 errors
- `npx vitest run` (frontend) — 4/4 test files, 29/29 tests passed (100%)
- `npm test` (backend) — all 12 test suites passed + all 9 scenario checks passed (`Scenario A` through `Scenario I`)
- `npm run test:intake` — smoke tests passed (immutability, SHA-256 verification, extension/symlink rejection)
- `npm run test:sqlite-analysis` — analyzer tests passed (read-only schema inspection, FK validation)
- `npm run dbms:demo` — all 7 DBMS requirements verified (11 tables, CRUD, joins, aggregates, views, triggers, transactions, EXPLAIN QUERY PLAN, copy/restore)
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

## UI Contrast Overhaul, Modal Backdrop Isolation & Verification — 2026-10-23

Resolved remaining visual defects and component container constraints:
- **Relational Data Grid Text Contrast**: Corrected cell value inline style in `frontend/src/App.tsx` from `#f1f5f9` (off-white, unreadable on white table backgrounds) to `#0f172a` (dark slate) and numbers to `#1d4ed8` (royal blue), with `#2563eb` primary key badges and `#64748b` null indicators. Table data across all relations (`Department`, `Employee`, `Order`, `Person`, etc.) is now crisp and legible.
- **Audit Logs Modal Backdrop & Centering**: Moved `<AuditLogsModal />`, `<ForensicReportModal />`, and `<SchemaStudio />` outside of the `<main className="workspace">` grid container in `frontend/src/App.tsx`. Updated `.modal-backdrop` and `.modal-box` in `frontend/src/index.css` so modals center as fixed overlays above the entire workspace.
- **Candidate Diff Matrix Light Theme**: Converted `.diff-matrix-container`, `.diff-matrix-table th/td`, `.cell-consensus`, `.dispute-card`, and `.val-text` from dark palettes to clean enterprise light styling with amber highlights for disputed attributes.
- **Schema DAG & Relationship Graph**: Converted `.schema-graph-container`, `.schema-table-card`, and foreign key edge tags to clean white cards with royal blue indicators.
- **Timeline Scrubber & Merkle Proof Inspector**: Converted scrubber backgrounds, search input, filter pills, and RFC 6962 Merkle proof cards to clean light backgrounds with high-contrast text.
## Final Submission Deliverables (DOCX & PDF) — 2026-10-23

Prepared and generated official submission documents in strict accordance with the instructions and rubric issued by Faculty **Dr. V. SIVAKUMAR** (SCOPE, VIT, Fall Semester 2026-27, BCSE302P: Database Systems Lab, Slot L25+L26, ClassNbr: VL2026270104025):
- **Official Header**: Features the complete VIT assessment table header, course details, faculty name, and dual-student team credentials:
  - **Divyank Seervi (24BCE0793)**: Lead Backend & Engine Architect
  - **Vidushi Negi (24BCE0786)**: Lead Relational Database & UI Architect
- **Instruction 2 Sequence Compliance**: Strictly preserves the three required steps:
  1. Given Problem Statement / Question
  2. Query / Source Code
  3. Input and Output / Screenshot with Timestamp
- **Instruction 7 Variable Binding**: Mandatory usage of student names and register numbers as variables (`divyank24BCE0793_`, `vidushi24BCE0786_`), method names, and console prints documented and verified.
- **Single Users Table Architecture (Faculty Mandatory Warning)**: Highlighted callout demonstrating compliance with the requirement: all users stored in a single `User` table with a `role` column (`INVESTIGATOR`, `ADMIN`).
- **All 10 Technical Sections & Rubric Split (30 Marks + 3 Bonus Marks)**:
  1. Problem Statement & Project Planning (2 Marks)
  2. Database Design & 3NF Proofs (4 Marks)
  3. Database Implementation, CRUD, Joins, Views, Triggers, Tx, Indexes (7 Marks)
  4. Application Development (4 Marks)
  5. Authentication, Authorization & Security (5 Marks)
  6. Professional Development Practices (5 Marks)
  7. Bonus Implementations: CI/CD, Custom Domain, Monitoring & Merkle Provenance (+3 Marks)
  8. Verification Screenshots with Timestamps (All 9 live system figures)
  9. Mandatory Code Listings with Student Variables
  10. Evaluation & Rubric Compliance Matrix
- **Rule 9 File Naming Strictness**:
  - `submission/24BCE0793_L25+L26_IA9&10_Proj_DIVYANK_SEERVI.docx` & `.pdf`
  - `submission/24BCE0786_L25+L26_IA9&10_Proj_VIDUSHI_NEGI.docx` & `.pdf`
  - `submission/24BCE0793_24BCE0786_L25+L26_IA9&10_Proj_DIVYANK_VIDUSHI.docx` & `.pdf`
  - `submission/LAZARUS-X_Final_DBMS_Project_Submission.docx` & `.pdf`
- **Native Word Conversion**: Automated conversion via `docx2pdf` produces pixel-perfect 1.24 MB PDF files matching the Word layout 1:1.

## Release validation

See `docs/FINAL_ENGINEERING_STATUS.md` and `docs/REQUIREMENTS_TRACEABILITY.md` for exact completed checks and unverified items. Keep all output claims consistent with the command output actually observed on the submission machine.

## What-if reconstruction lab and graph redesign — 2026-10-27

- Added authenticated `POST /api/cases/:id/simulate`; it uses the verified active/rehydrated engine and a temporary fork to preview one hypothetical observation. It returns before/after best states, ranked candidate summaries, counts, entropy, and propagation diagnostics. No case row, fragment, provenance event, or case head is written by simulation.
- Added the **Reconstruction what-if lab** to the investigator workspace. It previews current evidence-form inputs and displays a dedicated before/after comparison: candidate count, heuristic entropy, changed top-result fields, and post-preview violations. Preview results clear when switching cases.
- Refreshed the relational relationship graph styling with a brighter schema-aware canvas, colored table nodes, clearer relationship lines, a scrollable candidate map, and mobile-friendly layout.
- Added backend integration coverage verifying that a hypothetical run returns results and leaves persisted evidence and provenance sequence unchanged.
- Verification observed: backend test suite passed (18 security/API checks plus engine suites); frontend Vitest passed 29/29; `npm run typecheck:backend` passed; frontend production build passed (Vite emitted its existing >500 kB chunk advisory); artifact intake smoke tests passed; `git diff --check` passed.

## Standalone Reconstruction What-if Lab page — 2026-10-27

- Moved the what-if experiment UI out of the investigator workspace into `/what-if-lab?case=<case-id>`.
- Added **Open Reconstruction What-if Lab** beside the final data report link in the open-case workspace.
- The standalone page loads the case schema and current baseline, accepts a hypothetical table/record/field/value and confidence, and invokes the isolated `/simulate` endpoint. It renders the same before/after comparison, and explains that hypothetical runs do not alter evidence or provenance.
- Kept the main workspace focused on evidence intake, relationship review, and reconstruction; removed its embedded simulation panel and control.
- Verification after page move: frontend build passed and Vitest passed 29/29. Vite retains the existing large-chunk advisory.

## Complete-case comparisons and What-if Lab recovery — 2026-10-27

- Reworked the standalone What-if Lab so it opens with ready-made complete synthetic case pairs instead of a blank custom field form. The prior page required users to invent a value and offered no demonstrable case story.
- Added schema-matched complete pairs for government birth-register recovery, incident response, and workforce/orders. Each pair holds the rest of its evidence set constant and names its deliberate difference: date of birth, Person #1 name, or Order #1 amount.
- Added authenticated `POST /api/cases/:id/simulate-comparison`. It validates ownership and the saved case ledger, then independently reconstructs both supplied evidence sets under the case schema in fresh temporary engines. It returns each case's best result, candidate count, heuristic entropy, and diagnostics without persisting fragments or provenance.
- The page defaults to the complete pair matching the active case schema, displays both observation counts, the one fact that differs, and a side-by-side before/after result. Other schema pairs are visible but disabled. The custom what-if form remains available in a collapsed section.
- Added frontend fixture coverage asserting the paired evidence lengths match and only the declared field(s) for the single linked fact differ; added API coverage for temporary pair execution and non-persistence.
- Verification: backend typecheck passed; backend test suite passed with 19 security/API checks; frontend Vitest passed 30/30. Frontend build passed with the existing Vite large-chunk advisory; `git diff --check` passed.

## Standalone page navigation and report corrections — 2026-10-27

- Fixed the round-trip navigation issue: standalone report/lab return links now carry the selected case ID; the workspace validates the saved session through `GET /api/auth/session`, reloads the case list, and reopens the requested case after a full page navigation.
- Added cross-navigation between the results report and What-if Lab, so users can move between both views without losing the active case.
- Corrected report statuses so fields with no direct source observation are labeled **No source value**, conflicting sources are labeled **Sources disagree**, and unsupported values are not presented as supported. The summary conclusion now calls out fields lacking direct observations.
- Added page-level frontend tests for the results report, case/session restoration, and complete case-pair reconstruction; added API coverage for session restoration. Added a Playwright browser round trip covering report → workspace → What-if Lab → workspace.
- Verification: frontend tests 33/33; Playwright E2E 4/4; backend security/API checks 20 passed within the full backend test suite; backend typecheck passed; frontend build passed (existing Vite chunk-size advisory); artifact intake checks and `git diff --check` passed.

## What-if Lab 404 recovery — 2026-10-27

- Diagnosed the screenshot's `Request failed (404)`: port 3000 was served by an older `ts-node` backend process that predated `POST /api/cases/:id/simulate-comparison`.
- Restarted the backend from the current `backend/src/index.ts`; confirmed `/api/health` returns 200 and an unauthenticated POST to the comparison route returns 401, demonstrating the route is registered and authentication is enforced.
- Updated the What-if Lab to translate a 404 into a clear stale-server/restart message and a 401 into a sign-in-expired message instead of surfacing a generic status.
- Verification: frontend `npm run build` passed (existing Vite >500 kB chunk advisory); Playwright `npm run test:e2e` passed 4/4, including the standalone reconstruction/results navigation flow.

## Standalone page scrolling fix — 2026-10-27

- The global investigator-console rule `body { overflow: hidden }` prevented document scrolling on the standalone What-if Lab, results report, and Case Time Machine routes.
- Added a scoped `body:has(...)` override to restore vertical document scrolling for these standalone pages while retaining horizontal clipping.
- Verified in the running browser that the What-if Lab scrolls down to its before/after comparison and the results report scrolls through the full comparison table.
- Verification: frontend production build passed (existing Vite >500 kB chunk advisory); Playwright E2E passed 4/4; `git diff --check` passed.

## Standalone page scrolling reliability — 2026-10-27

- Made the What-if Lab and final results report explicit viewport-height scroll containers. Their wheel, touch, and trackpad scrolling no longer depend on document scrolling, which the main investigator console intentionally locks.
- Added browser-level checks to the standalone navigation flow that verify each page's scroll container can move to its bottom and back to the top.
- Verification: frontend production build passed (existing Vite >500 kB chunk advisory); Playwright E2E passed 4/4, including scroll movement checks for both standalone pages; git diff --check passed.


## Interdepartmental conflict verification page — 2026-10-27

- Added the standalone `/department-verification?case=<id>` page and navigation from the case workspace, results report, and What-if Lab. It lists only fields with multiple observed values, lets the investigator choose a simulated partner department, and displays the single requested field response alongside the competing source values.
- Added an authenticated, owner-scoped `POST /api/cases/:id/department-verifications` endpoint. It rechecks that the field is truly conflicted, queries a separate local synthetic directory, returns only the requested value plus source/version metadata, writes an AuditLog event, and does not update evidence, reconstruction state, or provenance.
- Added an isolated impact preview using the existing simulation endpoint, so the returned value can be evaluated before an investigator decides what to do.
- Prototype boundary: this is not connected to any government network. The synthetic fixture is scoped to the Anjali Kumari / Kolar demo (`Person[1].dateOfBirth` and `fullName`). The SHA-256 response digest is a content digest, not a department signature or proof of an official record.
- Verification: backend `npx tsc --noEmit` passed; full backend `npm test` passed, including 21 security/API tests; frontend build passed (existing Vite >500 kB chunk advisory); Vitest passed 34/34; Playwright E2E passed 4/4; `git diff --check` passed.

## Generalized imported-extract verification — 2026-10-28

- Replaced the fixed Kolar/Anjali synthetic lookup with a user-mapped imported-source workflow on `/department-verification?case=<id>`.
- CSV and JSON scalar datasets are parsed locally (2 MiB / 50,000 row / 100 column limits). The user maps a single-valued case key to a partner key and the disputed field to a partner field. The browser requires exactly one matching row and sends only the selected key, one scalar value, source metadata, and content SHA-256; full partner rows remain in the browser.
- The API verifies that the case has a current conflict and that the supplied key value exists as a single-valued field in accepted evidence. It audits the request and returns a one-field response plus digest receipt. Reconstruction impact stays a non-persistent `/simulate` preview.
- Limitation: this supports arbitrary user-provided extracts, but is not a live government connection. User-entered department labels and SHA-256 digests do not authenticate the source or prove official origin.
- Verification: backend TypeScript check passed; backend suite passed (21 security/API checks plus engine/scenario suites); frontend build passed (existing >500 kB chunk warning); Vitest passed 37/37; Playwright E2E passed 4/4; `git diff --check` passed.

## Department verification interaction fix — 2026-10-28

- Fixed the browser request contract: `partnerValue` is sent at the top level as required by the API; `matchKey` contains only the case field/value and partner column mapping.
- Added visible, 38-pixel input/file-picker controls with focus rings. The previously unstyled text and file inputs had collapsed to 15-pixel browser defaults, making the form appear unclickable.
- Expanded the standalone browser E2E to create an actual conflict, upload a CSV, link the case ID, receive the department check, and preview reconstruction impact.
- Verification: frontend build passed; Vitest 37/37; Playwright 4/4 (including the new complete verification flow); local browser confirmed text input focus and 38-pixel controls; API health UP; `git diff --check` passed.

## Synthetic department demo mode — 2026-10-28

- Added **Load synthetic demo** so the page can be demonstrated without a real department export. It builds a one-row source around the selected case's single-valued key and one already-observed disputed value, fills the department/mapping/source fields, fingerprints the row, and runs the same API validation and audit receipt path.
- The page labels the mode and source as synthetic classroom data; it makes no claim of official department confirmation. The check button now explains that it needs either the demo row or an imported CSV/JSON source.
- Ran the demo against the user's open synthetic Kolar case: one matching department row returned successfully, an audit receipt was shown, and isolated impact preview changed the selected DOB from 14-08-1998 to 18-08-1998 while preserving 4 interpretations and 0 fatal / 0 review violations. No evidence or provenance was committed.
- Verification: frontend production build passed (existing chunk warning); Vitest 38/38 including no-file demo checking; Playwright E2E 4/4 including CSV check and impact preview; local case demo check and simulation passed; API health UP; `git diff --check` passed.

## One-click Windows launcher — 2026-10-28

- Reworked root `start.bat` to check the supported Node.js range, initialize `backend/.env` from the template only when missing, generate a cryptographically random local provenance key only when the placeholder exists, install missing npm dependencies, build the frontend, validate/sync Prisma on fresh startup, launch the API in a minimized console, wait for `/api/health/ready`, then open the local app.
- If a ready local API is already serving the app, the launcher skips Prisma client regeneration (which can fail on Windows while the API's query-engine DLL is locked) and reuses the service. `LAZARUS_NO_BROWSER=1` supports a no-browser smoke run. Added README and friend quick-start instructions.
- Verification: ran both launcher paths. With the API already ready, it rebuilt the frontend, skipped Prisma regeneration, and exited cleanly. With the API stopped, it validated/synced Prisma, regenerated the client, launched the minimized API, and reached `READY`; the browser-suppression switch worked. No env file was overwritten. `git diff --check` passed.


## Evidence expiry and replacement lab — 2026-10-28

- Added a standalone `/evidence-lifecycle?case=<id>` page titled **The Record That Forgot**, linked from the case report and timeline. An investigator selects an accepted observation, simulates expiry or supplies a replacement value, and sees the baseline and isolated alternative reconstruction side by side.
- Added owner-scoped `POST /api/cases/:id/simulate-evidence-lifecycle`. It rehydrates and verifies the ledger when needed, runs a fresh engine from accepted evidence, and returns candidate count, heuristic entropy, selected field/value, and reconstruction summary. The preview does not commit evidence, provenance, or case state; the UI calls out that limitation.
- Added API and frontend unit coverage plus browser navigation/expiry/replacement flow.
- Verification: backend typecheck passed; backend suite passed including 22 security/API tests; frontend Vitest passed 39/39; Playwright E2E passed 4/4; production frontend build passed (existing >500 kB bundle advisory); `git diff --check` passed.

## Top-level source document locator — 2026-10-28

- Added `/document-locator` as a top-level authenticated page accessible from investigator/admin top bars and the sign-in landing screen; it does not require a reconstruction case or test scenario.
- Added persistent Prisma `SourceDocumentLocation` records and authenticated API endpoints to search, register, load clearly labeled synthetic examples, and update availability. Records include department, office, document/source reference, archive location, custodian, contact, retrieval notes, status, and last verification time. Access is owner-scoped, admin-readable, and writes are audit logged.
- Added “Find source document” links for each source reference in the final results table. The locator pre-fills the reference from the final database and displays matching department/office/storage details. A browser test covers registering a directory entry, following a final-report source link, and locating that entry.
- Applied the additive Prisma schema update to the local SQLite database with `prisma db push`.
- Verification: backend typecheck passed; full backend/frontend/artifact intake test command passed (23 API/security tests; 42 frontend tests); Playwright E2E passed 4/4; frontend build passed (existing >500 kB chunk advisory); `git diff --check` passed.

## Administrator operations and full project verification — 2026-10-28

- Reworked the administrator dashboard into an action-oriented control center. It now includes a searchable and status-filtered case queue with pagination; safe case metadata inspection; on-demand full provenance verification; audit-bundle export; audit-trail access; manual refresh; and live API/database readiness. PostgreSQL mode no longer offers a SQLite-native backup button and instead explains that managed Supabase backups are used.
- Added `GET /api/admin/cases`, restricted to ADMIN, with search/status filters, bounded pagination, owner metadata, and evidence/provenance/candidate counts. It never returns evidence values or candidate payloads. API tests cover unauthenticated and investigator denial plus admin search and metadata-only output.
- Added independent teacher-input engine fixtures for a custom Learner/Module/Assessment schema: competing teacher-supplied scores, child-before-parent evidence, unknown fields, invalid scalar types, and invalid foreign-key definitions. These run as part of `backend npm test`.
- Fixed the E2E harness to explicitly select its isolated temporary SQLite provider and URL. This prevents the host `.env` PostgreSQL provider from being mixed with the disposable SQLite URL.
- Fixed the admin case selection refresh loop so selecting a case does not refetch the queue repeatedly. The dashboard test asserts that Inspect and Verify history do not trigger extra queue requests.
- Applied compatible transitive dependency updates for `body-parser`, `qs`, and `undici`; backend runtime and frontend npm audits now report zero vulnerabilities. Framework/ORM versions were not changed.
- Verification passed: `npm run test:all` (backend suites including 4 new teacher-input tests; frontend Vitest 43/43; artifact intake; SQLite analyzer; Playwright 4/4), backend TypeScript check, Prisma SQLite and Supabase schema validation, frontend production build, frontend lint (with existing warnings), engine load check, API concurrency/provenance load check, and the 11-table isolated DBMS feature demonstration.
- Docker Desktop was invoked from its installed CLI path. The Supabase Docker image rebuilt and is running healthy on port 3000. `/api/health/ready` returned READY with database UP. The in-container Supabase smoke test passed the evidence audit trigger, sealed-case guard, activity view, and RLS verification for all 12 application tables. Smoke rows were removed afterward.
- Remaining build advisory: Vite reports the application JS chunk is larger than 500 kB. Lint also reports existing React hook/state and optional-chaining warnings outside the focused admin changes; lint exits successfully.
