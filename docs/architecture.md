# LAZARUS-X Runtime Architecture

## System boundaries

1. **Frontend:** React 19 + Vite dashboard. It handles sign-in/registration, case navigation, candidate comparisons, the schema graph, timeline, audit and provenance verification panels.
2. **API:** Express 5 / TypeScript. It validates requests, applies authentication/authorization and rate limits, and calls the data layer and reconstruction engine.
3. **Relational persistence:** SQLite through Prisma 5.11. The checked-in schema uses a SQLite provider; it is not PostgreSQL-ready by switching a URL.
4. **Reconstruction engine:** Bounded candidate hypothesis search and constraint propagation are implemented in `backend/src/engine/`. Results are hypotheses, not proof that a candidate is the historical truth.
5. **Provenance:** `backend/src/engine/provenance.ts` contains chained commitments, envelope/Merkle logic, verification routines and checkpoint support. Integrity verification is not a legal admissibility certification.
6. **Operations:** `/api/health` is liveness, `/api/health/ready` verifies the database, `/metrics` exposes Prometheus text metrics, and native SQLite scripts provide backup/restore workflows.
7. **Artifact analysis tools:** `scripts/ingest_artifact.js` and `scripts/verify_artifact_manifest.js` create/check read-only SHA-256 manifests. `scripts/analyze_sqlite.py` inspects current SQLite schema, column/foreign-key metadata and row counts without exporting record values. These standalone tools are not wired as a web upload parser and do not carve deleted records.

## Data flow

1. An investigator registers or signs in; newly registered users receive the `INVESTIGATOR` role.
2. An operator creates or rotates an administrator account using `backend/src/provision_admin.ts` and environment variables, rather than relying on a default web credential.
3. The investigator creates a case in Schema Studio. The validated target schema is persisted in `ReconstructionCase.schemaDefinition`; this is engine metadata, not dynamic physical DDL.
4. The investigator submits typed scalar observations manually or imports a CSV batch capped at 250 fragments. Source labels and optional digest strings are retained in the event payload.
5. The engine evaluates observations against declared constraints, materializes bounded candidate hypotheses, and recommends the next distinguishing observation using normalized heuristic weights and expected information gain.
6. Provenance entries are committed with the evidence transaction and can be inspected/exported through the API and UI.
6. Case sealing is implemented using application-level transaction logic and API guards. SQLite has no native stored-procedure language; the PostgreSQL SQL file is an optional reference script and is not applied by the SQLite runtime.

## Product truth and operational caveats

- SQLite is a single-writer database and the current rate limiter/engine caches/case locks are process-local. Multi-instance deployment needs an architectural review, shared rate limiting/coordination, and a tested database migration before horizontal scaling.
- Keep `PROVENANCE_ENCRYPTION_KEY` stable for the lifetime of encrypted case salts and back it up securely. Losing it can make encrypted provenance-salt values unreadable; rotating it requires the provided rotation workflow and a verified backup.
- Retain original forensic artifacts read-only. The manifest CLI records a digest but does not validate file contents or prove where an artifact originated. `sourceSha256` is a typed reference, not a server-verified link to an opened file. The SQLite inspector reports the live database view; deleted-row recovery and WAL/journal reconstruction are not implemented. Candidate weights are heuristics, not calibrated probabilities.
- Production deployment requires HTTPS, valid CORS origins, a secure operator-managed key, actual health checks, and a tested restore procedure.
