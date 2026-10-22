# LAZARUS-X Architecture Specification

## Component Dependency
1. **Frontend (Engineering Workbench):** Next.js with React and Tailwind (derived from `shadcndashboard` template). Provides case management, artifact upload, visualization of competing Candidate States, and Ambiguity Resolution dashboards.
2. **Backend (API & Reconstruction Engine):** Express.js (Node.js) / TypeScript.
   - **Artifact Ingestion Layer:** Uses `xsqlite` logic to parse raw uploaded binary fragments.
   - **Incremental Recomputation Engine (Proprietary):** The core algorithm that maintains multiple Candidate States logically.
3. **Database:** PostgreSQL.
   - Uses Prisma ORM for standard CRUD and case management.
   - Uses Raw SQL / Stored Procedures for the computationally intensive Ambiguity Reduction logic and Incremental Recomputation over the Candidate States.

## Data Flow
1. **Ingestion:** Investigator uploads a corrupted `.sqlite` and `.wal` file.
2. **Parsing:** Ingestion Layer extracts `ExtractedRecords` (raw rows) and inserts them into PostgreSQL.
3. **Candidate Generation:** The core engine reads the target schema constraints and creates initial `CandidateStates`.
4. **Repair Synthesis:** Constraints synthesize `InferredRecords` to fix conflicts.
5. **Recomputation:** When new evidence is found, the engine incrementally drops or upgrades `CandidateStates` via a PostgreSQL Stored Procedure.
6. **Ambiguity Reduction:** If multiple states are valid, the engine ranks missing data by information gain and generates `EvidenceRequests` for the investigator.
