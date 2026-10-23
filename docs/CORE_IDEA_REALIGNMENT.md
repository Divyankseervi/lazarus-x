# LAZARUS-X: Core Idea and Implementation Realignment

Review date: 2026-10-23

## The actual problem

A relational database may be incomplete or contradictory after a failure, export, partial log capture, or fragmented collection process. An analyst may possess observations of individual fields, but the observations can arrive out of order, omit parent rows, or disagree. The key problem is not “show a forensic dashboard”; it is:

> Given a declared target relational schema and a collection of partial field-level observations, what candidate database states remain consistent with the evidence and constraints, which conflicts are unresolved, what observation would best distinguish the surviving candidates, and can the history of accepted observations be independently checked?

## What LAZARUS-X really implements

1. **Schema first.** Each case stores a target schema definition. It declares relation names, scalar field types, required/unique fields, and foreign-key links. Schema Studio validates names, unique-key declarations, declared FK endpoints, target uniqueness, and compatible field types.
2. **Evidence second.** Investigators enter individual observations or import a bounded CSV batch. An observation contains a relation, record locator, field, observed scalar value, investigator-assessed confidence, and optional source/exhibit label and SHA-256 digest string. Field and type validation runs before the batch is accepted.
3. **Hypothesis generation.** The engine accumulates conflicting values as alternatives, materializes bounded candidate states, propagates declared relational constraints (including AC-3-based filtering), and evaluates fatal versus resolvable violations. Out-of-order children can remain candidates while parent evidence is still incomplete.
4. **Disambiguation.** The engine calculates normalized heuristic state weights, entropy and expected information-gain rankings to recommend a next observation. Percentages are not calibrated probabilities that a candidate is historically true.
5. **Custody and audit.** Accepted fragments and corrections are represented in a chained provenance ledger and public commitment/Merkle envelope. The UI exposes event history, verification, inclusion proofs and export workflows.

## Product workflow now reflected in the dashboard

`Create case → declare schema → provide evidence (manual or CSV) → compare candidate states → follow a ranked next-observation recommendation → review source references and provenance → export a report/audit bundle → optionally seal the case.`

The synthetic walkthrough submits actual generated test fragments to the API, including an explicitly labelled conflict, so the investigator can see the pipeline work. These generated values are demonstrations, not real evidence and must never be represented as recovered source data.

## Critical implementation boundary

LAZARUS-X does **not** currently parse raw disk pages, carve deleted SQLite rows, reconstruct from WAL/journals, infer an unknown schema from raw bytes, or prove which candidate is historical truth. The SQLite inspector describes the currently visible schema and row counts; the artifact-manifest script calculates/verifies byte digests. Neither CLI is a deleted-row recovery engine. They are distinct helpers, not a raw-recovery input path into the solver.

The custom target schema is stored as validated JSON in `ReconstructionCase.schemaDefinition`; candidate relation rows are materialized by the solver in memory. Creating a custom case does not run DDL to create physical tables with those names in the application's SQLite database. The fixed SQLite/Prisma application schema (including `User`, `ReconstructionCase`, `EvidenceFragment`, ledger models and the three workforce/order demonstration tables) remains the database used to manage the application and satisfy the DBMS lab's schema/ORM requirements.

`sourceSha256` is a reference supplied by the investigator and checked for digest syntax; the web application does not open or re-hash the referenced file. To prove that a digest matches an artifact, use the separate manifest utility and retain the generated manifest. A hash alone is not proof of source origin, collection procedure, or legal admissibility.

## Honest design choices

- **Open-world foreign keys:** an unmatched reference is not automatically declared corruption if the target set may be incomplete. If a relation's evidence is incomplete, the engine should preserve a resolvable hypothesis rather than destroy it prematurely.
- **Bounded search:** computational work is capped. If a request exceeds limits, reject it atomically and report the limit; do not silently emit a partial candidate list as though it were exhaustive.
- **Explanatory percentages:** all state weights are model scores. UI copy identifies them as heuristics, not calibrated Bayesian posterior probabilities.
- **No fake consensus:** the candidate field-inspection panel highlights fields surfaced by current ranked recommendations. A non-highlighted cell is not proof that all possible candidates agree on that value.
- **Prototype, not product certification:** a valid hash chain and Merkle inclusion proof show integrity relative to a supplied chain/checkpoint. They do not themselves create a digital signature, trusted timestamp, original custody evidence, or a legal admissibility ruling.

## Next research extension (not claimed as implemented)

The highest-value next research module is an isolated read-only SQLite page/WAL/journal recovery adapter validated against a synthetic corpus with known ground truth. It should preserve byte offsets and source hashes, distinguish parser facts from inferences, and compare recovered hypotheses with LAZARUS-X's constraint engine. This should be a separate ingestion adapter, not a broad claim that current hash-manifest tooling recovers deleted rows.
