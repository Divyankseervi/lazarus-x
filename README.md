# LAZARUS-X
### Forensic Relational Database Reconstruction & Cryptographic Provenance Platform

> **Vellore Institute of Technology (VIT) · School of Computer Science and Engineering (SCOPE)**  
> **Course:** BCSE302P — Database Systems Lab · **Slot:** L25+L26 · **Class Nbr:** VL2026270104025  
> **Faculty Evaluator:** Dr. V. SIVAKUMAR  
> **Semester:** Fall Semester 2026-27  

| Student Investigator | Register Number | Role & Responsibilities | GitHub Profile |
| :--- | :--- | :--- | :--- |
| **Divyank Seervi** | `24BCE0793` | Lead Backend & Engine Architect (AC-3 Solver, Merkle Ledger, Triggers, Render) | [@Divyankseervi](https://github.com/Divyankseervi) |
| **Vidushi Negi** | `24BCE0786` | Lead Relational Database & UI Architect (11-Table 3NF Schema, Data Dictionary, React UI) | Contributor |

**Live Deployment URL:** [https://lazarus-x-forensic.onrender.com](https://lazarus-x-forensic.onrender.com)  
**Repository:** [https://github.com/Divyankseervi/lazarus-x](https://github.com/Divyankseervi/lazarus-x) (`main` & `dev` branches)  
**CI/CD Pipeline:** [GitHub Actions Workflow](https://github.com/Divyankseervi/lazarus-x/actions)

---

LAZARUS-X is an enterprise-grade forensic relational database recovery platform designed for investigation of fragmented, out-of-order, or tampered transaction logs. It combines an incremental Arc-Consistency (AC-3) constraint propagation solver, bounded multi-hypothesis state space, Shannon entropy ambiguity reduction, an immutable dual-layer cryptographic ledger anchored by RFC 6962 binary Merkle inclusion proofs, and an interactive executive light UI.

## Core capabilities

- **Reconstruction engine:** bounded candidate-state search, constraint propagation, uniqueness/foreign-key checks, delayed handling of unresolved references, and fuzzy value comparison.
- **Ambiguity reduction:** normalized heuristic candidate weights, entropy estimates, and expected-information-gain suggestions for additional evidence. These are decision-support scores, not calibrated probabilities of historical truth.
- **Tamper-evident provenance:** per-case chained hashes, keyed commitments, Merkle-tree checkpoints and inclusion proofs, audit export, and case sealing.
- **Schema-first case workbench:** each case stores a validated target schema; create cases in Schema Studio, submit typed scalar observations manually or import validated CSV batches, inspect ranked candidate hypotheses and their conflicts, then use entropy-guided next-observation suggestions. The synthetic walkthrough submits explicitly labelled synthetic evidence rather than prefilling a disconnected demo form.
- **Relational application:** Prisma ORM and SQLite, role-aware API authorization, hashed session tokens, password hashing, rate limits and request-size limits.
- **Operations:** liveness/readiness endpoints, Prometheus-format metrics, Docker packaging, GitHub Actions checks, and native SQLite backup/restore utilities.
- **Read-only artifact handling:** computes/verifies SHA-256 manifests for supported SQLite-related files and inspects SQLite schema, columns, foreign keys, row counts, and optional integrity status without exporting row values. These tools are separate from the reconstruction solver; neither tool recovers deleted rows or proves original provenance.

## Core workflow and limitations

Read [`docs/CORE_IDEA_REALIGNMENT.md`](docs/CORE_IDEA_REALIGNMENT.md) before presenting the project. The core problem is hypothesis reconstruction from incomplete, potentially out-of-order field observations under a declared relational schema. The dashboard flow is: **define schema → submit observations → compare surviving hypotheses → collect the next discriminating observation → verify provenance**. The engine does not infer a schema from raw bytes or perform deleted-row/WAL recovery. Custom target relation states are reconstructed in memory and their schema is stored with the case; they are not materialized as newly created physical SQLite tables.

Candidate percentages and source confidence are heuristic decision-support values, not calibrated probabilities of historical truth. Optional source hashes are investigator-supplied metadata; verify them against a separately generated artifact manifest if needed.

## Technology stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 LTS (or 22.12+) and TypeScript |
| API | Express 5 |
| Database / ORM | SQLite and Prisma 5.11 |
| Frontend | React 19, Vite, TypeScript |
| Tests | Node assertions, backend test scripts, Vitest, Playwright configuration |
| Delivery | Docker / Docker Compose / GitHub Actions |

**Database scope:** the checked-in Prisma schema and runtime URL resolver target SQLite. PostgreSQL is not enabled by changing `DATABASE_URL`; that requires a deliberate provider/schema migration, regenerated client, provider-specific migrations, and integration tests. SQLite does not implement native stored procedures. Case sealing uses application-level transactional logic; SQL views and triggers are demonstrated where supported by the target engine.

## Quick start (Windows PowerShell)

1. Install Node.js 24 LTS (recommended) or Node.js 22.12+ and Git. Node.js 20 reached end of life in April 2026; the current Vite toolchain also needs a newer Node release.
2. Copy `backend/.env.example` to `backend/.env`.
3. Generate a new random key:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Paste the 64-character result into `PROVENANCE_ENCRYPTION_KEY` in `backend/.env`. Never use a public/example key or commit `.env`.
4. From the repository root, install dependencies:

   ```powershell
   npm run install:all
   ```

5. Build, validate and test:

   ```powershell
   npm run validate:db
   npm run typecheck:backend
   npm run build:frontend
   npm test
   ```

6. Start the app:

   ```powershell
   npm start
   ```

Open `http://localhost:3000`. The start command builds the frontend, applies the Prisma schema to the configured local SQLite file, and starts the API. Register an investigator account in the UI.

The authentication entry points are separated by role:

- `http://localhost:3000/investigator-login` — investigator registration and login.
- `http://localhost:3000/admin-login` — administrator login for an operator-provisioned account.

Both portals use the same `User` table and backend session endpoint. The selected portal must match the authenticated role; public registration cannot create an administrator.

After authentication the roles receive separate dashboards:

- **Investigator dashboard:** create and search owned reconstruction cases, define schemas, submit/import evidence, compare bounded hypotheses, inspect entropy guidance, verify provenance, export reports, and seal cases.
- **Administrator dashboard:** view platform-wide metrics, inspect cross-user audit logs, generate native SQLite backups, and monitor privileged operations. It does not expose investigator evidence-entry controls.

The dashboard separation is a user-interface boundary; every privileged operation is also enforced by backend role middleware.

## Create or rotate an administrator account

Admin accounts are not seeded with shared credentials. Provision one explicitly after creating the local database. In PowerShell, from the repository root:

```powershell
$env:LAZARUS_ADMIN_EMAIL = "your-admin-email@example.com"
$env:LAZARUS_ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
cd backend
npm run admin:provision
Remove-Item Env:LAZARUS_ADMIN_EMAIL
Remove-Item Env:LAZARUS_ADMIN_PASSWORD
```

Use a unique password. Provisioning an existing email changes it to `ADMIN`, rotates its password, and revokes that user's sessions. Keep the password out of shell history where practical.

## Docker

Copy the root `.env.example` to `.env`, set a fresh `PROVENANCE_ENCRYPTION_KEY`, and run:

```bash
docker compose config
docker compose build
docker compose up
```

The Compose application uses persistent SQLite storage. Backups created by the Admin dashboard are mounted to a separate named volume at `/app/backups`. Docker Hub publishing and cloud deployment require your own repository/account settings and CI secrets; this source archive does not imply that a live deployment already exists.

### Provision the first Docker administrator

Registration creates an `INVESTIGATOR`, not an administrator. After `docker compose up -d`, provision the administrator explicitly from PowerShell:

```powershell
$env:LAZARUS_ADMIN_EMAIL = "your-admin-email@example.com"
$env:LAZARUS_ADMIN_PASSWORD = "use-a-unique-password-of-at-least-12-characters"
docker compose exec -e LAZARUS_ADMIN_EMAIL -e LAZARUS_ADMIN_PASSWORD app node dist/provision_admin.js
Remove-Item Env:LAZARUS_ADMIN_EMAIL
Remove-Item Env:LAZARUS_ADMIN_PASSWORD
```

Use a unique password and never store it in `.env`, Git, or screenshots. The command can create or rotate the named admin account and revoke sessions issued under its previous account state. Keep database and backup volumes protected; an online backup stored in the container volume is not an off-site disaster-recovery plan.

## Health, metrics and operational checks

- `GET /api/health` — liveness (process is running).
- `GET /api/health/ready` — readiness (database query succeeds; returns HTTP 503 when unavailable).
- `GET /api/info` — product/runtime metadata.
- `GET /metrics` — Prometheus text exposition. In production, metrics return 404 unless `METRICS_TOKEN` is configured to a secret of at least 32 characters and supplied as `Authorization: Bearer <token>`. Do not expose this secret in client code.

## Read-only artifact intake and verification

This command accepts `.db`, `.sqlite`, `.sqlite3`, `.db3`, `.wal`, `.shm`, and `.journal` extensions, rejects symbolic links and files larger than 2 GiB, hashes via a read-only file descriptor, and fails if source metadata changes during hashing. It writes a digest-addressed JSON manifest. The extension check does **not** validate the contents as a SQLite artifact.

```bash
node scripts/ingest_artifact.js ./sample.db ./evidence-manifests
node scripts/verify_artifact_manifest.js ./sample.db ./evidence-manifests/<sha256>.manifest.json
npm run test:intake
```

The manifest intentionally records the artifact name and metadata, not the machine's full source path, to reduce accidental path disclosure. Treat manifests as sensitive evidence records and preserve them with appropriate access controls. A digest proves only that the bytes match the manifest at verification time. It does not establish who collected the file or whether the source itself was already tampered with.

### Read-only SQLite structure analysis

The Python standard-library analyzer reports the schema SQL, column metadata, declared foreign keys, and row counts for a SQLite database. It does not output record values and opens the source in SQLite read-only/query-only mode. An optional full `PRAGMA integrity_check` may take time on large files. Python 3 is required for this extra utility.

```bash
python scripts/analyze_sqlite.py ./sample.db --integrity-check --output ./evidence-manifests/sample-analysis.json
python scripts/test_analyze_sqlite.py
```

The analysis describes rows visible to SQLite at analysis time. It is not a page-carver, WAL/journal reconstruction engine, or substitute for preserving related `-wal` / `-journal` files.

## SQLite backup and restore

CI includes a native SQLite backup → restore → integrity/data verification drill. This is a repeatable test, not a substitute for restoring a real deployment backup before using it for recovery.

Requires the SQLite command-line utility (`sqlite3`). On Linux/macOS:

```bash
bash scripts/backup_database.sh ./backups
bash scripts/restore_database.sh ./backups/lazarus_sqlite_TIMESTAMP.db ./restore-test.db
```

On Windows, use `scripts/backup_database.bat` (requires `sqlite3.exe` on `PATH`). Restore verifies SQLite integrity and refuses to overwrite an existing target unless `--force` is explicitly supplied. Practice against a disposable destination before relying on a backup. An `integrity_check` does not prove that application-level recovery succeeded; inspect record counts and run application tests after restore.

## Verification workflow

```bash
npm run validate:db
npm run typecheck:backend
npm run test:security
npm test
npm run build:frontend
npm run dbms:demo
npm run test:intake
python scripts/test_analyze_sqlite.py
npm run test:e2e
npm run test:all
bash -n scripts/backup_database.sh scripts/restore_database.sh
```

Run these commands on the machine/environment intended for submission. The archive's status report records which checks ran in the packaging environment and which remain unverified. Do not mark a check as passed unless you have the actual successful output.

## Database design and assessment materials

- `docs/ER_diagram.md` — entity relationships and relational schema.
- `docs/data_dictionary.md` — tables/columns and interpretation.
- `docs/architecture.md` — current runtime architecture.
- `docs/REQUIREMENTS_TRACEABILITY.md` — assessment rubric mapping and verification status.
- `docs/TECHNICAL_SPECIFICATION_REPORT.md` — technical architecture and benchmark specification report.
- `docs/ENGINEERING_AUDIT_2026-10-22.md`, `docs/FINAL_ENGINEERING_STATUS.md`, and `docs/RELEASE_VERIFICATION.md` — engineering review, release scope, and explicit verification status.
- `research/` — background research and technical disclosure drafts. No patent filing or grant is claimed.

## Open-source research references

These are design/research references, not dependencies claimed as integrated into the codebase:

- [Netherlands Forensic Institute — xsqlite](https://github.com/NetherlandsForensicInstitute/xsqlite): SQLite forensic analysis and deleted-record recovery concepts.
- [FQLite](https://github.com/pawlaszczyk/fqlite): open-source SQLite forensic toolkit and recovery workflows.
- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html): secure Node.js application guidance.
- [Express production security guidance](https://expressjs.com/advanced/best-practice-security/): TLS, brute-force protection and dependency security.

The artifact intake CLI is not a replacement for the low-level recovery capabilities in xsqlite or FQLite. It only computes and verifies integrity manifests.

## Deployment & Operations

LAZARUS-X is built for containerized and on-premise relational reconstruction workflows. Production deployment guidelines and container specifications are detailed in `Dockerfile` and `docker-compose.yml`.

## Intellectual-property note

The `research/` patent-style specification files and in-app research disclosure are **draft technical research material only**. No patent application number, filing, grant, legal review or freedom-to-operate opinion is represented by this repository.

## License

MIT. See `LICENSE` and `THIRD_PARTY_NOTICES.md`.
