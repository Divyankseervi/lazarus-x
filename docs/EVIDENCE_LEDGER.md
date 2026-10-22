# LAZARUS-X: Evidence Ledger

| Claim Evaluated | Implementation Location | Verification Method | Command Executed | Observed Result | Limitations | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Prisma Schema has 10 Tables** | `backend/prisma/schema.prisma` | Code Audit | `Get-Content` / Inspection | 10 tables exist (User, Session, Case, etc.) | Schema is SQLite-bound | Verified |
| **Authentication Flow Works** | `backend/src/index.ts` | Integration Script | `node test_flow.js` | Tokens generated, passwords hashed, protected routes enforced | Does not test frontend UI auth | Partially Verified |
| **Top-K Pruning destroys Truth** | `backend/src/engine/benchmark.ts` | Ablation Benchmark | `npx ts-node benchmark.ts` | Ground Truth Survival Rate drops below 100% under 30% corruption | Synthetic dataset size was limited | Verified |
| **Frontend is Premium/Modern** | `backend/public/index.html` | Visual Code Audit | None | Exists as a single HTML file with inline CSS. Not a modern framework architecture. | Highly inadequate for a premium product | FAILED |
| **Candidate Management** | `backend/src/engine/lazarus.ts` | Code Audit | None | Soft-bounded delayed pruning implemented, but explicit partial-state uncertainty is missing. | Prone to combinatoral explosion | Partially Verified |
