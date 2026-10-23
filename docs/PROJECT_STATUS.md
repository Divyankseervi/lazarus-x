# Project Status: LAZARUS-X

- **Project:** Forensic relational database reconstruction and cryptographic provenance prototype
- **System:** LAZARUS-X Relational Forensics
- **Runtime database:** SQLite via Prisma 5.11
- **Backend:** Express / TypeScript
- **Frontend:** React / Vite
- **Authentication:** One `User` model with role-based authorization and hashed passwords
- **Core research components:** constraint-based reconstruction, candidate ranking, provenance hash chain, Merkle inclusion proofs, audit export

## Core idea and scope

The working theory is constraint-guided candidate reconstruction from analyst-supplied partial scalar observations, under a known target schema. A case-specific schema is persisted in validated JSON; the solver compares candidate states and recommends the next observation. It does not recover deleted rows from raw pages/WAL/journals or establish historical truth. See `CORE_IDEA_REALIGNMENT.md`.

## Verification status

Do not treat this file as proof that all rubric items or deployment gates have passed. See `docs/ENGINEERING_AUDIT_2026-10-22.md` for identified configuration risks and the commands required to verify the current checkout. A complete clean install, test run, browser test, backup/restore drill, and live deployment check remain required before claiming production readiness.

## Known deployment constraint

The committed Prisma schema uses SQLite. PostgreSQL requires an explicit Prisma provider/schema migration and corresponding integration tests; changing only the connection string is insufficient.
