# LAZARUS-X Quick Start

## Local run

1. Install Node.js 20+ and npm.
2. Copy `backend/.env.example` to `backend/.env`.
3. Generate a fresh key with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and set `PROVENANCE_ENCRYPTION_KEY` in that file.
4. From the repository root run `npm run install:all`, then `npm start`.
5. Open `http://localhost:3000` and register an investigator account.

## Administrator account

There are no default or shared admin credentials. After database initialization, set `LAZARUS_ADMIN_EMAIL` and `LAZARUS_ADMIN_PASSWORD` in the shell and run `npm run admin:provision` from the `backend` directory. Use a unique password; the command promotes or rotates the selected account and revokes its previous sessions.

## Evidence and provenance

Create a case, submit scalar evidence, inspect candidate comparisons, and use the provenance/audit panels to review the chain and Merkle proofs. For a local artifact manifest, run `node scripts/ingest_artifact.js <artifact.db> <manifest-dir>`, then verify it later with `node scripts/verify_artifact_manifest.js <artifact.db> <manifest.json>`. This intake utility hashes bytes only; it does not parse deleted rows or establish legal admissibility.

## Before claiming it is ready

Run `npm run validate:db`, `npm run typecheck:backend`, `npm test`, `npm run build:frontend`, and the SQLite backup/restore drill. Docker/cloud deployment, a live URL, domain, and GitHub requirements must be configured and checked in the actual external accounts.
