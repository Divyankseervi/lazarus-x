# PROJECT_CONTEXT

## Purpose and Architecture

LAZARUS-X reconstructs relational data from incomplete, contradictory, corrupted, or out-of-order evidence. The engine stores observed scalar domains, applies bounded constraint propagation, then exhaustively materializes interpretations while enforcing work limits. Candidate scores and ambiguity measurements use heuristic weights; they are not calibrated probabilities.

- **Frontend:** React 19, Vite, Tailwind CSS, Framer Motion, Lucide React.
- **Backend:** Node.js, Express 5, TypeScript.
- **Database/ORM:** SQLite and Prisma 5.11.0.
- **Core files:** `backend/src/engine/lazarus.ts`, `backend/src/engine/provenance.ts`, `backend/src/index.ts`, `frontend/src/App.tsx`, and `backend/prisma/schema.prisma`.

The Prisma schema defines the auth/system tables (`User`, `Session`, `AuditLog`), reconstruction tables (`ReconstructionCase`, `EvidenceFragment`, `EvidenceProvenanceEntry`, `CandidateReconstruction`, `ConstraintEvaluation`), and target data tables (`Department`, `Employee`, `Order`). The repository also documents a SQL view and audit trigger used by its database exercise.

## Engine Semantics and Limits

- AC-3 propagates pairwise UNIQUE disequality, NOT_NULL, and foreign-key support before enumeration. Foreign-key pruning remains opt-in with `targetEvidenceComplete: true`; by default, parent evidence is open-world and may arrive later. Foreign keys accept scalar `field`/`targetField` pairs or ordered composite `fields`/`targetFields` arrays. Composite keys require support from the same target row and support SQL-style `SIMPLE` (default) or `FULL` null matching.
- Propagation is monotone over finite domains, so self-references and cycles terminate at a fixed point or a configured work limit. A detected contradiction restores the source domains for violation scoring.
- If propagation finds a contradiction, the engine retains the original evidence domains and ranks resulting violations instead of erasing all candidates. AC-3 is sound local propagation, not a complete CSP solver.
- Fuzzy string comparison uses bounded restricted Damerau-Levenshtein / optimal-string-alignment distance (adjacent transpositions cost one; default 1, configurable 0–4, up to 256 Unicode code points) and a shared work budget. This is not unrestricted Damerau-Levenshtein. The `exp(-editDistance)` model and entropy penalties are explanatory heuristics, not calibrated likelihoods.
- Evidence may carry investigator-assessed `confidence` in `(0, 1]`; omitted values default to `1.0`. An explicitly supplied value is committed into the accepted evidence payload and replayed; absent legacy values retain the `1.0` default. Candidate ranking adds a normalized dissenting-confidence penalty, so candidate weights and entropy-driven probe rankings respond to the confidence inputs. This is a user-supplied heuristic, not an authenticated source credential or calibrated probability.
- Search remains exponential in the surviving domain product. Default bounds include 10,000 candidates, 1,000,000 materialization units, 10,000 evidence items per batch, 100,000 propagation revisions, 1,000,000 fuzzy/constraint comparison units, and 100,000 provenance events / 64 MiB total / 64 KiB per event. The API rejects over-limit writes atomically.
- The engine can select only values present in evidence; it does not infer a value absent from all fragments without additional priors.

## API Security and Operations

- `CORS_ORIGINS` is a comma-separated exact origin allowlist. Production with this unset denies cross-origin browser access. Same-origin and non-browser clients still work.
- Auth routes are limited to 10 requests per IP per 15 minutes; write operations are limited to 120 per minute in each process. JSON request bodies are capped at 1 MiB. These in-memory limits and case locks do not coordinate across Node workers; multi-instance deployment needs a shared gateway/store and a single-writer strategy.
- Public registration creates INVESTIGATOR users only. Roles are validated at authentication; case access is owner-scoped, and deletion is admin-only. Passwords use bcrypt (12–72 UTF-8 bytes) for new accounts; legacy scrypt hashes remain verifiable. Bearer tokens are returned only at login and stored as SHA-256 digests; pre-change sessions require sign-in again. Logout revokes the session. Expired token checks fail closed and best-effort delete the expired digest. Updating an existing account through the operator `provisionAdmin` path revokes its prior sessions in the same transaction as the password/role update; the API has no self-service password-change endpoint.
- Errors sent to clients are generic. API logs include route metadata and error class, not request bodies, passwords, evidence, or raw database messages.
- Case engines are rehydrated from chronological, bounded ledger pages after process restart. Replay verifies hash links, fragment contents, batch grouping, and the persisted head before publishing state. In-memory locks are process-local.
- Prisma reads the SQLite file URL from `DATABASE_URL`; the runtime defaults to `file:./dev.db` to preserve local behavior. Copy `backend/.env.example` to `backend/.env` and set the deployment file URL there or in the process environment. This schema provider accepts SQLite file URLs only. Added owner/updated-time, case/fragment, and case/provenance-time indexes have not been applied locally; the shared SQLite file was not migrated. SQLite remains a single-writer choice; assess database and coordination services before horizontal scaling. PostgreSQL deployment still requires selecting that provider, generating a matching Prisma client, and applying a reviewed migration.

## Provenance and Privacy

`EvidenceProvenanceEntry` chains accepted fragments and fuzzy corrections with sequence, actor, server time, canonical payload, fragment references, previous hash, and current SHA-256 hash. Batch metadata preserves deterministic multi-fragment replay. `/api/cases/:id/provenance` verifies the complete chain in indexed pages and checks ledger events against persisted fragments.

Each case has a random 256-bit commitment salt encrypted with AES-256-GCM and stored as `provenanceSaltCiphertext`. The application requires `PROVENANCE_ENCRYPTION_KEY` to be 64 hexadecimal characters (32 random bytes); keep it in a secret manager and back it up. Losing or rotating this key without re-encrypting case salts prevents verification and selective disclosure for existing cases. Older cases with a null salt are initialized on their first provenance read.

`backend/src/security/key_rotation.ts` exports `rotateCaseProvenanceKeys`, which pages through initialized case salts and re-encrypts them under a new 32-byte key inside one Prisma transaction (10-second acquisition wait, 5-minute transaction timeout). It preserves each salt and therefore event keys and existing commitments. A failed decrypt or compare-and-update aborts the transaction; cases without a salt are counted and left for lazy initialization. The offline operator command is `npm run security:rotate-provenance-key`; it reads `PROVENANCE_OLD_ENCRYPTION_KEY` and `PROVENANCE_NEW_ENCRYPTION_KEY` from the operator environment, prints counts only, and does not change deployment secrets. Quiesce application writers during cutover, run the command through a secure secret-manager process, then update the API's `PROVENANCE_ENCRYPTION_KEY` secret and restart the API.

The default provenance response uses event-scoped HMAC-SHA-256 commitments and a SHA-256 envelope chain. It omits unsalted internal ledger digests and the raw database ledger head. Owners can request `/api/cases/:id/provenance/claims/:sequence` to disclose one event and its derived event-scoped salt for independent claim verification; that disclosure reveals that event's payload. `view=full` still returns the requested page of raw events to an authorized case reader. The public envelope is **not a zero-knowledge proof, signature, or external timestamp**. Raw evidence and ledger payloads remain plaintext in the database; this mechanism protects the redacted commitment view, not database-at-rest data.

`GET /api/cases/:id/provenance/proofs/:sequence` returns one public envelope, a duplicate-last SHA-256 Merkle inclusion path, and a digest checkpoint that binds the Merkle root. A client verifies the event in `O(log N)` hashes without downloading the chain. The API uses an in-memory bounded accumulator cache (`BoundedProvenanceAccumulatorCache`) holding pre-indexed `EnvelopeMerkleTree` structures. On a matching cache hit, `generateProofFromMerkleTree` extracts the path through indexed tree levels in `O(log N)` lookups without recomputing tree hashes or replaying the ledger. Cache misses, head mismatches, or local evidence writes invalidate the accumulator and trigger full-ledger re-verification and `O(N)` tree compilation. The proof-inspection drawer displays the leaf domain/hash, each sibling hash and side, duplicate-last steps, resulting node hashes, counted root, and checkpoint manifest match after local verification. The API request still performs authentication, case locking, and database reads, so tree lookup complexity is not an end-to-end latency guarantee. The additive SQL migration `20261011120000_provenance_merkle_accumulator/migration.sql` is prepared but has not been applied to the shared database. A checkpoint digest is self-consistency metadata, not a signature or independent timestamp: retain `manifestDigest` outside the database to authenticate it against later rewrites.

`GET /api/cases/:id/export/audit-bundle` returns the schema, up to 20 candidate snapshots, the complete public envelope chain, a Merkle-root checkpoint, a bundle digest, and a standalone Node verifier included in the JSON. The verifier uses only Node built-ins and can be run offline. It checks package self-consistency, envelope-chain and Merkle integrity, checkpoint digest, and an optional externally supplied expected bundle digest. Without an independently retained digest it does not establish who created the bundle or when; it does not prove candidate values are true or recompute the private unsalted ledger head. Exports are owner/admin-only, limited to 64 MiB, and contain reconstructed field values that must be stored as sensitive case data.

## Investigator Console

The dashboard supports case listing/resumption, evidence submission with investigator-assessed source confidence, a clickable candidate-state map, a relational record graph for the selected candidate, ranked alternatives, before/after candidate entropy, expected-information-gain guidance, a paged provenance ledger, local browser verification of public envelope pages and Merkle inclusion proofs, an interactive sibling-path inspection drawer, a paste-in single-event disclosure verifier, commitment JSON export, and offline audit-bundle export. Proof exports are downloaded only after the browser checks the envelope self-hash, checkpoint digest, and Merkle path with Web Crypto. The claim verifier checks event-scoped HMAC commitments and the envelope row's SHA-256 self-hash; it does not prove inclusion in a complete externally anchored ledger or provide a zero-knowledge proof. It has a case-view error boundary and inline validation for reserved fields, JSON scalar mode, and confidence bounds. Information-gain output is decision support based on heuristic candidate weights, not a truth guarantee. Vitest covers dashboard rendering, contradictory evidence, validation, claim verification, Merkle proofs, proof-path display, and error-boundary recovery. Playwright E2E exercises registration, case creation, confidence submission, evidence persistence, ledger verification, visual proof inspection and download, bundle download, and valid/tampered disclosure checks against the real API and a disposable SQLite database. `npm run load:engine` runs five samples each at 100, 250, and 500 employees and verifies atomic rejection above an intentionally small candidate cap; these are synthetic engine microbenchmarks, not production SLA. `npm run load:api` exercises real HTTP writes against an OS-temporary SQLite database with concurrent sessions and app instances, verifies serialization and rollback integrity, and records cache hot/rebuild timings; it is a small controlled benchmark, not sustained or distributed production load testing.

The additive deployment SQL is recorded in `backend/prisma/migrations/20261011000000_provenance_salt_and_indexes/migration.sql`. Its statements were exercised against a temporary pre-change SQLite schema, but it has not been applied to the shared SQLite database. Review the target schema and existing migration history first: the column addition is intentionally one-time and will fail if that column already exists.

## Intellectual Property & Prior Art Boundary

Potential claim areas for professional counsel review include:
1. Bounded fuzzy-domain compatibility integrated with relational constraint propagation and atomic contradiction fallback (differentiated from classical repair, e.g., Bohannon et al. SIGMOD 2005, and holistic cleaning, Chu et al. PVLDB 2013).
2. Deterministic batch-aware reconstruction replay bound to a hash-chained evidence ledger with event-scoped keyed commitments (differentiated from standard audit logs, Haber & Stornetta 1991, Crosby & Wallach 2009).
3. Candidate-entropy-guided evidence acquisition (`rankNextEvidence`) paired with event-scoped selective disclosures.

These are engineering mechanisms, not findings of novelty or patentability. No patent application has been filed, no patent-pending status is claimed, and the commitment envelope is not a zero-knowledge proof.

### Illustrative Technical Claim Architecture (Engineering Draft)

The following is a mechanism map for technical review, not a legal claim set, novelty opinion, or filing-ready application. Terms are limited to implemented behavior; the fuzzy metric is bounded restricted Damerau-Levenshtein / optimal-string-alignment distance, and candidate weights are heuristics.

**Independent Method Claim 1 — bounded forensic reconstruction with verifiable provenance.** A computer-implemented method comprising: (a) receiving a plurality of scalar-validated evidence fragments associated with relation, record locator, field, and optional investigator-assessed confidence metadata, where fragments may arrive in an order different from relational dependencies; (b) accumulating observed values in finite field domains; (c) applying bounded AC-3 revisions to relational arcs, including foreign-key support checks that admit string pairs within a configured restricted Damerau-Levenshtein cutoff; (d) when propagation empties a domain, restoring the pre-propagation evidence domains for contradiction scoring; (e) enumerating surviving value assignments subject to configured candidate, work, and storage limits, rejecting an over-limit batch before publishing the resulting engine state; (f) calculating constraint, edit-distance, and normalized dissenting-confidence penalties, deriving normalized heuristic candidate weights, and calculating candidate entropy and expected information gain for evidence queries; and (g) appending accepted fragments and deterministic correction events to a hash-chained ledger, deriving event-scoped HMAC commitments for a redacted public envelope, and producing a digest checkpoint that binds an envelope head and Merkle root for independent retention.

**Independent System Claim 8 — reconstruction and audit apparatus.** A system comprising one or more processors; an Express service configured to authenticate an investigator and enforce case ownership; a relational transaction store configured to persist evidence fragments, provenance events, and a case head atomically; a bounded in-memory engine cache; an engine module configured to construct finite evidence domains, perform budgeted constraint propagation, preserve contradiction candidates, enumerate within explicit limits, and rank information-gain queries using heuristic confidence weights; and cryptographic modules configured to hash-chain replayable events, derive event-scoped HMAC commitments from an encrypted case salt, and calculate Merkle inclusion proofs and digest checkpoints over public envelope hashes.

**Independent Computer-Readable Medium Claim 15 — executable reconstruction instructions.** A non-transitory computer-readable medium storing instructions that, when executed by one or more processors, cause the processors to perform the method of Claim 1, including bounded propagation and enumeration, atomic rejection of an over-limit evidence update, confidence-weighted heuristic candidate ranking, append-only cryptographic provenance generation, and generation of a verifiable Merkle inclusion path and offline audit package.

**Implementation mapping for the Merkle portion of Method Claim 1(g) and System Claim 8:** `EnvelopeMerkleTree` and `buildEnvelopeMerkleTree` compile the ordered public-envelope levels, `generateProofFromMerkleTree` extracts the per-event sibling path, and `BoundedProvenanceAccumulatorCache` keeps validated trees by case sequence/head. The API verifies/rebuilds on cache miss or changed head; the frontend helper `deriveEnvelopeMerkleProofDetails` computes the visible path and counted root for the proof drawer. This is a code-to-draft mapping, not a conclusion that the mapped combination is novel or patentable.

**Technical differentiation matrix (scoping only).**

| Reference | Described technical focus | LAZARUS-X mechanism mapped for comparison | Boundary |
| --- | --- | --- | --- |
| [US9116934B2 — Holistic database record repair](https://patents.google.com/patent/US9116934B2/en) | Cost-based repair of functional-dependency violations and duplicate records by modifying a database instance | Preserves evidence-supported alternatives and ranks bounded candidates without applying repairs to an input database | Compare exact claims; this contrast does not establish novelty |
| [US7076481B2 — Method and apparatus for logically reconstructing incomplete records](https://patents.google.com/patent/US7076481B2/en) | Searches transaction logs for change records and reapplies changes to reconstruct an earlier object state | Reconstructs from submitted partial evidence fragments and replays an application provenance ledger rather than parsing DB transaction logs | Do not claim superiority or non-overlap without counsel's claim chart |
| [US9195725B2 — Resolving database integration conflicts using data provenance](https://patents.google.com/patent/US9195725B2/en) | Selects and applies a highest-priority policy to resolve a conflict between integrated data sources | Uses confidence as a heuristic input while retaining candidate alternatives; its cryptographic ledger records receipt and replay rather than selecting a source-precedence policy | Verify the exact family claim scope before relying on the contrast |
| [US7296011B2 — Efficient fuzzy match for evaluating data records](https://patents.google.com/patent/US7296011B2/en) | Approximate matching of input tuples to reference-relation tuples using token/q-gram similarity; the disclosure also addresses token transposition | Uses bounded adjacent-transposition-aware string distance as foreign-key support inside relational constraint propagation and records corrections | Existing fuzzy matching is relevant prior art; no conclusion about patentability follows |

Every row is a technical search lead, not an infringement, validity, novelty, or freedom-to-operate conclusion. A patent professional must verify the source patents and map exact claims before any filing or product assertion.

A limited public patent-page search found adjacent patent families on holistic database repair, incomplete-row reconstruction from transaction logs, provenance-based integration conflict resolution, and fuzzy record matching. The combination in LAZARUS-X remains an untested research hypothesis; no claim-level patent search or legal opinion has been performed. See the latest patent-landscape scoping note in `HANDOFF.md`.

### Focused Patent-Family Technical Comparison (Not a Claim Chart)
1. **[US9116934B2 (Qatar Foundation; now listed to Hamad bin Khalifa University) — Holistic database record repair](https://patents.google.com/patent/US9116934B2/en):**
   - *Disclosed Mechanism:* Identifies functional-dependency violations and duplicate records, computes costs for mutually dependent modifications, and generates updates to a modified database instance.
   - *LAZARUS-X Distinction:* LAZARUS-X does not mutate, overwrite, or repair existing database cells. It operates under open-world, out-of-order partial evidence intake. Rather than forcing a single minimal-repair database state, LAZARUS-X maintains bounded Cartesian branching across all surviving hypotheses, explicitly preserving contradictory interpretations with penalized scores. Disambiguation is performed through active investigative probes (Shannon information gain), not automated cell rewriting.
2. **[US7076481B2 (BMC Software) — Method and apparatus for logically reconstructing incomplete records](https://patents.google.com/patent/US7076481B2/en):**
   - *Disclosed Mechanism:* Searches a target database's transaction logs for change records, locates a complete object copy, and reapplies changes to reconstruct the object's earlier state.
   - *LAZARUS-X Distinction:* Requires no transaction logs, SCNs, or shared transaction boundaries. LAZARUS-X reconstructs relational state from unsequenced, out-of-order partial forensic fragments from disparate untrusted sources using constraint satisfaction (AC-3 domain propagation) and composite foreign-key matching. Fragments are anchored to a cryptographic hash chain and keyed HMAC public commitment envelope for selective disclosure, whereas US7076481B2 operates within closed storage engine logs.
3. **[US9195725B2 (IBM) — Resolving database integration conflicts using data provenance](https://patents.google.com/patent/US9195725B2/en):**
   - *Disclosed Mechanism:* Integrates data from sources, associates prioritized policies with conflicts, selects an applicable highest-priority policy, and applies it to produce an integrated value.
   - *LAZARUS-X Distinction:* Never discards conflicting candidates based on hard-coded source hierarchies. When evidence conflicts, LAZARUS-X preserves all viable candidate states. Provenance in LAZARUS-X is an immutable cryptographic ledger (SHA-256 chain + HMAC envelope) proving chronological receipt and auditability, rather than a conflict-override rule engine. Candidate branching feeds an information-gain guidance model for active probe recommendation.
4. **[US7296011B2 (Microsoft) — Efficient fuzzy match for evaluating data records](https://patents.google.com/patent/US7296011B2/en):**
   - *Disclosed Mechanism:* Uses an approximate similarity function, including token/q-gram based matching, to evaluate input tuples against reference-relation records; the disclosure also describes token transposition.
   - *LAZARUS-X Distinction:* Integrates bounded restricted Damerau-Levenshtein (optimal-string-alignment) compatibility into foreign-key support checks, including adjacent transpositions within the configured cutoff. Fuzzy corrections generate auditable ledger events (`FUZZY_CORRECTION`) and apply heuristic penalty weights. This distinction is an engineering description, not a conclusion about the patent's claim scope or novelty.

*Legal boundary disclaimer:* These engineering distinctions do not constitute a legal opinion, freedom-to-operate analysis, or claim of patentability or patent-pending status. Qualified patent counsel should evaluate exact claims before any filing decision.

## Run and Verify

```powershell
cd backend
npm test
npx tsc --noEmit
npx prisma validate --schema prisma/schema.prisma
npm run load:engine
npm run load:api

cd ..\frontend
npm run build
npx vitest run
npm run lint
npm run test:e2e
```

`npm run load:engine` reports synthetic engine timings and verifies atomic overload rejection. `npm run load:api` creates a disposable SQLite database and benchmarks same-case API serialization, a controlled two-instance conflict, ledger rollback integrity, and proof-cache hot/rebuild behavior. Both are controlled local observations, not production capacity claims. Set `$env:DATABASE_URL='file:./dev.db'` in PowerShell before Prisma validation; validation does not migrate or connect to the shared database.

Before starting an API in production, set `NODE_ENV=production`, configure `CORS_ORIGINS` for the deployed frontend's exact origins, provision an administrator through the secure operator process, apply the Prisma schema/index changes during a planned database change, and serve the application over HTTPS.

## Academic & Patent Demonstration Commands

To verify the BCSE302P DBMS Lab Assessment features and formal patent claims on isolated disposable databases:

```powershell
cd backend
npm run dbms:demo
npx ts-node src/engine/patent_claim_verification.test.ts
```

- `npm run dbms:demo`: Executes full database design & implementation checks: 11 tables in 3NF, CRUD operations, multi-table joins, aggregate queries, SQL views (`vw_case_activity_summary`), database triggers (`trg_audit_evidence_insert`, `trg_seal_immutability_guard`), atomic stored procedure / transaction (`sp_seal_forensic_case`), B-tree compound index query plan analysis, and native database backup & recovery.
- `npx ts-node src/engine/patent_claim_verification.test.ts`: Validates all 25 formal patent claims defined in `research/PATENT_SPECIFICATION_FORMAL.md` against the engine's CSP/AC-3 solver, Damerau-Levenshtein metrics, Shannon entropy calculations, Merkle trees, and cryptographic sealing.
- Native backup utilities: `scripts/backup_database.sh` (Linux/macOS) and `scripts/backup_database.bat` (Windows).
- Containerization: Root multi-stage `Dockerfile` and `docker-compose.yml` for full-stack service orchestration.
