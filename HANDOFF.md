# LAZARUS-X Developer Handoff

## Review pass — 2026-10-23 (Comprehensive University DOCX Submission & Whole Browser Screenshots)

- **Reference Alignment with Sahib Singh Submission (`24BCI0292_L25+L26_IA9&10_Proj_SAHIB_SINGH.docx`)**:
  - Implemented formal VIT & SCOPE academic cover header block.
  - Table 1 (9x2): Course & Assessment metadata table (Title, Course Code, Class Nbr `VL2026270104025`, Slot `L25+L26`, Faculty `Dr. V. SIVAKUMAR`).
  - Table 2 (3x4): Student Details table with dual attribution for Divyank Seervi (`24BCE0793`) and Vidushi Negi (`24BCE0786`).
  - Section 4 per-query tabular outputs: Every database operation (Queries 1-7: SELECT, INSERT, UPDATE, DELETE, Multi-Table JOIN, Aggregates, Correlated Subquery) now includes both a 1x1 Code Block Table and an immediate Tabular Result Grid displaying exact returned database columns and rows.
  - Declarative Integrity Constraint Testing Matrix: 3-column table (`[Integrity Test Case | Invalid SQL / Action | Database Engine Error Response]`).
  - Database Transactions with COMMIT & ROLLBACK: Test A (COMMIT with atomic row insertion) and Test B (ROLLBACK intercepting FK violation and verifying `records_retained = 0`).
  - Student Plagiarism & Registration Number Verification (Instruction 7): Explicit SQL query inserting and printing student registration numbers (`24BCE0793` & `24BCE0786`) with result table.
- **Whole Browser Window Screenshots**:
  - Captured full 1904x985 viewport screenshots via browser subagent without any artificial blue borders, embedded in Section 10 at 6.5" width:
    - Figure 1: Forensic Dashboard & Evidence Intake Console (`01_full_browser_dashboard_and_evidence_intake.png`)
    - Figure 2: Materialized Relational SQL Tables (`02_full_browser_materialized_relational_tables.png`)
    - Figure 3: Relational Schema DAG & Foreign Key Topology (`03_full_browser_schema_dag_foreign_keys.png`)
    - Figure 4: Cryptographic Provenance Ledger & Merkle Root Chain (`04_full_browser_cryptographic_provenance_ledger.png`)
    - Figure 5: Administrative Audit Trail Modal (`05_full_browser_admin_audit_trail_modal.png`)
    - Figure 6: Certified Forensic Case Dossier Modal (`06_full_browser_forensic_case_dossier_modal.png`)
- **Primary Deliverables**:
  - Generated `submission/24BCE0793_L25+L26_IA9&10_Proj_DIVYANK_SEERVI.docx` (1,292,400 bytes, 38 tables, 150 paragraphs).
  - Also generated dual-attribution `24BCE0793_24BCE0786_L25+L26_IA9&10_Proj_DIVYANK_VIDUSHI.docx` and matching PDF copies.
- **Git & Build Hygiene**:
  - Committed and pushed to `main` and `dev` on `https://github.com/Divyankseervi/lazarus-x.git`.
  - All test suites pass: `npm run validate:db`, `npm run typecheck:backend`, `npm run test:backend` (71+ assertions).

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


