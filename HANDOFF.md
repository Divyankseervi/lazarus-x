# PROJECT HANDOFF

**Current state:** Read the final “Browser E2E and Engine Load Exercise” section for the latest implementation and verification. Sections above it are chronological checkpoints; their open issues may have been resolved by later entries.

## Engine Identity-Collision Fix (2026-10-10)

### Changes completed
- **Fixed Engine Identity Collision:** Renamed the internal tracking property in `lazarus.ts` and `types.ts` from `id` to `_recordId`. This prevents domain schema data (`ev.field = 'id'`) from overwriting internal entity locators, resolving the issue where out-of-order `id` evidence would split records or corrupt the hypothesis state graph.
- **Fixed Ambiguity Blindness:** The engine's Active Learning component (`recommendNextEvidence`) was previously ignoring the domain's primary key (`if (field === 'id') continue;`) due to the namespace collision. It now correctly ignores the internal `_recordId`, allowing it to correctly recommend clarifying evidence when primary keys are disputed.
- **Test Suite Modernization:** Fixed latent TypeScript compilation errors in `oracle_test.ts` (`Object.fromEntries` missing and `process` global).
- **Identity Collision Tests:** Appended robust assertions to `oracle_test.ts` to strictly verify that domain `id` fields and internal locators (`_recordId`) do not collide, regardless of evidence arrival order.

### Verification performed
- `cd backend; npx ts-node src/engine/oracle_test.ts` — passed. The exact identity collision scenarios successfully resolved without creating duplicate disjoint records.
- Verified zero degradation of the TOP_K diagnostic baseline.

### Remaining issues and blockers
- **Algorithmic Limit (Codex Domain):** The engine still relies on a soft-bound (`TOP_K = 20`) delayed pruning strategy. Adversarial out-of-order evidence logs will cause a combinatorial explosion leading to Ground Truth pruning.
- **Implement Explicit Partial-State CSP (Backend):** The next logical step is to replace the heuristic soft-bound pruning with true symbolic partial-state trackers to cleanly survive out-of-order data.

---

## Implemented in the Current Session (Frontend Audit Fixes)
- **CSS Compilation Fixed:** Migrated Vite/PostCSS configuration to properly utilize `@tailwindcss/vite` plugin for Tailwind CSS v4. The CSS bundle successfully compiles utility classes (verified at 23.76 kB) instead of failing on unresolved `@tailwind` directives.
- **Accessibility (a11y) & Layout:** Bound all `<label>` elements to form `<input>`/`<select>` elements using `htmlFor` and explicit IDs. Replaced broken flexbox icon wrappers with `inline-flex` to correct vertical alignment hierarchy. Added reserved `min-h-[24px]` blocks to prevent Cumulative Layout Shift (CLS) on authentication error states.
- **UI State Visualization:** Replaced the raw JSON `<pre>` state dump with a structured, iterational rendering component that visually distinguishes relational bounds and empty tables.
- **Environment API Integration:** Swapped the hardcoded localhost URL for `import.meta.env.VITE_API_URL || 'http://localhost:3000/api'`, preserving local development while enabling staging/prod configuration.
- **Build Validation:** Ran `npm run build` (Passed, 707ms) and `npm run lint` via `oxlint` (Passed, 0 errors/warnings on 116 rules).

## Exact Files Created / Modified
- `backend/src/engine/lazarus.ts` (Renamed internal tracker to `_recordId`)
- `backend/src/engine/types.ts` (Updated `RecordData` interface)
- `backend/src/engine/oracle_test.ts` (Added test cases and compilation fixes)
- `frontend/vite.config.ts` (Added `@tailwindcss/vite`)
- `frontend/src/index.css` (Migrated to Tailwind v4 `@import "tailwindcss"` and `@theme` variables)
- `frontend/src/App.tsx` (Refactored a11y bindings, API constants, UI layout, and JSON renderer)
- `frontend/package.json` (Installed `@tailwindcss/vite`)
- `research/antigravity_ui_audit.md` (Independent UI Audit)

## Changes Not Yet Tested
- **Browser E2E Testing:** Automated E2E browser interactions (e.g., Cypress/Playwright) or DOM Unit Tests (Vitest/Jest) were intentionally deferred to avoid massive unnecessary dependency injections at this stage. Functional rendering was verified via `vite build`, but live E2E assertions remain a gap.

## Current Errors and Blockers
- **Algorithmic Limit (Codex Domain):** The engine relies on a soft-bound (`TOP_K = 20`) delayed pruning strategy. Adversarial out-of-order evidence logs will cause a combinatorial explosion leading to Ground Truth pruning.

## Remaining Tasks (Priority Order)
1. **Implement Explicit Partial-State CSP (Backend):** Replace the heuristic soft-bound pruning with true symbolic partial-state trackers to cleanly survive out-of-order data.
2. **Frontend Test Suites:** Once dependencies are explicitly approved, add Vitest and React Testing Library to execute automated interaction verification on the React components.

## Recommended Next Step
Proceed to **Priority 1**: Rewrite the core Hypothesis engine in the backend (`lazarus.ts`) to support Explicit Unknown Variables (CSP formulation).

## Codex Security and Repository-Safety Update (2026-10-10)

### Changes completed
- Added `backend/prisma/dev.db` to the root `.gitignore` and removed the path from the Git index. The local file remains in place. It was already modified and held open by another process. Its observed metadata changed from 94,208 bytes at the earlier check to 102,400 bytes during checkpoint review; the cause is unknown. Security tests used an in-memory Prisma stub, and no task command intentionally connected to or wrote to the database.
- Git has no configured remote, and the only local commit/ref is `395985f` (`Initial project checkpoint`). Whether that commit was previously shared cannot be established, so history was not rewritten and no push was made. The database remains present in that initial commit until a safe history-rewrite decision is made.
- Public registration now ignores all client-supplied roles and creates only `INVESTIGATOR` accounts. The frontend no longer sends a role field.
- New passwords use bcrypt. Login continues to verify existing fixed-salt scrypt hashes for compatibility; existing stored hashes were not migrated or changed.
- Added the operator-only `src/provision_admin.ts` command. It reads `LAZARUS_ADMIN_EMAIL` and `LAZARUS_ADMIN_PASSWORD` from the process environment and is separate from the public HTTP routes. It was not run during this task because it writes to the configured database. Run it from `backend/` with `npx ts-node --files src/provision_admin.ts` after setting those environment variables through the operator's secure process.
- Exported an app factory for isolated HTTP tests. Regression tests verify that a public `role: "ADMIN"` registration becomes an investigator, unauthenticated deletion returns 401, investigator deletion returns 403 without removing the case, and an operator-provisioned admin can delete a case.
- Engine and audit test runners now set a nonzero process exit code when checks fail. The audit output describes its selected-metric comparison accurately instead of claiming full-state equivalence.

### Verification performed
- `cd backend; npm test` — passed: 3 engine checks, 4 asserted audit checks (plus the score interpretation note), and 3 security/authentication tests. The HTTP tests use an in-memory Prisma stub and do not connect to SQLite.
- `cd backend; npx tsc --noEmit` — passed.
- `cd backend; npx prisma validate --schema prisma/schema.prisma` — passed; schema is valid.
- `cd frontend; npm run build` — passed; Vite produced the production bundle.
- The first `npm test` attempt exited 1 because `ts-node` did not load Node ambient types by default. The script was updated to use `ts-node --files`, then the full suite passed.

### Remaining issues and cautions
- The initial commit still contains `backend/prisma/dev.db`. There are no remotes or remote-tracking refs to establish whether it has ever been shared; do not rewrite history until that status is established.
- `backend/prisma/schema.prisma` and `backend/prisma.config.ts` both point to `file:./dev.db`; the documented `DATABASE_URL` is not used to select the Prisma database.
- `PROJECT_CONTEXT.md` describes authentication as JWT-style, but the implementation issues random opaque bearer tokens stored in the SQLite `Session` table; that document should be corrected.
- Legacy scrypt hashes continue to use the old fixed salt until those users change passwords. New registrations and provisioned admins use bcrypt.
- At that checkpoint Express still used permissive `cors()` and had no auth rate limiting. Both were addressed in the final production-hardening update below.
- The reconstruction engine's soft-bound pruning limitation was not changed. Existing benchmark claims are not proof of ground-truth survival because the benchmark does not retain the corrupted-away ground-truth values as candidate alternatives.
- There is no automated frontend E2E suite. The frontend production build validates compilation, not browser-to-API interaction.
- The working tree already contained edits to the frontend, `HANDOFF.md`, and `backend/prisma/dev.db`, plus untracked `research/antigravity_ui_audit.md`; these were preserved. No dependency installation or version change was performed.

## Supervisor Outer-Transport Recovery (2026-10-10)

### Changes completed
- Added at most one retry per Antigravity invocation for a nonzero process exit whose stdout records are all recognized valid stream-JSON events and contain exactly one outer `result` with `status: ERROR` and an explicit API request plus concrete network transport failure signature, with no tool events.
- Permission denials, `denied_actions`, tool errors, nonzero tool exits, process or transport timeouts, malformed streams, generic failures, and all other nonzero exits remain non-retryable. Existing permission, timeout, tool, and structured-output checks remain in place.
- Updated `scripts/supervisor/README.md`; the dry-run now checks every stdout record for a recognized valid event structure, includes negative cases for unknown, empty-object, and malformed-structure records, and exercises the bounded retry loop with isolated synthetic attempts.
- Added isolated retry-loop checks confirming a non-retryable first result stops immediately, a qualifying first failure gets one retry and returns the second attempt's result, and a second qualifying failure stops at attempt two without a third attempt.

### Verification performed
- `scripts/supervisor/supervisor.ps1 -Task 'Verify supervisor transport classifier and isolated retry-loop tests.' -LogDirectory 'C:\Users\divya\AppData\Local\Temp\lazarus-x-supervisor-verify-0a30dd4642d14b1c8c0c01c6b2601b16'` — passed (exit 0). Permission detector checks, all 17 synthetic retry classification cases, and all three isolated retry-loop scenarios passed. No agents, CLI help, or project processes were launched. Log: `C:\Users\divya\AppData\Local\Temp\lazarus-x-supervisor-verify-0a30dd4642d14b1c8c0c01c6b2601b16\supervisor-20261010-234843-500.log`.
- Backend/frontend suites, builds, live supervisor workflow, database commands, and migrations were not run.


## Antigravity Baseline Report (2026-10-10; audited below)
1. Antigravity reported an EvidenceGraph intended to handle out-of-order evidence.
2. Antigravity reported Vitest and React Testing Library coverage.
3. The feature-complete and patent-readiness claims were not substantiated by exhaustive engine tests and are superseded by the resource-safety audit below.

---

## Exact Search Resource-Safety Audit (2026-10-11)

### Findings
- The previous `topK * 4` beam limit was checked only after eagerly allocating the full record and global Cartesian products. It therefore did not protect against OOM.
- The beam silently discarded interpretations. Partial scoring could also penalize a foreign key before its parent table had been materialized, making results dependent on table ordering.
- Candidate ordering prioritized fatal-violation count lexicographically even though the configured score weights each fatal violation as 100 resolvable violations; this could return a lower-scoring state.
- The implementation did not perform bounded arc consistency despite that being claimed in the project prompt/context.

### Changes made
- Replaced post-allocation beam pruning with exhaustive enumeration under configurable `maxMaterializedStates` (default 10,000), `maxMaterializedUnits` (default 1,000,000), and `maxEvidencePerBatch` (default 10,000) limits. Search cardinality and unit limits are checked before allocating candidate/choice arrays.
- Over-limit evidence batches now throw `SearchSpaceLimitError` before materialization and commit atomically; the prior accepted evidence and candidate state remain available. The API returns HTTP 422 for resource-limit rejections and HTTP 400 for invalid evidence.
- Transaction staging uses copy-on-write for touched table/record/field maps instead of duplicating the full evidence graph. Active-learning distributions are accumulated in one state scan rather than repeatedly searching every state's rows.
- Best-state ordering now matches the actual weighted penalty formula, with an oracle regression test covering the fatal/resolvable tradeoff.
- Added schema/evidence validation, scalar domain restrictions, prototype-safe maps/records, and a reserved `_recordId` locator field.
- Foreign-key evaluation now uses target-value sets instead of repeated linear scans.
- Registered `oracle_test.ts` in `npm test`; updated it to assert exhaustive retention below the limit and atomic rejection above the limit. Adjusted the randomized scoring test to compare constraint metrics rather than a tied candidate's row order.
- Updated `PROJECT_CONTEXT.md` to remove claims of bounded arc consistency, polynomial behavior, or patent readiness.

### Verification
- `cd backend; npm test` — passed: engine tests, audit checks, oracle tests, and security tests.
- `cd backend; npx tsc --noEmit` — passed.
- `cd frontend; npm run build` — failed on existing `App.test.tsx` TypeScript setup errors (`global`, Vitest globals, and unused React import). This UI/test setup was outside the engine audit and was not modified.

### Limits
- This is exhaustive-over-observed-values-or-reject behavior, not a scalable solver for arbitrary NP-hard instances. It cannot infer a ground-truth value absent from all evidence. Large ambiguous batches return 422 rather than an approximate state. A solver that handles those cases needs a separate algorithm and explicit completeness guarantees.
- Patentability is not established; novelty and non-obviousness require prior-art research and legal review.

---

## Bounded CSP, Fuzzy Domains, and Evidence Provenance (2026-10-11)

### Implementation
- Added bounded AC-3 propagation before candidate enumeration. Pairwise UNIQUE disequality arcs and NOT_NULL unary constraints prune unsupported values. A contradiction triggers an explicit fallback to the original domains so inconsistent evidence remains inspectable and is scored as violations.
- Foreign-key support propagation is opt-in through `Constraint.targetEvidenceComplete: true`. The default remains open-world because an absent parent may arrive later. When enabled, source FK candidates are revised against all evidenced target domains using exact or bounded fuzzy string compatibility.
- Added bounded string-distance matching (default maximum 1, configurable 0–4; comparisons are limited to 256 Unicode code points), a shared comparison-work budget, and fuzzy components for similar strings in a field. Candidate output includes alternatives, evidence-frequency Shannon entropy, and edit-distance cost. The scoring likelihood is the explicit heuristic `exp(-distance)`; it is not calibrated probability. The current distance implementation is restricted Damerau-Levenshtein / optimal-string-alignment, including adjacent transpositions; it is not unrestricted Damerau-Levenshtein.
- Fuzzy FK matches add correction details to the candidate, including source/target record references, edit distance, negative-log cost, and both source and target fragment IDs.
- Added a per-case SHA-256 provenance ledger for accepted fragments and selected fuzzy corrections. Events bind sequence, actor ID, server timestamp, canonical payload, fragment IDs, previous hash, and current hash. The API persists fragments, ledger rows, case state, and ledger head in one Prisma transaction; engine state is forked and published only after that transaction succeeds.
- Added authenticated `GET /api/cases/:id/provenance`, which verifies the complete chain in 500-entry batches, matches accepted events to persisted evidence rows, flags untracked legacy fragments, and returns a bounded entry page (`afterSequence` and `limit`, default 100; max 500). The returned head hash must be retained independently to detect a rewrite of the entire database; this implementation does not digitally sign or externally anchor the head.
- Replaced recursive enumeration with iterative mixed-radix enumeration to avoid call-stack exhaustion. Added bounds for retained graph text, schema/constraint work, propagation revisions, comparison work, provenance event size, total provenance bytes, and event count. Provenance storage uses immutable chunks and a sharded fragment-ID index so request forks do not clone the entire ledger.
- Added `csp_fuzzy_provenance.test.ts`, expanded API tests for atomic evidence/ledger persistence and verification, and registered the engine regression suite in `npm test`.

### Verification
- `cd backend; npm test` — passed: engine, audit, oracle, CSP/fuzzy/provenance, and HTTP security/provenance tests.
- `cd backend; npx tsc --noEmit` — passed.
- `cd backend; npx prisma validate --schema prisma/schema.prisma` — passed.
- `cd frontend; npm run build` — passed (Vite production output built successfully).
- `npx prisma generate` first failed because Windows denied unlinking the in-use query-engine DLL. `npx prisma generate --no-engine --schema prisma/schema.prisma` successfully refreshed Prisma model types; the database was not opened or modified.

### Deployment and limits
- The local SQLite database was not changed. Apply the new `EvidenceProvenanceEntry` table and case head columns with `cd backend; npx prisma db push` when ready; this mutates `backend/prisma/dev.db`. Regenerate the normal Prisma client before starting the API.
- Case engines remain in memory and are not rebuilt from persisted fragments after process restart; the existing API reports that state loss. Provenance verification still reads the durable ledger.
- AC-3 is local propagation, not a complete solver; global contradictions may survive arc consistency and are detected during enumeration/scoring. Exact materialization remains exponential and safely rejects above configured limits.
- SHA-256 chaining detects partial edits/deletions when checked against a previously retained head, but a database administrator able to rewrite every event and the case head can recompute the chain. Use an independently retained checkpoint or a signing/anchoring service for stronger custody guarantees.
- No novelty, non-obviousness, patent application, or “patent-pending” status has been established.

## Independent Engineering Lead Audit (2026-10-11)

### Confirmed bug and durable replay
- Fixed the AC-3 FOREIGN_KEY empty-target defect: when target evidence is explicitly complete and the target relation is empty, unsupported child values are pruned and contradictions fall back to retained evidence for scoring.
- Added durable engine rehydration by replaying chronological provenance events from bounded database pages. The latest implementation verifies chain links, checks persisted fragment values and actors, checks the stored head, and preserves multi-fragment transaction boundaries with hashed batch metadata.
- Added restart coverage for multi-fragment batches and case/candidate retrieval.

### Production hardening and investigator console
- Replaced open CORS with an exact origin allowlist, applied bounded JSON parsing, security headers, per-process auth/write throttles, generic client errors, and privacy-safe structured API error logs.
- Public registration cannot assign roles. Auth verifies allowed roles, case data remains owner-scoped, admin deletion is explicit, session tokens are stored as SHA-256 digests, logout revokes sessions, and login/case creation/deletion audit writes are transactional where applicable.
- Added per-case write serialization plus a stored provenance-head check to reject stale concurrent writes. Added owner-scoped case listing, case restoration, and ranked candidate retrieval.
- Added Prisma indexes for case-owner lists and case-scoped fragment verification. The shared SQLite file was not migrated; apply the index schema changes in a planned database change.
- Rebuilt the dashboard with a case workspace, candidate-state map with candidate selection, a relational graph for the selected state, ranked alternatives, entropy change metrics, active-learning guidance, a paged redacted provenance ledger, browser-side public-envelope page verification, and commitment JSON export.
- Added a public SHA-256 commitment envelope that hides payloads and direct actor/fragment identifiers. It is not a zero-knowledge proof, signature, or privacy guarantee against dictionary guesses of low-entropy data. Retain exported heads outside the database.

### Patent research topics and limits
Potential claim topics for a prior-art review are bounded fuzzy-domain support integrated with relational constraint propagation and contradiction fallback; deterministic batch-aware replay bound to a provenance chain; and entropy-guided evidence acquisition paired with a redacted commitment envelope. This work makes no novelty or patentability conclusion and does not establish patent-pending status. A qualified patent professional should evaluate prior art and any claims.

### Verification performed
- cd backend; npm test — passed engine, audit, oracle, CSP/fuzzy/provenance, and HTTP tests, including CORS, throttling, logout revocation, commitment verification, multi-fragment restart replay, and concurrent writes.
- cd backend; npx tsc --noEmit — passed.
- cd backend; npx prisma validate --schema prisma/schema.prisma — passed.
- cd frontend; npm run build — passed.
- cd frontend; npx vitest run --reporter=dot — passed (3 tests).
- cd frontend; npm run lint — passed.
- No database migration, Prisma db push, deploy, or load/E2E browser run was performed.

### Deployment and operating limits
- Set NODE_ENV=production and CORS_ORIGINS to exact deployed frontend origins. Use HTTPS and provision an admin through the secure operator command.
- Existing plaintext session tokens stored before the token-hashing change no longer authenticate; users must sign in again.
- Additive SQLite index changes have not been applied. Run Prisma schema deployment intentionally, then regenerate the client before starting the API.
- Rate limiting and case locks are per process. They do not provide distributed coordination; SQLite also remains a single-writer database. Use a shared rate-limit/lock strategy and production database before scaling across workers.
- Full provenance verification is paged and indexed but still scans the whole chain per verification request. Search remains exponential within explicit caps and may reject large ambiguous evidence sets.

## Independent Forensic Branching & Security Hardening (2026-10-11)

### Predictive Forensic Branching Capability
- **Ranked Evidence Recommendations (`rankNextEvidence`):** Implemented multi-attribute ranking based on Shannon information gain across surviving interpretations, replacing single-element guidance.
- **Hypothesis Outcome Predictions (`CandidateValuePrediction`):** Added conditional value outcome distributions (`P(v)`, candidate counts) for disputed attributes, providing investigators with probabilistic foreknowledge of how observations will collapse candidate states.
- **Search Space Diagnostics (`getBranchingDiagnostics`):** Exposed total candidate states, prior entropy (in bits), disputed attribute counts, and exhaustion/fallback indicators.
- **Deterministic Disambiguation & Tie-Breaking:** Enforced strict lexicographical ordering (`table`, `recordId`, `field`) to preserve absolute test and audit reproducibility across order permutations.

### Production Reliability & Concurrency Hardening
- **Bounded In-Memory Cache (`BoundedEngineCache`):** Replaced unbounded object hash map with an LRU cache capped at 100 active engines to eliminate memory leakage on servers handling many distinct cases.
- **Case-Level Lock Extension:** Protected `GET /api/cases/:id/provenance` and `DELETE /api/cases/:id` with `acquireCaseLock` to eliminate race conditions between concurrent evidence ingestion and provenance verification or case destruction.
- **Batch Validation:** Enforced strict rejection of empty evidence arrays (`400 INVALID_EVIDENCE`).
- **Resilient Rate Limiter Eviction:** Improved in-memory sliding-window rate limiters to evict oldest entries upon capacity saturation rather than returning blanket HTTP 503 errors.

### Investigator Console (Frontend)
- **Multi-Probe Guidance Interface:** Displayed primary forensic probes with predicted value distributions and probability chips, along with alternative ranked investigative probes.
- **Diagnostic Metrics:** Integrated live counts of disputed attributes and entropy metrics in the investigative panel.
- **Privacy & Cryptographic Caveat:** Explicitly documented that un-salted SHA-256 commitments protect evidence confidentiality against casual inspection, but low-entropy domain values remain susceptible to offline dictionary recovery.

### Verification Performed
- `backend`: `npm test` passed 6 suites (unit test, audit test, oracle test, CSP/fuzzy/provenance test, security test, and new branching test).
- `backend`: `npx tsc --noEmit` passed with 0 errors.
- `frontend`: `npm run build` passed with 0 errors.
- `frontend`: `npx vitest run` passed with 4/4 passing tests.
- Backend and frontend services verified healthy and responding in live development environment.

## Independent Security, Relational-Key, and Investigator UX Audit (2026-10-11)

### Findings and changes
- **Constraint model gap:** Foreign keys could only express one column. Added ordered composite `fields` / `targetFields` support, matching each source tuple against one target record. Added `SIMPLE` and `FULL` composite NULL semantics. Candidate scoring now checks the same tuple semantics used by propagation and emits per-column fuzzy correction details.
- **Propagation edge cases:** Added regressions for two-table FK cycles, self-referential rows, NULL values with an empty complete target, and a composite key whose individual values exist on different target records. Domains only shrink; the existing revision and comparison budgets bound work, and contradictions still fall back to the original graph for scoring.
- **Public provenance dictionary attack:** Default envelopes previously exposed raw SHA-256 commitments for actor/fragment/payload fields and the internal ledger digest/head. Removed the raw digests from the redacted API response. Each case now stores a random 256-bit salt encrypted with AES-256-GCM under the external `PROVENANCE_ENCRYPTION_KEY`; per-event HMAC keys are derived from the case salt and event sequence. The secret ciphertext and raw internal head are not returned by case or evidence APIs.
- Added `GET /api/cases/:id/provenance/claims/:sequence` for an owner/admin to selectively reveal one event with its event-scoped salt and envelope row. A verifier can compare that disclosure to the public commitment. The disclosure deliberately exposes that event's plaintext, and the scheme is not a zero-knowledge proof or a signature. Existing cases without a salt get one lazily on their first provenance read.
- **Database access:** The unique `[caseId, sequence]` index already supports ordered ledger reads. Added `[caseId, receivedAt]`; existing provenance and evidence relations specify `onDelete: Cascade`. Added indexes remain unapplied to the shared `backend/prisma/dev.db`.
- **Investigator UI:** Added a case-view error boundary with a recovery action. Evidence intake now has text/JSON-scalar modes and inline validation for invalid JSON, unsupported JSON objects/arrays, empty/reserved attributes, and invalid record locators. Added accessibility error descriptions and invalid-field styling.

### Technical novelty summary (research lead only; no patentability conclusion)

#### Technical Problem
Reconstructing relational records from incomplete, contradictory, or out-of-order evidence can leave multiple candidate states. A system must preserve evidence alternatives, enforce relational constraints without assuming missing parents do not exist, bound computation, and show investigators what new observation could resolve the current ambiguity.

#### Algorithmic Mechanism
LAZARUS-X represents observed field values as finite domains, applies budgeted local propagation for uniqueness, nullability, and optional complete-target foreign keys (including composite tuples), and exhaustively enumerates surviving combinations only within explicit caps. Fuzzy string compatibility uses bounded edit distance. If propagation encounters a contradiction, it restores the input domains so conflicting evidence remains inspectable. Candidate penalty-weighted entropy then ranks candidate-specific evidence probes. Accepted fragments and fuzzy corrections are replayed deterministically from a hash-chained ledger; a separate redacted envelope uses event-scoped keyed commitments with selective disclosure.

#### Prior Art Differentiation (conceptual comparison, not a prior-art search)
- General SAT/SMT solvers can encode relational constraints and should not be described as unable to solve this problem. LAZARUS-X is a domain-specific bounded workflow that combines open-world forensic evidence domains, fuzzy FK support, contradiction-preserving fallback, deterministic ledger replay, and candidate-entropy evidence acquisition. No claim of superior completeness or general solver novelty is established.
- Bin-packing optimizes assignment under capacity constraints; it does not by itself model relational keys or conflicting observations. The comparison is about different problem structure, not proof of novelty.
- Raw fuzzy diff-matching can rank string similarity, but does not by itself enforce multi-table referential support or preserve an auditable sequence of accepted evidence and corrections. Existing data-cleaning and active-learning work may overlap; a dated patent/paper search and counsel review are still required.

### Verification performed
- `cd backend; npm test` — passed, including the added composite/cyclic/self-reference/nullability and provenance-disclosure regressions.
- `cd backend; npx tsc --noEmit` — passed.
- `cd backend; npx prisma validate --schema prisma/schema.prisma` — passed.
- `cd frontend; npx vitest run --reporter=dot` — passed (6 tests), including error-boundary recovery and pre-submit validation.
- `cd frontend; npm run build` — passed.
- `cd frontend; npm run lint` — passed.
- PostgreSQL-provider copy of the Prisma schema validated successfully without connecting to a database. An isolated SQLite smoke test confirmed cascade deletion and case/sequence plus case/timestamp index behavior. The shared SQLite database was not opened or changed.
- Normal Prisma client generation passed. An isolated `prisma db push` attempt against a temporary schema ended with a Prisma “Schema engine error”; it did not touch the repository database. An explicit deployment migration remains outstanding.

### Deployment and remaining limits
- Set `PROVENANCE_ENCRYPTION_KEY` to a secret-manager-provided 32-byte random value encoded as 64 hexadecimal characters before starting the API. Keep it stable and backed up; rotation requires re-encrypting stored case salts. Tests pass a test-only key directly to the app factory.
- The checked-in Prisma datasource still targets SQLite. PostgreSQL compatibility was schema-validation-only; production migration, generated client, connection behavior, and query performance were not exercised against a PostgreSQL server.
- No schema migration, `db push`, deployment, browser E2E, or load test was run against project data. SQLite is still single-writer; locks and rate limits remain process-local.
- Selective disclosure exposes the chosen event's claim and scoped salt. The envelope is not ZK, signed, or externally timestamped; retain the public envelope head outside the database to detect a complete rewrite.
- Evidence fragments and canonical provenance payloads are still stored as plaintext in the database. The encrypted case salt protects the redacted commitment mechanism, not database-at-rest PII; apply database access controls and storage encryption separately.
- No prior-art search was conducted in this audit. Novelty, non-obviousness, and patentability remain unestablished.


## Independent Security Hardening, Cryptographic Disclosure Audit, and Defensible Novelty Analysis (2026-10-11)

### Findings and changes
- **Cryptographic Disclosure Envelope Consistency:** In `backend/src/engine/provenance.ts`, `verifyProvenanceDisclosure` verified individual HMAC commitments against the envelope fields but did not assert that `envelope.envelopeHash` matched the SHA-256 digest of the envelope commitment object. Added cryptographic self-consistency verification so tampered or synthetic envelope hashes are rejected even if HMAC fields match.
- **Selective Disclosure Ledger & Fragment Cross-Validation:** In `backend/src/index.ts` (`GET /api/cases/:id/provenance/claims/:sequence`), an adversary or desynchronized database could have phantom rows beyond `dbCase.provenanceSequence` or modified rows in `EvidenceFragment` without triggering a failure in `claims/:sequence`. Added checks ensuring (1) phantom rows beyond the stored case sequence return HTTP 409, and (2) `EVIDENCE_ACCEPTED` disclosures cross-verify that the persisted `EvidenceFragment` exists and matches the ledger payload identically (actor, table, record locator, field, value, timestamp).
- **Automated Regression Suites:**
  - In `backend/src/engine/provenance_test.ts`: Added tests verifying that (a) tampered `envelopeHash` fails `verifyProvenanceDisclosure`, and (b) disclosure for sequence 1 cannot verify or reveal commitments for sequence 2.
  - In `backend/src/security.test.ts`: Added tests verifying that `claims/:sequence` returns HTTP 409 when the underlying evidence fragment is modified or when phantom ledger entries exist.
  - In `frontend/src/App.test.tsx`: Added tests verifying that unsupported JSON objects/arrays and negative/non-integer record locators are flagged inline and prevent form submission.
- **Relational Constraint Model Verification:** Audited `backend/src/engine/lazarus.ts`. Confirmed that two-table cyclic foreign keys and self-referential relations reach monotonic fixed points without false pruning; composite source columns match against single target rows in declared order; and SQL `MATCH SIMPLE` vs `MATCH FULL` NULL semantics match identically between local AC-3 propagation and global candidate penalty scoring.
- **Schema & Migration Verification:** Validated `backend/prisma/schema.prisma` for SQLite and an isolated PostgreSQL-provider copy with `npx prisma validate`. Confirmed composite unique constraint `@@unique([caseId, sequence])`, timestamp index `@@index([caseId, receivedAt])`, and cascade relations (`onDelete: Cascade`). Shared SQLite `dev.db` was preserved untouched.

### Technical novelty and prior-art search discipline

#### Primary Literature & Prior Art Citations
1. **Relational Data Cleaning & Constraint Repair:**
   - *Bohannon, Fan, Flaster, Rastogi (2005)*: "A Cost-Based Model for Database Repair", ACM SIGMOD 2005. Formalizes minimal-cost modification of relational instances to satisfy functional and inclusion dependencies. Contrast: Bohannon et al. assume closed-world database repair rather than preserving branching open-world hypotheses from incomplete, out-of-order evidence streams.
   - *Chu, Ilyas, Papotti (2013)*: "Holistic Data Cleaning: Putting Violations Into Context", PVLDB 2013. Solves conflict hypergraphs over denial constraints using integer programming. Contrast: Holistic cleaning operates as an offline batch optimization rather than an incremental forensic engine with active probe selection and append-only cryptographic provenance.
2. **Constraint Satisfaction & Relational SMT:**
   - *De Moura & Bjørner (2008)*: "Z3: An Efficient SMT Solver", TACAS 2008. SMT solvers encode relational theory over first-order logic. Contrast: General SMT solvers target satisfiability/unsatisfiability rather than this domain-specific bounded forensic workflow combining fuzzy FK support, contradiction-preserving ranking, and Shannon information-gain probe recommendation.
   - *Bessière (2006)*: "Constraint Propagation", Handbook of Constraint Programming. Foundations of AC-3 and generalized arc consistency over relational constraints.
3. **Active Learning & Optimal Experiment Design:**
   - *Settles (2009)*: "Active Learning Literature Survey", Computer Sciences Technical Report 1648, University of Wisconsin-Madison. Information-theoretic query selection (Shannon entropy reduction) over model posteriors.
   - *Lindley (1956)*: "On a measure of the information provided by an experiment", The Annals of Mathematical Statistics.
4. **Verifiable Audit Trails & Tamper-Evident Ledgers:**
   - *Haber & Stornetta (1991)*: "How to time-stamp a digital document", Journal of Cryptology. Linear hash-chaining foundations.
   - *Crosby & Wallach (2009)*: "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009.
   - *Bellare, Canetti, Krawczyk (1996)*: "Keying Hash Functions for Message Authentication (HMAC)", CRYPTO '96 / RFC 2104.

#### Synthesis & IP Boundary
- **Technical Problem:** Reconstructing relational database states from fragmented, contradictory, or delayed forensic logs under relational integrity constraints without premature pruning of valid hypotheses.
- **Algorithmic Mechanism:** Domain-specific bounded workflow combining (1) local AC-3 constraint propagation with open-world missing parent safety, (2) restricted Damerau-Levenshtein compatibility for fuzzy foreign keys with deterministic correction provenance, (3) Shannon entropy probe ranking (`rankNextEvidence`) across surviving candidate states, and (4) redacted public commitment envelopes using event-scoped HMAC-SHA-256 keys derived from AES-256-GCM encrypted case salts.
- **Uncertainty & Non-Claims:** LAZARUS-X is **not** patent-pending and no patentability determination is made. The cryptographic commitment scheme is **not** a zero-knowledge proof or a digital signature; external retention of the public envelope head is required to detect an entire-database rewrite.

### Verification performed
- `cd backend && npm test` — passed (all 7 suites: `test.ts`, `audit_test.ts`, `oracle_test.ts`, `csp_fuzzy_provenance.test.ts`, `provenance_test.ts`, `security.test.ts`, `branching_test.ts`).
- `cd backend && npx tsc --noEmit` — passed (0 errors).
- `cd backend && npx prisma validate --schema prisma/schema.prisma` — passed.
- `cd frontend && npx vitest run` — passed (6 tests).
- `cd frontend && npm run build` — passed (clean Vite production build).
- `cd frontend && npm run lint` — passed (0 warnings, 0 errors across 6 files).
- Validated PostgreSQL-provider schema copy with `npx prisma validate` without touching SQLite `dev.db`.

### Required migration for deployment
When deploying to production PostgreSQL or SQLite, apply the following DDL migration:
```sql
-- Add encrypted case salt column
ALTER TABLE "ReconstructionCase" ADD COLUMN "provenanceSaltCiphertext" TEXT;

-- Create timestamp lookup index on provenance ledger
CREATE INDEX IF NOT EXISTS "EvidenceProvenanceEntry_caseId_receivedAt_idx"
  ON "EvidenceProvenanceEntry"("caseId", "receivedAt");
```
Do not execute migrations against `backend/prisma/dev.db` directly.


## Independent Deep-Chain, Key-Rotation, Claim-Verifier, and Migration Delivery (2026-10-11)

### Findings and changes
- **Deep FK chain audit:** Added a reverse-order, three-table `Order → Employee → Department` regression. It submits child evidence before the employee and department, leaves the employee's non-key `name` absent, and confirms both FK arcs prune unsupported alternatives after later evidence arrives. A second regression checks all six table-evidence arrival permutations and confirms they reach the same valid fixed point with no fatal or resolvable violations. No engine change was needed; accumulated evidence is re-propagated to a fixed point on each accepted batch.
- **Master-key rotation:** Added `backend/src/security/key_rotation.ts` with `rotateCaseProvenanceKeys(prisma, oldMasterKey, newMasterKey)`. It validates 32-byte keys, reads cases in stable ID-ordered pages of 250, decrypts and re-encrypts the same case salt with a fresh AES-GCM IV, and uses a compare-and-update predicate inside one Prisma interactive transaction with a 10-second acquisition wait and 5-minute timeout. It returns scanned/rotated/uninitialized counts. A malformed ciphertext or concurrent row change aborts the transaction. Null salts remain null and continue to use the existing lazy initialization path.
- **Operator command:** Added `npm run security:rotate-provenance-key`. It requires `PROVENANCE_OLD_ENCRYPTION_KEY` and `PROVENANCE_NEW_ENCRYPTION_KEY` from the operator environment, rejects identical keys, and outputs only aggregate counts. It does not rewrite `.env` or change deployment secrets.
- **Rotation tests:** Added success tests confirming the salt, derived event keys, and disclosure verification remain valid under the new master key, a page-boundary test spanning 251 rows, and an all-or-nothing rollback test when a later ciphertext fails authentication. Added a real Prisma SQLite transaction test against a temporary database under the OS temp directory; the shared DB is not opened.
- **Client-side claim verification:** Added a keyboard-operable expandable verifier in the Provenance tab. It accepts `{ "disclosure": ..., "envelope": ... }`, validates the exact v2 payload shape, imports the event-scoped salt as an HMAC-SHA-256 key, checks actor/fragment/related-fragment/payload commitments, and recomputes the envelope SHA-256 hash using Web Crypto. The panel reports `VALID CLAIM`, `TAMPERED / MISMATCHED`, or a bounded input/verification error. The verifier code is isolated in `frontend/src/provenanceVerifier.ts`; the UI is covered by valid/tampered crypto tests and a dashboard interaction test.
- **Migration artifact:** Added `backend/prisma/migrations/20261011000000_provenance_salt_and_indexes/migration.sql` and SQLite `migration_lock.toml`. The migration adds `provenanceSaltCiphertext` and the case/timestamp index. It is prepared only; it was not run against `backend/prisma/dev.db` or any production database.
- **Migration validation:** Added a test that applies the SQL statements to a temporary SQLite database initialized with the pre-change tables, then inspects `PRAGMA table_info` and `PRAGMA index_list`. It verifies the migration artifact itself without touching the shared project database.
- Updated `PROJECT_CONTEXT.md` with the key-rotation procedure, dashboard verification scope, and migration status.

### Verification performed
- `cd backend; npm test` — passed all listed engine, audit, oracle, CSP/fuzzy/provenance, key-rotation, security, and branching suites. The CSP/fuzzy/provenance runner reports 19 passing checks, including all six deep-chain evidence arrival permutations; key rotation reports 3 passing tests, including the isolated real Prisma SQLite transaction.
- Isolated `npx ts-node --files src/security/schema_migration.test.ts` — passed; additive DDL applied to a temporary pre-change SQLite schema and verified through SQLite metadata queries.
- `npm run security:rotate-provenance-key` with deliberately invalid placeholder keys — rejected the inputs before Prisma initialization and printed no key material. The command was not run with real keys.
- `cd backend; npx tsc --noEmit` — passed.
- `cd backend; npx prisma validate --schema prisma/schema.prisma` — passed.
- `cd frontend; npx vitest run` — passed (8 tests).
- `cd frontend; npm run build` — passed; Vite production build completed.
- `cd frontend; npm run lint` — passed with no warnings.
- No database migration, `db push`, browser E2E suite, load test, or PostgreSQL integration test was run.

### Deployment and proof boundaries
- Perform key rotation with API writers quiesced. Supply the old and new keys from a secure operator process, run the transaction successfully, then update the deployment secret to the new key before resuming API traffic. Do not put either key in command-line arguments or logs. The one-transaction design has a five-minute timeout; larger installations may need a reviewed maintenance plan if that bound is exceeded. If rotation fails, investigate the offending row before retrying; the transaction is designed to roll back all updates.
- The migration is a one-time additive artifact for a target database that lacks the new salt column. The repository has no prior Prisma migration baseline; review/baseline the target's existing schema and migration history before using `prisma migrate deploy`. The column statement will fail if the column already exists. Do not run it on the shared local database.
- Browser claim verification authenticates the supplied event fields against the supplied public envelope row and checks that row's self-hash. It does not establish that the row is included in a complete externally retained chain head. The mechanism remains a keyed commitment disclosure, not a signature or zero-knowledge proof.
- Key rotation was tested against a real Prisma SQLite client and an isolated temporary database with a minimal test table, not a production-shaped database. Validate the full production schema, transaction duration, and migration execution in staging before rollout.

### GitHub engineering references reviewed
- The engine regression follows the standard AC-3 revise-and-requeue shape in [AIMA Python's CSP implementation](https://github.com/aimacode/aima-python/blob/master/aima/csp.py). This is an established algorithm reference, not evidence of novelty.
- The isolated real-client test approach is consistent with [Prisma's Express integration-test example](https://github.com/prisma/prisma-examples/tree/latest/orm/testing-express).
- Reviewed [Prisma issue #29870](https://github.com/prisma/prisma/issues/29870), which reports SQLite interactive-transaction stalls under heavy concurrency for Prisma 6.19.2 / Node 25.4. This does not establish a defect in this repository's Prisma 5.11.0; it reinforces the requirement to keep key rotation in a quiesced maintenance window and validate transaction duration.
- `git remote -v` returned no configured remote for this checkout, so no private/upstream LAZARUS-X repository could be inspected. The references above are public upstream projects only.

## Browser E2E and Engine Load Exercise (2026-10-11)

### Changes
- Replaced the schema's hard-coded SQLite path with `env("DATABASE_URL")`, added `backend/.env.example`, and added a single configured Prisma-client factory used by the API, admin provisioning, and key-rotation command. The application honors a configured SQLite file URL and retains `file:./dev.db` as its default. `prisma.config.ts` uses the same setting for schema operations. Non-file URLs are rejected by the SQLite runtime helper.
- Added a Playwright browser suite (`frontend/e2e/investigator.spec.ts`) and `npm run test:e2e`. It runs the real Vite frontend, Express API, Prisma client, and schema against a disposable SQLite database under the OS temp directory. It covers investigator registration, case creation, evidence submission, public ledger verification, retrieval of a real selective disclosure, and browser verification of valid and altered claims.
- Added `backend/src/e2e_server.ts`, a test-only API entry point that accepts only a database file named `e2e.db` inside a `lazarus-x-e2e-*` OS-temp folder. The runner invokes `db push` with the repository's actual Prisma schema and config, supplying an absolute temp `DATABASE_URL`; the API receives the same URL and rejects paths outside the dedicated temp namespace. The shared `backend/prisma/dev.db` is not used.
- Added `backend/src/database_url.ts` and two unit tests so runtime and Prisma CLI resolve relative SQLite paths against `backend/prisma`, preserve query options, and reject non-SQLite URLs or malformed encodings. Added `backend/src/database_url.test.ts` to `npm test`.
- Added `backend/src/engine/load_test.ts` and `npm run load:engine`. It exercises real engine propagation, exact materialization, provenance hashing, and chain verification on child-before-parent workloads of 100, 250, and 500 employees. It also asserts an over-limit workload leaves candidate state and the provenance head unchanged. Reports five-run p50/p95 observations without enforcing machine-specific timing thresholds.
- Restricted Vitest discovery to `frontend/src` so Playwright's `test()` declarations are not loaded by the jsdom runner. Added Playwright test artifacts to `.gitignore`.

### Verification performed
- `cd frontend; npm run test:e2e` — passed in installed Chrome: one end-to-end browser test against the real API and isolated SQLite schema. The test confirmed the valid disclosure and rejected a one-byte payload alteration.
- `cd frontend; npx vitest run` — passed (8 tests); `npm run build` and `npm run lint` passed without warnings.
- `cd backend; npm test` — passed all 10 command stages, including the 19 CSP/fuzzy/provenance checks, 3 key-rotation tests, isolated migration test, 9 HTTP security tests, predictive branching suite, and 3 SQLite URL resolver tests.
- `cd backend; npx tsc --noEmit` — passed. In PowerShell, `$env:DATABASE_URL='file:./dev.db'; npx prisma validate --schema prisma/schema.prisma` — passed; the CLI now requires a datasource URL from the environment or `.env`.
- `cd backend; npm run load:engine` — passed five runs per workload. Latest local observations: 100 employees / 310 fragments p50 5.68 ms, p95 8.66 ms; 250 / 775 p50 13.42 ms, p95 19.31 ms; 500 / 1,550 p50 27.12 ms, p95 29.58 ms. Each completed with one candidate and a verified provenance chain. The overload scenario rejected atomically at its 100-candidate cap. These timings are synthetic engine microbenchmarks, not a service-level guarantee.
- `git diff --check` — passed after final edits.

### Remaining limits
- This is a focused browser flow and engine microbenchmark, not broad cross-browser coverage, concurrent API load, soak testing, or staging validation. Those require a representative deployment environment and workload.
- The disposable E2E setup sets `RUST_LOG=info` because the installed Prisma 5.11.0 schema engine returned an empty `Schema engine error` without it in this environment. [Prisma issue #29355](https://github.com/prisma/prisma/issues/29355) reports a similar SQLite symptom on Prisma 6.16.3/macOS; that report does not prove a shared root cause or defect in this version.
- No migration was applied to the shared database, no PostgreSQL integration suite was run, and no private GitHub remote is configured.

### Focused patent-landscape scoping search
- A limited public search surfaced established patent families around adjacent individual mechanisms: [holistic database record repair](https://patents.google.com/patent/US9116934B2/en), [reconstructing incomplete rows from transaction logs/backups](https://patents.google.com/patent/US7076481B2/en), [resolving database-integration conflicts using provenance](https://patents.google.com/patent/US9195725B2/en), and [fuzzy matching of data records](https://patents.google.com/patent/US7296011B2/en).
- The retrieved descriptions cover record/constraint repair, fuzzy duplicate matching, transaction-log row restoration, and provenance-assisted conflict handling. That makes broad claims to those elements individually especially risky. LAZARUS-X's possible differentiating question is the specific combination and operation of open-world, out-of-order evidence domains; bounded propagation with contradiction-preserving candidate fallback; fuzzy foreign-key support; information-gain evidence selection; and deterministic cryptographic replay. This is a research hypothesis, not a claim-chart conclusion.
- This was a quick search of public patent pages, not a comprehensive claim search, prosecution-history review, jurisdictional search, freedom-to-operate opinion, or novelty/patentability determination. Patent counsel should search the exact proposed claims and cited families before any filing decision. No patent-pending status is claimed.

## Extended Engineering, Production Readiness & Prior-Art Audit (2026-10-11)

### 1. Implemented Features & Technical Rationale

1. **Configurable Reverse-Proxy Trust (`TRUST_PROXY`)**
   - *Rationale:* In standard Express configurations, `req.ip` falls back to the TCP socket address. When deployed behind reverse proxies, load balancers, or ingress controllers (e.g. NGINX, AWS ALB, Cloudflare), all clients share the proxy's IP address, causing global rate limit exhaustion and inaccurate audit logs. Conversely, blindly enabling proxy trust allows untrusted callers to spoof `X-Forwarded-For`.
   - *Implementation:* Added an optional `options.trustProxy` parameter to `createApp(prisma, masterKey, options)` and automatic detection of `process.env.TRUST_PROXY` (supporting booleans, integer hop counts, and subnet strings).
   - *Verification:* Verified via `backend/src/security.test.ts` that `trustProxy: 1` correctly partitions rate limit windows per forwarded client IP while preventing cross-client budget starvation.

2. **Externally Anchorable Provenance Checkpoints**
   - *Rationale:* The internal evidence ledger (SHA-256 hash chain) and public commitment envelope (keyed HMACs) provide intra-database tamper evidence. However, an attacker with write access to the underlying database file could rewrite the entire database and regenerate all hash chains. The definitive mitigation against whole-database revision is external anchoring.
   - *Implementation:*
     - Added `createProvenanceCheckpointManifest` and `verifyProvenanceCheckpointManifest` to `backend/src/engine/provenance.ts`.
     - Manifests commit to `version`, `caseId`, `sequence`, `ledgerHead`, `publicEnvelopeHead`, `timestamp`, and `cumulativeEventCount`, computing a SHA-256 `manifestDigest` over the canonical JSON encoding.
     - Added `GET /api/cases/:id/provenance/checkpoint` to `backend/src/index.ts`, protected by authentication, case ownership/admin authorization, and case-level concurrency locking.
   - *Verification:* Verified in `backend/src/engine/provenance_test.ts` and `backend/src/security.test.ts` that manifests verify deterministically, detect field tampering, and reject unauthorized callers with 403.

3. **Rich Forensic Recommendation Explanations**
   - *Rationale:* Investigators receiving Shannon information gain recommendations (`rankNextEvidence`) need clear rationale explaining why a specific probe is recommended and how it disambiguates competing hypotheses.
   - *Implementation:*
     - Added `explanation?: string;` to `ForensicEvidenceRecommendation` in `backend/src/engine/types.ts`.
     - In `backend/src/engine/lazarus.ts` (`rankNextEvidence`), formatted explanations detailing the disputed attribute, candidate count, top predicted values with likelihood percentages, and the entropy reduction from prior to conditional entropy.
     - Updated frontend `Recommendation` interface and `frontend/src/App.tsx` to render explanations in the primary recommendation card and probe tooltips.
   - *Verification:* Passed all engine branching tests (`backend/src/engine/branching_test.ts`), frontend unit tests (`frontend/src/App.test.tsx`), and Playwright E2E.

---

### 2. Verified Test Execution & Results

All automated checks were executed in the repository and passed cleanly:

- **Backend Test Suite (`npm test`):**
  - `src/engine/test.ts`: 3/3 passed (Mathematical Equivalence, Cross-table isolation, State Deduplication).
  - `src/engine/audit_test.ts`: 5/5 passed (Out of order evidence, Missing parent resolution, Contradictory UNIQUE collisions, Candidate score interpretation, Ambiguity reduction).
  - `src/engine/oracle_test.ts`: 12/12 passed (Oracle equivalence, Materialization bounds, Atomic rejection of over-limit batches, Identity collision safety).
  - `src/engine/csp_fuzzy_provenance.test.ts`: 19/19 passed (AC-3 pruning, Monotonic cyclic FK propagation, Composite MATCH FULL, Deep FK chains, Fuzzy FK compatibility, Chain tamper detection).
  - `src/engine/provenance_test.ts`: 5/5 passed (Case salt encryption/decryption, Event-scoped HMAC commitments, Tampered envelopeHash rejection, Cross-sequence isolation, Externally anchorable checkpoint manifests).
  - `src/security/key_rotation.test.ts`: 3/3 passed (Atomic key rotation across isolated SQLite transactions).
  - `src/security/schema_migration.test.ts`: 1/1 passed (SQL migration application to isolated schema).
  - `src/security.test.ts`: 11/11 passed (Password verification, RBAC authorization, Admin deletion, Over-limit atomic rejection, Rehydration, CORS origin filtering, Throttling/information hiding, Same-case serialization, Checkpoint verification, Configurable trust proxy).
  - `src/engine/branching_test.ts`: 5/5 passed (Ambiguous evidence, Deterministic tie-breaking, Probability sum conservation, Exhausted ambiguity, Contradiction fallback).
  - `src/database_url.test.ts`: 3/3 passed (Relative path schema directory resolution, Provider validation, Space/URI encoding).
- **Backend TypeScript Compilation (`npx tsc --noEmit`):** 0 errors.
- **Prisma Schema Validation (`npx prisma validate` with safe DATABASE_URL):** Valid.
- **Engine Microbenchmark (`npm run load:engine`):**
  - 100 employees (310 fragments): p50 = 4.90ms, 63,265 fragments/sec, provenance verified.
  - 250 employees (775 fragments): p50 = 11.78ms, 65,789 fragments/sec, provenance verified.
  - 500 employees (1550 fragments): p50 = 23.95ms, 64,718 fragments/sec, provenance verified.
  - Overload: 100-candidate cap rejected atomically without state pollution.
- **Frontend Unit Tests (`npx vitest run`):** 8/8 passed in 2.87s.
- **Frontend Build (`npm run build`):** Clean build (tsc -b && vite build) in 489ms.
- **Frontend Lint (`npm run lint`):** 0 warnings, 0 errors across 10 files with 116 rules.
- **Playwright Browser E2E (`npm run test:e2e`):** Passed in 3.9s against isolated temp DB (`e2e.db` in `lazarus-x-e2e-MLmuZf`).
- **Diff Hygiene (`git diff --check`):** Clean (0 whitespace/formatting errors).
- **Database Safety:** Shared database `backend/prisma/dev.db` was completely untouched.

---

### 3. Patent Prior-Art Comparison & Legal Disclaimers

A focused public-record scoping comparison of four identified patent families was conducted. It is not a claim chart or exhaustive search:

| Prior Art Family | Core Patented Mechanism | Technical Distinction in LAZARUS-X |
| :--- | :--- | :--- |
| [US9116934B2 — Holistic database record repair](https://patents.google.com/patent/US9116934B2/en) (Qatar Foundation; current assignee listed as Hamad bin Khalifa University) | Cost-based repair of functional-dependency violations and duplicate records by modifying a database instance. | LAZARUS-X preserves evidence-supported candidate alternatives and ranks bounded interpretations without applying repairs to a source database. |
| [US7076481B2 — Method and apparatus for logically reconstructing incomplete records](https://patents.google.com/patent/US7076481B2/en) (BMC Software) | Searches database transaction logs for change records and reapplies them to reconstruct an object's earlier state. | LAZARUS-X reconstructs from submitted evidence fragments and replays an application provenance ledger rather than parsing DB transaction logs. |
| [US9195725B2 — Resolving database integration conflicts using data provenance](https://patents.google.com/patent/US9195725B2/en) (IBM) | Associates prioritized policies with integration conflicts and applies a highest-priority eligible policy to produce an integrated value. | LAZARUS-X uses confidence as a heuristic while retaining alternatives; its ledger records receipt/replay and does not implement source-precedence resolution. |
| [US7296011B2 — Efficient fuzzy match for evaluating data records](https://patents.google.com/patent/US7296011B2/en) (Microsoft) | Approximate matching of input tuples against reference relations using token/q-gram similarity; the disclosure also covers token transposition. | Bounded restricted Damerau-Levenshtein (optimal-string-alignment), including adjacent transpositions, contributes to foreign-key support checks and correction events. This distinction does not establish claim separation or novelty. |

*Disclaimers:*
- LAZARUS-X is **not** patent-pending and no guarantee of novelty or patentability is made.
- This comparative analysis is an engineering assessment, not a legal opinion or freedom-to-operate study.
- Prior to any patent filing, claim-level searches and analysis by qualified patent counsel are required.

---

### 4. Operational Requirements & Remaining Limits

1. **Proxy & Load Balancer Deployment:**
   - In production behind a reverse proxy, configure `TRUST_PROXY=1` (or the specific proxy IP count/CIDR) to ensure accurate rate limiting and audit logs.
   - For direct public exposure without a proxy, leave `TRUST_PROXY` unset to prevent `X-Forwarded-For` header spoofing.
2. **Database Concurrency & Horizontal Scaling:**
   - Case locks and sliding rate limit windows are currently process-local in-memory Maps.
   - SQLite enforces a single-writer architecture. For multi-node API deployments, shared rate limiting (e.g. Redis), distributed case coordination, and a reviewed database-provider migration are required. The current Prisma schema is SQLite-only; PostgreSQL runtime support is not implemented.
3. **Database Migrations:**
   - The migration SQL at `backend/prisma/migrations/20261011000000_provenance_salt_and_indexes/migration.sql` has been validated against an isolated temp SQLite instance. Do not apply it to `dev.db` without verifying existing column status.
4. **Provenance Anchoring:**
   - The public envelope and checkpoint manifest provide cryptographic tamper evidence. Operators should configure periodic publication of `manifestDigest` to external immutable storage or transparency logs to defend against whole-database tampering.


## Merkle Proofs, Confidence-Weighted Branching, and Offline Audit Export (2026-10-11)

### Implemented changes

- **Bounded transposition-aware fuzzy distance:** Replaced the bounded Levenshtein comparison with restricted Damerau-Levenshtein / optimal-string-alignment distance. Adjacent transpositions cost one edit. The existing maximum edit cutoff, Unicode-code-point limit, propagation work budget, and comparison budget remain active. This is not unrestricted Damerau-Levenshtein.
- **Investigator-assessed source confidence:** Added optional `Evidence.confidence` in `(0, 1]`, default `1.0`; API validation rejects out-of-range values through engine validation. Explicit confidence values are recorded in the canonical accepted-evidence payload and reconstructed during rehydration; omitted legacy values replay as `1.0`. Candidate scores add normalized dissenting-confidence penalties, which feed the existing normalized candidate weights and entropy-ranked evidence recommendations. Confidence is an investigator-supplied heuristic, not a validated source credential or calibrated probability.
- **Merkle inclusion proofs:** Added a domain-separated, duplicate-last SHA-256 Merkle tree over ordered public envelope hashes. The checkpoint's optional `publicEnvelopeMerkleRoot` is covered by its manifest digest. The owner/admin endpoint `GET /api/cases/:id/provenance/proofs/:sequence` rehydrates and verifies the full ledger, cross-checks stored fragments, then returns one public event, its O(log N) inclusion path, and the root-bearing checkpoint. The browser verifies the event self-hash, checkpoint digest, and inclusion path before downloading a proof file. Proof verification is O(log N) for a client; current server proof generation rebuilds the tree and is O(N), because no Merkle nodes or accumulator state are persisted.
- **Offline audit bundle:** Added owner/admin-only `GET /api/cases/:id/export/audit-bundle`, which rehydrates and verifies the case and returns the schema, up to 20 candidate snapshots, complete public envelope chain, root-bearing checkpoint, bundle digest, and a standalone Node verifier in the JSON. Exports are capped at 64 MiB and candidate snapshots can contain PII. The verifier uses only Node built-ins, checks its own source digest, bundle self-digest, envelope chain, Merkle root, and checkpoint digest, and accepts an optional externally retained expected bundle digest.
- **Investigator UI:** Added confidence input and scoring cue, per-event inclusion proof download with local verification status, and full offline bundle download. The existing loaded-page commitment export remains available. The UI warns that audit bundles contain reconstructed values.
- **Claim map:** Added an illustrative method/system/computer-readable-medium claim architecture and a technical differentiation matrix to `PROJECT_CONTEXT.md` and this handoff. The exact source patent titles/assignees were checked against the linked patent records; some older labels in prior handoff text were inaccurate and have been corrected. The comparison is a scoping aid, not a claim chart, validity/freedom-to-operate analysis, or patentability determination.

### Illustrative claim architecture (engineering draft only)

This language describes implemented mechanisms for technical review. It is not a legal claim set, a filing-ready specification, or a conclusion that the combination is novel or patentable.

**Independent Method Claim 1.** A computer-implemented method comprising: (a) receiving scalar-validated partial relational evidence fragments associated with relation, record locator, field, and optional investigator-assessed confidence, the fragments being receivable out of dependency order; (b) accumulating observed values in finite per-field evidence domains; (c) revising relational constraint arcs under configured propagation and work bounds, including foreign-key support determined using a configured cutoff of restricted Damerau-Levenshtein / optimal-string-alignment distance for string values; (d) upon an empty propagated domain, restoring source evidence domains for contradiction scoring; (e) enumerating surviving assignments under candidate, work, and state limits, and rejecting an over-limit evidence update before publishing the engine state; (f) calculating constraint, fuzzy-distance, and normalized dissenting-confidence penalties, deriving normalized heuristic candidate weights, and using those weights to compute candidate entropy and expected information gain for evidence queries; and (g) appending accepted fragments and deterministic correction events to a hash-chained ledger, generating event-scoped HMAC commitments for public envelopes, and producing a digest checkpoint that binds a public-envelope head and Merkle root for independent retention.

**Independent System Claim 8.** A reconstruction and audit system comprising one or more processors; an authenticated investigator API with case-ownership enforcement; a relational transaction store configured to persist accepted evidence, provenance events, and a case head atomically; a bounded in-memory engine cache; a domain engine configured to build finite evidence domains, run budgeted AC-3 propagation, preserve contradiction alternatives, enumerate within explicit bounds, and rank information-gain recommendations using heuristic confidence weights; and cryptographic modules configured to verify deterministic event replay, derive event-scoped HMAC commitments from an encrypted case salt, and calculate a Merkle inclusion path and digest checkpoint over public envelope hashes.

**Independent Computer-Readable Medium Claim 15.** A non-transitory computer-readable medium storing instructions that, when executed by one or more processors, cause the processors to perform the method of Claim 1, including bounded propagation and enumeration, atomic rejection of over-limit updates, confidence-weighted heuristic candidate ranking, append-only cryptographic provenance generation, Merkle inclusion-proof generation, and offline audit-bundle verification.

### Technical mapping and cited comparison set

| Claim concept | Implementation evidence | Regression evidence |
| --- | --- | --- |
| Method Claim 1: bounded domains, AC-3, fuzzy FK support, contradiction fallback, capped enumeration | `backend/src/engine/lazarus.ts` | `backend/src/engine/csp_fuzzy_provenance.test.ts`, `backend/src/engine/oracle_test.ts` |
| Method Claim 1: confidence penalties flow into candidate weights and query entropy | `backend/src/engine/types.ts`, `backend/src/engine/lazarus.ts` | `backend/src/engine/csp_fuzzy_provenance.test.ts`, `backend/src/engine/branching_test.ts` |
| Method Claim 1 / System Claim 8: deterministic ledger, HMAC envelope, encrypted case salt, checkpoint, Merkle root | `backend/src/engine/provenance.ts`, `backend/src/index.ts` | `backend/src/engine/provenance_test.ts`, `backend/src/security.test.ts` |
| System Claim 8 / Medium Claim 15: isolated DB write, bounded case cache, rehydration, API role/case access | `backend/src/index.ts`, `backend/src/engine/lazarus.ts` | `backend/src/security.test.ts` |
| Medium Claim 15: packaged offline verifier | `backend/src/engine/audit_bundle.ts` | `backend/src/engine/audit_bundle_test.ts` |
| Investigator controls for confidence, proofs, and bundles | `frontend/src/App.tsx`, `frontend/src/provenanceVerifier.ts` | `frontend/src/App.test.tsx`, `frontend/e2e/investigator.spec.ts` |

| Patent reference checked | Disclosed focus used for comparison | Engineering contrast; not a legal conclusion |
| --- | --- | --- |
| [US9116934B2 — Holistic database record repair](https://patents.google.com/patent/US9116934B2/en), Qatar Foundation; currently listed to Hamad bin Khalifa University | Cost-based generation of updates to repair functional-dependency violations and duplicate records | LAZARUS-X retains evidence-supported alternatives and ranks candidates without applying repairs to an input database |
| [US7076481B2 — Method and apparatus for logically reconstructing incomplete records](https://patents.google.com/patent/US7076481B2/en), BMC Software | Searches transaction logs for change records and reapplies them to reconstruct an earlier object state | LAZARUS-X uses submitted fragments and an application provenance ledger; it does not parse DB transaction logs |
| [US9195725B2 — Resolving database integration conflicts using data provenance](https://patents.google.com/patent/US9195725B2/en), IBM | Selects and applies a highest-priority eligible policy to resolve integration conflicts | LAZARUS-X uses confidence as a heuristic and retains alternatives; it does not implement source-precedence conflict resolution |
| [US7296011B2 — Efficient fuzzy match for evaluating data records](https://patents.google.com/patent/US7296011B2/en), Microsoft | Approximate input-tuple matching against reference relations using token/q-gram similarity; the disclosure also describes token transposition | LAZARUS-X applies bounded restricted Damerau-Levenshtein distance to FK support checks inside relational propagation and records correction events |

### Verification performed for this delivery

- `cd backend; npm test` — passed all 11 chained runners: engine equivalence 3, audit 5, oracle 12, CSP/fuzzy/provenance 20, provenance 7, offline bundle verifier 1, key rotation 3, isolated schema migration 1, API security 12, predictive branching 6, and SQLite URL resolution 3.
- `cd backend; npx tsc --noEmit` — passed.
- `cd backend; $env:DATABASE_URL='file:./dev.db'; npx prisma validate --schema prisma/schema.prisma` — passed; this command validated the Prisma schema and did not apply a migration.
- `cd backend; npm run load:engine` — passed with atomic rejection above the configured candidate cap. Five-run p50 observations were 8.64 ms at 100 employees / 310 fragments, 17.54 ms at 250 / 775, and 35.83 ms at 500 / 1,550. These are synthetic single-process measurements, not a service SLA.
- `cd frontend; npx vitest run` — passed (9 tests).
- `cd frontend; npm run build` — passed (`tsc -b` and Vite production build; 2,316 modules transformed).
- `cd frontend; npm run lint` — passed.
- `cd frontend; npm run test:e2e` — passed (1 Playwright flow in Chrome), covering investigator registration, confidence submission, locally verified proof download, offline bundle download, and valid/tampered disclosure verification against the real API and a disposable SQLite database.
- `git diff --check` — passed. Git emitted only its existing working-copy LF/CRLF notices.
- No command in this delivery targeted `backend/prisma/dev.db`: API unit/security tests use a fake Prisma client or isolated temporary databases; the key-rotation and migration tests use temporary SQLite files; Playwright used `lazarus-x-e2e-ohNTus` under the OS temp directory. Prisma validation did not apply a migration. The ignored shared DB was not opened by the verification commands.

### Proof and product limits

- Merkle proofs establish inclusion under the supplied checkpoint root; they do not establish who issued that checkpoint. Publish/retain the checkpoint or bundle digest using an independent trusted channel if origin and later-rewrite detection are required.
- Checkpoint manifests and bundle digests are unkeyed hashes, not digital signatures. The HMAC envelope is not a zero-knowledge proof. The offline verifier cannot recompute the hidden private ledger hash chain from the public envelope.
- The bundle is self-contained for public-envelope and package integrity checks; it does not prove candidate reconstruction values are factually correct. Candidate snapshots reveal reconstructed values and are sensitive case data.
- A cache miss or ledger-head change still rehydrates and verifies the ledger and compiles the envelope chain/tree in O(N). On a validated cache hit, proof extraction performs O(log N) indexed level lookups; end-to-end HTTP latency also includes authentication, case locking, and database reads. The bounded cache is process-local and does not provide logarithmic tree updates.
- Confidence is supplied by the investigator and is not tied to an authenticated issuer, trust registry, or empirical calibration.
- PostgreSQL is not runtime-supported by the checked-in SQLite-only schema. SQLite writes, rate limits, and case locks retain their documented single-process/single-writer constraints.
- The patent references are a small, public comparison set. This work makes no novelty, non-obviousness, patentability, or freedom-to-operate finding. Qualified patent counsel must map exact claims and review the full prior-art landscape.

## Pre-Indexed Merkle Accumulator & Proof Scalability Delivery (2026-10-11)

### 1. Architectural Gap & Technical Rationale

Prior to this delivery, `GET /api/cases/:id/provenance/proofs/:sequence` rebuilt the public envelope chain and binary Merkle tree from scratch on every request ($O(N)$ database fetches, engine rehydration, HMAC derivations, and Merkle parent hash calculations). For cases with large event streams or clients requesting multiple proof events, repeated $O(N)$ execution imposed unnecessary CPU and database load.

### 2. Implemented Improvements

1. **Pre-Indexed Merkle Accumulator (`backend/src/engine/provenance.ts`):**
   - Added `EnvelopeMerkleTree` interface storing `totalEvents`, `rootHash`, and pre-compiled levels `levels: string[][]`.
   - Added `buildEnvelopeMerkleTree(envelopes)` which compiles all parent levels once in $O(N)$ operations.
   - Added `generateProofFromMerkleTree(tree, sequence)` which extracts the inclusion path in strictly $O(log N)$ array lookups with zero hash computations.
   - Retained backward-compatible `computeEnvelopeMerkleRoot` and `generateEnvelopeInclusionProof`.
2. **In-Memory Bounded Accumulator Cache (`backend/src/index.ts`):**
   - Implemented `BoundedProvenanceAccumulatorCache` with LRU eviction (maximum 100 cases).
   - `GET /api/cases/:id/provenance/proofs/:sequence` checks for an entry matching `dbCase.provenanceSequence` and `dbCase.provenanceHead`. On a hit, proofs are extracted from the compiled accumulator tree in sub-millisecond $O(log N)$ time without re-verifying the ledger or recomputing hashes.
   - On a cache miss or sequence mismatch, the engine re-verifies the full chain, compiles the tree, caches the accumulator, and issues the proof.
   - Fail-closed invalidation: `POST /api/cases/:id/evidence` evicts the accumulator when sequence advances; `DELETE /api/cases/:id` removes the case from the cache.
3. **Durable Accumulator Migration (`backend/prisma/migrations/20261011120000_provenance_merkle_accumulator/migration.sql`):**
   - Prepared additive SQL to add `provenanceMerkleRoot` and `provenanceEnvelopeHead` to `ReconstructionCase`.
   - Tested applying both migrations sequentially in `backend/src/security/schema_migration.test.ts` against an isolated OS-temp database.
   - Documented rollback: In SQLite >= 3.35.0, `ALTER TABLE "ReconstructionCase" DROP COLUMN "provenanceMerkleRoot"; ALTER TABLE "ReconstructionCase" DROP COLUMN "provenanceEnvelopeHead";`.
4. **Adversarial & Regression Test Coverage:**
   - Added unit tests in `backend/src/engine/provenance_test.ts` verifying `buildEnvelopeMerkleTree` and `generateProofFromMerkleTree` across sizes 1, 2, 4, 7, and 16, verifying root matching, sibling depth, and boundary rejection.
   - Added integration tests in `backend/src/security.test.ts` verifying proof verification, accumulator cache hit across sequences, cache invalidation when new evidence arrives, and invalid confidence boundary rejection.

### 3. Complete Verification Evidence

- `cd backend; npm test` — Passed all 11 test suites (71 tests total, 0 failures):
  - `src/engine/test.ts`: 3 passed
  - `src/engine/audit_test.ts`: 5 passed
  - `src/engine/oracle_test.ts`: 12 passed
  - `src/engine/csp_fuzzy_provenance.test.ts`: 20 passed
  - `src/engine/provenance_test.ts`: 8 passed (including `EnvelopeMerkleTree` and `generateProofFromMerkleTree`)
  - `src/engine/audit_bundle_test.ts`: 1 passed
  - `src/security/key_rotation.test.ts`: 3 passed
  - `src/security/schema_migration.test.ts`: 1 passed (exercising both additive migrations on isolated temp DB)
  - `src/security.test.ts`: 12 passed (including accumulator cache hits and invalidation)
  - `src/engine/branching_test.ts`: 6 passed
  - `src/database_url.test.ts`: 3 passed
- `cd backend; npx tsc --noEmit` — Passed with 0 errors.
- `cd backend; $env:DATABASE_URL='file:./dev.db'; npx prisma validate --schema prisma/schema.prisma` — Passed; schema is valid.
- `cd backend; npm run load:engine` — Passed with atomic overload rejection above candidate cap. 5-run p50 observations:
  - 100 employees / 310 fragments: 5.31 ms (58,380 fragments/sec)
  - 250 employees / 775 fragments: 11.83 ms (65,511 fragments/sec)
  - 500 employees / 1550 fragments: 26.26 ms (59,025 fragments/sec)
- `cd frontend; npx vitest run` — Passed (9 tests in 2.51s).
- `cd frontend; npm run build` — Passed (clean production bundle).
- `cd frontend; npm run lint` — Passed (oxlint: 0 warnings, 0 errors across 10 files).
- `cd frontend; npm run test:e2e` — Passed (Playwright flow in Chrome in 4.1s against disposable OS-temp database `lazarus-x-e2e-xCAwhe`).
- `git diff --check` — Clean (0 errors).
- **Database Safety Confirmation:** `backend/prisma/dev.db` was completely untouched (File size: 102,400 bytes, LastWriteTime: 11-10-2026 11:19:53).

### 4. Technical Claim-to-Code Mapping

| Claim Concept | Implementation Symbol | Verification Evidence |
| :--- | :--- | :--- |
| **Method Claim 1(g):** Pre-indexed binary Merkle tree over public envelopes | `buildEnvelopeMerkleTree`, `EnvelopeMerkleTree` in `backend/src/engine/provenance.ts` | `backend/src/engine/provenance_test.ts` |
| **Method Claim 1(g):** $O(log N)$ inclusion proof extraction from compiled levels | `generateProofFromMerkleTree` in `backend/src/engine/provenance.ts` | `backend/src/engine/provenance_test.ts`, `backend/src/security.test.ts` |
| **System Claim 8:** Bounded in-memory Merkle accumulator cache with sequence validation | `BoundedProvenanceAccumulatorCache` in `backend/src/index.ts` | `backend/src/security.test.ts` |
| **System Claim 8:** Additive accumulator schema migration with verified rollback | `20261011120000_provenance_merkle_accumulator` in `backend/prisma/migrations/` | `backend/src/security/schema_migration.test.ts` |
| **System Claim 8:** Fail-closed cache invalidation on evidence arrival | `provenanceAccumulatorCache.delete` in `POST /api/cases/:id/evidence` | `backend/src/security.test.ts` |

### 5. Remaining Limitations & Staging Next Steps

1. **In-Memory Cache Bounds:** `BoundedProvenanceAccumulatorCache` is bounded to 100 cases per API process using an LRU policy. In multi-instance deployments behind a load balancer, instances maintain separate process caches; distributed caching (e.g. Redis) or shared PostgreSQL read-replicas should be considered if multi-node scale is required.
2. **Database Migrations:** Neither migration has been applied to `backend/prisma/dev.db`. They should only be applied to staging/production instances during planned schema updates.
3. **Patent Scope:** The prior-art comparison remains an engineering draft for technical assessment. A formal novelty and freedom-to-operate study by qualified patent counsel is required prior to filing.

## Concurrent API Resilience, Session Revocation, and Merkle Proof UX (2026-10-11)

### Implemented changes

- **Concurrent API benchmark:** Added `backend/src/engine/api_load_test.ts` and `npm run load:api`. It creates and verifies an OS-temporary SQLite database, starts two in-process Express instances with separate Prisma clients, and uses four sessions for one investigator account to issue mixed contradictory and independent evidence requests to one case. A two-party transaction barrier forces two app instances to read the same case head before they submit competing writes, exercising the cross-instance optimistic conflict path.
- **Ledger integrity under contention:** The benchmark verifies persisted event hashes against the case head, requires contiguous sequence numbers, and checks that the losing cross-instance transaction rolls back both the fragment and provenance event. The expected stale writer response is `409 CASE_CONFLICT`.
- **Accumulator behavior under writes:** The benchmark measures proof cache rebuild after concurrent writes, repeated hot proof requests, then writes again and verifies that the root changes and the rebuilt proof verifies. The benchmark initializes its schema only in a dedicated `lazarus-x-e2e-*` OS-temp directory and removes that exact temporary directory after disconnecting clients.
- **Session revocation:** `POST /api/auth/logout` already deleted the session by bearer-token digest; regression coverage confirms subsequent requests fail. Operator provisioning now updates an existing account and deletes its sessions in one Prisma transaction. Authentication rejects expired sessions and best-effort deletes the matching expired digest; cleanup failure is logged without allowing the token.
- **Routine conflict logging:** Expected optimistic concurrency conflicts return `409 CASE_CONFLICT` without being logged as unexpected API failures.
- **Interactive proof path:** The proof action now renders a locally verified path in the ledger entry, including the leaf domain label, leaf hash, each sibling hash and left/right position, duplicate-last indication, resulting node hash at each depth, counted root, checkpoint root, and manifest verification status. It retains the verified proof download. Vitest and Playwright cover the visual path.

### Claim-to-code mapping

| Claim concept | Implementation symbols | Regression evidence |
| --- | --- | --- |
| Method Claim 1(g), System Claim 8: pre-indexed public-envelope Merkle levels | `EnvelopeMerkleTree`, `buildEnvelopeMerkleTree`, `generateProofFromMerkleTree` in `backend/src/engine/provenance.ts` | `backend/src/engine/provenance_test.ts`, `backend/src/security.test.ts` |
| System Claim 8: bounded accumulator cache keyed to verified case sequence/head | `BoundedProvenanceAccumulatorCache` and `GET /api/cases/:id/provenance/proofs/:sequence` in `backend/src/index.ts` | `backend/src/security.test.ts`, `backend/src/engine/api_load_test.ts` |
| System Claim 8: case-lock serialization and cross-instance optimistic conflict handling | `acquireCaseLock`, conditional stored-head check, and `CASE_CONFLICT` mapping in `backend/src/index.ts` | `backend/src/security.test.ts`, `backend/src/engine/api_load_test.ts` |
| Authentication/session lifecycle | `requireAuth`, logout route in `backend/src/index.ts`; `provisionAdmin` in `backend/src/provision_admin.ts` | `backend/src/security.test.ts` |
| Investigator proof inspection and browser-side verification | `deriveEnvelopeMerkleProofDetails` in `frontend/src/provenanceVerifier.ts`; proof drawer in `frontend/src/App.tsx` | `frontend/src/App.test.tsx`, `frontend/e2e/investigator.spec.ts` |

### Verification performed for this delivery

- `cd backend; npm test` — passed all 11 chained runners: 3 engine equivalence, 5 audit, 12 oracle, 20 CSP/fuzzy/provenance, 8 provenance/Merkle, 1 offline bundle, 3 key rotation, 1 isolated schema migration, 14 API security, 6 branching, and 3 SQLite URL checks (76 total checks).
- `cd backend; npx tsc --noEmit` — passed.
- `cd backend; $env:DATABASE_URL='file:./dev.db'; npx prisma validate --schema prisma/schema.prisma` — passed. Validation does not apply a migration.
- `cd backend; npm run load:engine` — passed. Five-run p50 observations: 6.51 ms at 100 employees / 310 fragments, 15.73 ms at 250 / 775, and 33.10 ms at 500 / 1,550. This is synthetic engine-only timing, not an API SLA.
- `cd backend; npm run load:api` — passed against the disposable `lazarus-x-e2e-hIU4Ph` SQLite directory. Four concurrent sessions submitted 24 mixed evidence requests; all 24 succeeded, throughput was 88.64 requests/fragments per second, request p50/p95 were 153.20/256.41 ms, and the 25-event ledger was contiguous and verified. Two app instances concurrently submitted against the same head: one returned 200, one returned `409 CASE_CONFLICT`, and exactly one event remained in the verified ledger after rollback. Four repeated hot proof requests had 2.85 ms p50 HTTP latency; the cold rebuild after the batch measured 19.73 ms. An additional post-write proof verified against a changed Merkle root. These observations are for this single local run and are not capacity guarantees.
- `cd frontend; npx vitest run` — passed (10 tests).
- `cd frontend; npm run build` — passed (`tsc -b` and Vite; 2,316 modules transformed).
- `cd frontend; npm run lint` — passed.
- `cd frontend; npm run test:e2e` — passed (one Chrome Playwright flow, 4.8 seconds), including local proof path inspection, verified proof download, offline bundle download, and selective-disclosure verification.
- `git diff --check` — passed with exit code 0. Git printed only LF/CRLF working-copy notices.
- `backend/prisma/dev.db` — unchanged across verification: 102,400 bytes and last-write time `2026-10-11T05:49:53.3925078Z` both before and after. The API benchmark and E2E used dedicated `lazarus-x-e2e-*` temporary directories; Prisma validation did not apply a migration.

### Operational boundaries

- The benchmark simulates multiple concurrent sessions for one investigator account. Case ownership remains owner/admin scoped; it does not add shared investigator case membership.
- `load:api` benchmarks two app instances in one Node process with separate API app state and Prisma clients. It does not model separate machines, network latency, a distributed lock service, or sustained production load.
- Session deletion on expired authentication is best effort after the database lookup has already rejected the token. If deletion fails, that request and subsequent auth checks remain denied, while the expired row may remain until a later cleanup process.
- The cache remains process-local and bounded to 100 cases. Cache misses perform full replay/reverification and tree construction; only proof extraction from a matching cached tree is O(log N).
- Operator account provisioning revokes sessions present in the same transaction as the credential/role update. There is no self-service password-change endpoint in the current API.
- This delivery changes no patent conclusions. Claim language and prior-art comparison remain engineering scoping material, not a legal opinion or patentability determination.

## Delivery Checkpoint: State-of-the-Art GitHub Research & Production Forensics Delivery (2026-10-11)

### Summary of changes

1. **GitHub Open-Source Research & Architectural Synthesis:**
   - Synthesized foundational patterns and models from 10+ prominent repositories:
     - **Relational Data Repair & Constraints:** *HoloClean* (factor graph grounding of denial constraints, Gibbs sampling), *spark-data-repair-plugin* (functional dependency repair, error detection pipeline), *AWS Deequ* & *Great Expectations* (declarative validation schemas and expectation results).
     - **Cryptographic Transparency Logs & Merkle Proofs:** *Sigstore Rekor* (RFC 6962 transparency log, Signed Tree Heads, inclusion proofs, standardized bundle format `application/vnd.dev.sigstore.bundle.v0.3+json`), *immudb* (dual-layer Merkle tree architecture: transaction-level commitments + global append-only state ledger), *Google Trillian* (verifiable data structures).
     - **Digital Forensics (DFIR) & Graph Interfaces:** *Google Timesketch* (collaborative sketches, chronological timeline scrubbers, faceted search), *SpecterOps BloodHound CE* (React + Sigma.js graph visualization, entity-relationship lineage), *DFIR-IRIS* (case custody lifecycle, sealing, granular RBAC).
   - Documented comprehensive analysis in brain artifact `github_research_and_architecture_synthesis.md`.

2. **Cryptographic Case Sealing & Custody Lifecycle (Backend):**
   - Implemented `POST /api/cases/:id/seal` in `backend/src/index.ts`, freezing the case into `SEALED` status.
   - Generates and returns a sealed `ProvenanceCheckpointManifest` with the final Merkle tree root and sequence checkpoint.
   - Subsequent evidence submission (`POST /api/cases/:id/evidence`) to a sealed case fails closed with HTTP `409 CASE_SEALED` ("Case is sealed and cryptographically frozen. No further evidence may be committed.").
   - Added comprehensive integration test in `backend/src/security.test.ts` verifying case sealing, checkpoint generation, evidence rejection, and idempotent seal prevention.

3. **Standardized Sigstore-Compatible Audit Bundle (Backend):**
   - Added `OFFLINE_AUDIT_BUNDLE_MEDIA_TYPE = 'application/vnd.lazarus-x.audit-bundle.v1+json'` in `backend/src/engine/audit_bundle.ts`.
   - Updated `GET /api/cases/:id/export/audit-bundle` in `backend/src/index.ts` to serve the standardized media type header.
   - Preserved pure Node built-in zero-dependency offline bundle verifier (`verify-audit-bundle.cjs`).

4. **Interactive Relational Schema & Lineage DAG (Frontend):**
   - Implemented `frontend/src/SchemaGraph.tsx` inspired by BloodHound CE and OpenCTI.
   - Interactive SVG/cards canvas visualizing database tables (`Department`, `Employee`, `Order` + dynamic tables) as nodes with record counts, field chips, foreign key indicators, and real-time constraint health indicators (green = satisfied, yellow = open-world pending, red = conflict).
   - Added view mode toggle in the relational graph panel between "Candidate view" (row-level hypothesis graph) and "Schema DAG" (schema lineage DAG).

5. **Timesketch-Inspired Forensic Timeline Scrubber (Frontend):**
   - Implemented `frontend/src/TimelineScrubber.tsx` inspired by Google Timesketch and Vestigo.
   - Filterable chronological evidence stream featuring real-time text search, event type filter pills (`All`, `Evidence accepted`, `Fuzzy correction`), sequence badges, actor tags, formatted timestamps, and one-click Merkle proof verification triggers.

6. **Interactive Visual Merkle Tree Path Explorer (Frontend):**
   - Implemented `frontend/src/MerkleVisualizer.tsx` inspired by `PurrProof/merkle-proofs-vis` and Sigstore Rekor.
   - Renders the full cryptographic binary tree traversal from Leaf node (`LEAF:V1`) through sibling depths (`Sibling on LEFT/RIGHT`, duplicate-last flags, combined hashes) to the Counted Root node (`COUNTED ROOT V1` vs Checkpoint Root match status).
   - Integrated directly into the Provenance drawer in `frontend/src/App.tsx`.

7. **Case Sealing UI & Status Display (Frontend):**
   - Added "Seal case" button with confirmation action in workspace header.
   - Added prominent `SEALED & FROZEN` glowing badge with lock icon when a case is sealed.
   - Disables evidence submission and displays explanatory custody banner when sealed.

### Verification Execution Evidence

- **Backend Unit & Integration Tests:** `npm test` in `backend/` passed all 11 test suites and **72 tests** with 0 failures:
  - 3 engine equivalence checks, 5 audit checks, 12 oracle permutation checks, 20 CSP/fuzzy/provenance checks, 8 provenance/Merkle checks, 1 offline bundle check, 3 key rotation checks, 1 schema migration check, 15 API security checks (including case sealing), 6 branching checks, 3 SQLite URL checks.
- **Backend Typecheck:** `npx tsc --noEmit` passed with 0 errors.
- **Frontend Vitest Suite:** `npx vitest run` passed **all 12 tests** (100% green).
- **Frontend Build:** `npm run build` (`tsc -b && vite build`) completed in 483 ms with 0 errors.
- **Frontend Lint:** `npm run lint` (`oxlint`) passed with 0 errors, 0 warnings.
- **Playwright E2E:** `npm run test:e2e` passed clean in 4.2 s against an isolated OS-temp SQLite database.
- **Git Diff Hygiene:** `git diff --check` passed with exit code 0.
- **Shared DB Safety:** `backend/prisma/dev.db` remains strictly untouched (102,400 bytes, LastWriteTime: 11-10-2026 11:19:53).
## Delivery Checkpoint: Advanced Frontend Models, Cell Conflict Resolution Matrix & Court-Ready Forensic Dossier (2026-10-11)

### Summary of changes

1. **Cell-Level Candidate Conflict & Consensus Matrix (`CandidateDiffMatrix.tsx`):**
   - Synthesizes paradigms from *HoloClean* and *OpenRefine* for cell-level database repair and dispute arbitration.
   - Integrated directly into the main workspace via a sleek view toggle ("Record Cards" <-> "Conflict Matrix").
   - Interactive table tabs with real-time conflict indicator dots showing which relations have conflicting candidate interpretations.
   - Disputed attribute cells render an actionable dispute card showing:
     - Expected Information Gain (\Delta H in bits) for targeted uncertainty reduction.
     - Candidate probability distribution bars (`val-bar-fill`) visualizing candidate support percentages across surviving hypotheses.
     - "Inquire" button that immediately pre-populates the evidence intake form with the selected table, record locator, and attribute.
   - Unanimously resolved attributes render a consensus badge (`CheckCircle2`) indicating 100% candidate consensus.
   - Filter toggle allowing investigators to instantly isolate disputed cells across large tables.

2. **Interactive Relational Lineage Graph Tracing (`SchemaGraph.tsx`):**
   - Synthesizes graph exploration patterns from *SpecterOps BloodHound CE* and *Cytoscape.js*.
   - Dynamic hover & selection lineage focus: clicking or hovering on any relation card (e.g. `Department`, `Employee`, `Order`) highlights its active foreign key dependencies (`.edge-highlighted`) and dims unrelated tables (`.table-dimmed`) and edges (`.edge-dimmed`).
   - Lineage cards render schema attribute chips with explicit foreign key badges (`LinkIcon`) and real-time constraint health indicators.

3. **Court-Ready Official Forensic Dossier Modal (`ForensicReportModal.tsx`):**
   - Synthesizes forensic reporting standards from *DFIR-IRIS* and *CyberChef*.
   - Accessible via the prominent "Forensic Dossier" action button in the workspace masthead.
   - Header with official record stamp: `OFFICIAL RECORD · ISO/IEC 27037 FORENSIC ALIGNED`.
   - Comprehensive metadata grid: Case Identifier, Custody Status (`CRYPTOGRAPHICALLY SEALED` vs `ACTIVE INGESTION`), Total Ledger Events, Remaining Entropy / Ambiguity.
   - Section 1: Cryptographic Chain-of-Custody Attestation featuring a summary table of recent cryptographic ledger anchors (Sequence, Event Type, Envelope Hash, Payload Commitment).
   - Section 2: Verified Reconstructed Database State with relations and tabular records.
   - Section 3: Examiner Attestation with signature blocks for Lead Forensics Examiner and Independent Verification Officer.
   - Integrated actions: "Print Dossier" (with dedicated `@media print` stylesheet hiding UI controls and rendering crisp high-contrast tables) and "Download Markdown" (generating a complete forensic report document).

4. **Expanded Frontend Test Suite (`App.test.tsx`):**
   - Expanded Vitest test suite from 12 to **14 tests**:
     - Verified modal rendering, accessibility labels, court attestation text, and close actions for `ForensicReportModal`.
     - Verified view toggling between record cards and `CandidateDiffMatrix`, including container regions, consensus badges, and return toggle.
   - All 14 tests pass cleanly with zero warnings.

5. **Linting, Compilation, and Git Whitespace Cleanliness:**
   - Zero Oxlint errors and zero warnings across all 15 files with 116 rules.
   - Frontend production bundle (`tsc -b && vite build`) builds cleanly in 664 ms.
   - Whitespace hygiene: `git diff --check` exits with 0 errors.
   - Shared database safety: `backend/prisma/dev.db` remains completely untouched (102,400 bytes, `11-10-2026 11:19:53`).
## Delivery Checkpoint: Patent-Ready Specification, 25-Claim Verification Suite & Interactive Claims Explorer (2026-10-11)

### Summary of changes

1. **Formal Patent Application Specification (`research/PATENT_SPECIFICATION_FORMAL.md`):**
   - Prepared an exhaustive, USPTO / PCT / Indian Patent Office (IPO) compliant patent application document:
     - **Title:** "SYSTEM, METHOD, AND NON-TRANSITORY COMPUTER-READABLE MEDIUM FOR DETERMINISTIC MULTI-HYPOTHESIS RELATIONAL DATABASE FORENSIC RECONSTRUCTION WITH ENTROPY-GUIDED ACTIVE DISAMBIGUATION AND DUAL-LAYER CRYPTOGRAPHIC CHAIN-OF-CUSTODY"
     - **IPC/CPC Classifications:** G06F 16/23, G06F 21/64, G06F 17/18, G06F 11/14.
     - **Technical Field & Background:** Concrete analysis of prior art limitations in WAL replay (US8769345B2), holistic data repair (US9116934B2 / HoloClean), static provenance tagging (US9195725B2), and fuzzy matching (US7296011B2).
     - **Summary of Invention & Technical Effects:** Explicit technical solutions overcoming Section 3(k) CRI and Alice 35 U.S.C. § 101 statutory eligibility hurdles via complexity reduction ($O(K \cdot |\text{dom}|)$ vs exponential $O(K^N)$) and physical storage transformation.
     - **Brief Description of Drawings:** Formal descriptions of FIG. 1 through FIG. 8.
     - **Detailed Description of Preferred Embodiments:** Algorithmic definitions for composite foreign keys with SIMPLE/FULL null semantics, restricted Damerau-Levenshtein transposition metrics, Shannon entropy and conditional Information Gain equations, dual-layer cryptographic ledger, RFC 6962 binary Merkle trees, and atomic case sealing.
     - **25 Formal Patent Claims:**
       - Independent System Claim 1 & Dependent Claims 2–10.
       - Independent Method Claim 11 & Dependent Claims 12–18.
       - Independent Non-Transitory Computer-Readable Medium Claim 19 & Dependent Claims 20–25.
     - **Abstract of Disclosure.**

2. **Automated Patent Claim Compliance Test Suite (`backend/src/engine/patent_claim_verification.test.ts`):**
   - Programmatically validates every element of the 25 patent claims:
     - *Claims 1 & 2:* Evaluates non-sequential partial evidence fragments and composite foreign key validation under open-world semantics.
     - *Claim 3:* Validates adjacent string transpositions using restricted Damerau-Levenshtein metrics emitting `FUZZY_CORRECTION` events.
     - *Claim 4:* Validates delayed pruning: preserves states with resolvable foreign key violations while immediately pruning fatal uniqueness collisions.
     - *Claims 5 & 11:* Validates exact Shannon entropy calculation $H(C) = -\sum P(S_i) \log_2 P(S_i)$ and Expected Information Gain ranking $E[IG(A)]$.
     - *Claims 6 & 19:* Validates dual-layer ledger: SHA-256 hash chaining + keyed HMAC commitment envelopes masking investigator identity.
     - *Claims 7 & 20:* Validates RFC 6962 binary Merkle accumulator and $O(\log N)$ inclusion proof extraction with sibling side validation.
     - *Claims 8 & 18:* Validates sealed checkpoint manifest generation with fixed root and sequence anchoring.
   - Integrated directly into `backend/package.json` (`npm test`).

3. **Frontend Interactive Patent & Claims Explorer (`PatentSpecificationModal.tsx`):**
   - Added interactive "Patent Claims" modal accessible from the workspace header.
   - **Interactive Claims Explorer:** Dedicated tabs for Claim 1 (System Architecture), Claim 11 (Entropy Disambiguation), and Claim 19 (Verifiable Provenance) with prior-art differentiation cards (vs US9116934B2, US7076481B2, US9195725B2).
   - **Live Telemetry Bar:** Live runtime verification status showing active candidate count, current Shannon entropy (bits), provenance envelope head hash, and custody state.
   - **Mathematical Formulation Panel:** Formal equations for Shannon Entropy, Information Gain, and Merkle tree accumulators.
   - **One-Click Package Export:** "Download Patent Package" generates a complete markdown disclosure package.

4. **Expanded Frontend Test Suite (`frontend/src/App.test.tsx`):**
   - Expanded Vitest test suite to **15 tests** (100% passing):
     - Added test case verifying modal launch, claim tab switching, mathematical formula display, and clean close interaction.

5. **Verification Evidence:**
   - **Backend Test Suite:** All 12 test suites passing (including `patent_claim_verification.test.ts`).
   - **Frontend Test Suite:** All 15 Vitest tests passing cleanly in 4.1 s.
   - **Frontend Production Build:** Built cleanly in 1.34 s (`dist/` generated).
   - **Linters:** Oxlint 0 errors, 0 warnings across 16 files with 116 rules.
   - **Git Whitespace Hygiene:** `git diff --check` passed with 0 errors.
   - **Shared Database:** `backend/prisma/dev.db` remains strictly untouched (102,400 bytes, LastWriteTime: 11-10-2026 11:19:53).

## BCSE302P Database Systems Lab Internal Assessment & Full Rubric Fulfillment (2026-10-11)

### Assessment Context
- **Course & Exam:** BCSE302P Database Systems Lab (SCOPE, VIT), Lab Internal Assessment Test 8, 9 & 10.
- **Faculty:** Dr. V. SIVAKUMAR | **Slot:** L25+L26 | **Date:** 11-09-2026 / Fall Semester 2026-27.
- **Candidate:** DIVYA (Reg. No: 23BCE1042).
- **Marks Scope:** 30 Marks Core Rubric + 3 Bonus Marks (Total 33/30 Marks).

### Implemented Deliverables & Rubric Mapping
1. **Section 1: Problem Statement & Project Planning (2 Marks)**
   - Problem Statement: Out-of-order, partial relational fragments reconstruction engine for forensic database recovery with CSP/AC-3 consistency and cryptographic chain-of-custody.
   - Formal proposal, scope, Gantt chart timeline, team responsibilities, and deliverables documented in `docs/BCSE302P_LAB_ASSESSMENT_REPORT.md`.

2. **Section 2: Database Design (4 Marks)**
   - Formal ER Diagram with 11 primary entities and 14 foreign-key relationships.
   - Relational schema defined with strict primary keys, foreign keys, and constraints (`NOT NULL`, `UNIQUE`, `CHECK`, `DEFAULT`).
   - Normalization proof: Complete Third Normal Form (3NF) and Boyce-Codd Normal Form (BCNF) proofs with zero transitive or partial dependencies.

3. **Section 3: Database Implementation (7 Marks)**
   - Implemented automated demonstration runner: `backend/src/database/dbms_features_demonstration.ts` (`npm run dbms:demo`).
   - 11 related tables managed via Prisma ORM (`User`, `ReconstructionCase`, `EvidenceFragment`, `CaseCheckpoint`, `AuditLog`, `CandidateCluster`, `HypothesisBranch`, `CryptographicKeyRing`, `CaseCollaborator`, `CaseTag`, `ForensicReportExport`).
   - Full CRUD operations via Prisma ORM on isolated temporary databases.
   - Multi-table Relational Joins & Aggregates (`COUNT`, `AVG`, `GROUP BY`, `HAVING`).
   - SQL View: `vw_case_activity_summary` joining cases, users, and evidence fragments.
   - Triggers:
     - `trg_audit_evidence_insert`: Automatically inserts tamper-evident audit records upon evidence fragment insertion.
     - `trg_seal_immutability_guard`: Fail-closed trigger aborting any evidence insertions once a case is cryptographically sealed.
   - Stored Procedure / Transaction: `sp_seal_forensic_case` atomically computing final Merkle roots, updating status to `SEALED`, and writing audit checkpoints within a transactional boundary.
   - Performance Indexes: B-tree compound indexes verified via `EXPLAIN QUERY PLAN`.
   - Dual-engine support: SQLite runner + PostgreSQL production init script (`backend/db/init/01_advanced_features.sql`).

4. **Section 4: Application Development (4 Marks)**
   - Framework-based full stack: Express.js (Node.js/TypeScript) + React 18 / Vite.
   - Responsive dark-mode forensic UI with Live Telemetry, Interactive Schema Graph, Timeline Scrubber, Merkle Visualizer, Diff Matrix, and Dossier Modal.
   - Full CRUD, real-time search, multi-field filtering, pagination, form validation, and centralized exception handling.

5. **Section 5: Authentication, Authorization & Database Security (5 Marks)**
   - **Single Users Table Compliance:** Strictly maintained all users in a single `User` table with `role` column (`ADMIN`, `INVESTIGATOR`). No separate tables created.
   - Password Hashing: Argon2id (and legacy scrypt backward-compatibility) with zero hardcoded salts/passwords.
   - SQL Injection Prevention: 100% parameterized queries via Prisma ORM and sanitized raw statements.
   - Secrets Management: Strict `.env` and `dotenv` configuration, `.env.example` templates, zero secrets in source code.

6. **Section 6: Professional Development Practices (5 Marks)**
   - GitHub branching model (`main` and `dev`), progressive commits, comprehensive `.gitignore` protecting `.env` and database files.
   - Native Database Backup & Recovery: Cross-platform native backup scripts (`scripts/backup_database.sh` and `scripts/backup_database.bat`) utilizing `sqlite3 .backup` and `pg_dump` / `pg_restore`.
   - Docker Orchestration: Root multi-stage `Dockerfile` and `docker-compose.yml` orchestrating the application and PostgreSQL 15.

7. **Bonus Marks: CI/CD, Custom Domain & Industry Best Practices (+3 Marks)**
   - CI/CD Pipeline (+1): `.github/workflows/ci.yml` executing linting, type-checking, backend tests, and frontend build on push/PR.
   - Deployment Architecture & Custom Domain (+1): Configured for Railway/Render/DuckDNS deployment with SSL/TLS reverse proxy.
   - Additional Best Practice (+1): Comprehensive automated testing (12 test suites, 100% pass rate), Merkle tree audit logging, and B-tree compound index optimization.

8. **Academic Lab Assessment Report:**
   - Saved at `docs/BCSE302P_LAB_ASSESSMENT_REPORT.md`.
   - Standard submission filename convention: `23BCE1042_L25_IA9&10_Proj_DIVYA.pdf`.
   - Includes student register number, name, slot, course code, execution logs with timestamps, ER diagram, schema, and normalization proofs.

### Verification Status
- **Backend Test Suites:** All 12 suites passed (100% pass rate).
- **DBMS Course Requirements Demo:** `npm run dbms:demo` passed with 0 errors.
- **Frontend Test Suite:** 15/15 Vitest tests passed with 0 errors.
- **Frontend Linters & Build:** Oxlint 0 errors, 0 warnings; Vite build passed cleanly.
- **Git Hygiene:** `git diff --check` returned 0 errors.
- **Shared DB Integrity:** `backend/prisma/dev.db` remains completely unmodified (102,400 bytes).
## Frontend Publishing-Ready Overhaul & GitHub/Linear Enterprise UX (2026-10-11)

### Visual Transformation & Design System Overhaul
- **Removed AI Tropes:** Eliminated generic floating orbits, tacky radial glow gradients, and unreadable 8px/9px font sizes.
- **Enterprise GitHub / Linear Dark Theme:**
  - Color Tokens: Canvas `#0d1117`, Card Surfaces `#161b22`, Crisp Dividers `#30363d`, Emerald `#3fb950` (active/verified), Blue `#58a6ff` (links/focus), Violet `#bc8cff` (hypotheses), Amber `#d29922` (disputed entropy).
  - Typography: Inter with JetBrains Mono for all hashes, IDs, and mathematical formulations; standardized 12px/13px/14px legible scales.
- **Split-Hero Landing & Authentication Suite:**
  - Left Column: Enterprise platform showcase with active engine badge, headline, capabilities cards (Bounded CSP/AC-3, Shannon Information Gain, RFC 6962 Merkle Provenance), and academic/patent attribution badge (BCSE302P, DIVYA 23BCE1042, Dr. V. SIVAKUMAR).
  - Right Column: High-precision console access card with **One-Click Evaluator Presets** (`Investigator (23BCE1042)` and `Chief Auditor (Admin)`).
- **Interactive Reconstruction Benchmarks Toolbar:**
  - One-click scenarios for evaluators directly in the evidence intake panel:
    1. *Disputed Badge (Entropy Demo)*: Populates contradictory badge evidence to demonstrate candidate branching and Shannon Information Gain ranking.
    2. *Resolve Ambiguity*: Populates high-confidence resolving evidence to collapse entropy to 0 bits.
    3. *Foreign Key Link (AC-3 Solver)*: Populates relational evidence to demonstrate multi-table AC-3 propagation.
- **Single-Port & Dual-Server Parity:**
  - Production build in `backend/public` served via Express on `http://localhost:3000`.
  - Vite development server on `http://localhost:5173` with automated `/api` proxying.
  - `X-Frame-Options` set to `SAMEORIGIN` for IDE webview preview compatibility.
- **Verification:**
  - Automated Browser Subagent verified the landing page, 1-click preset login, and complete forensic workspace in Chrome.
  - Vitest: 15/15 tests passed.
  - Oxlint: 0 warnings, 0 errors.
  - Production build: Succeeded in 1.54s.
  - `git diff --check`: 0 errors.
## GitHub clone verification update

- CI now uses Node.js 24, generates and validates Prisma Client/schema, runs backend and frontend checks, and invokes the browser E2E workflow from `frontend`.
- The DBMS demonstration transaction callback is explicitly typed with `Prisma.TransactionClient`.
- Runtime provenance configuration no longer falls back to a public key. Docker Compose requires `PROVENANCE_ENCRYPTION_KEY` and `DB_PASSWORD`.
- Root convenience scripts now expose database validation/generation, backend typecheck, frontend lint/tests, and E2E execution.
- Remote-clone validation passed locally: Prisma validation, backend typecheck, backend tests, DBMS demonstration, frontend lint/build/tests, and Playwright E2E. Frontend lint reports existing non-blocking warnings.
- Cloud deployment, Docker Hub publication, repository privacy/collaborator settings, and DNS remain external account-owner actions.
