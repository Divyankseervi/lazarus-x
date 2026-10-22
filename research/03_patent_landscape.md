# Phase 2: Patent Landscape & Eligibility Analysis

## Jurisdictional Focus: India (Section 3(k))
Under Section 3(k) of the Indian Patents Act, 1970, and the updated 2025 CRI Guidelines, algorithms and computer programs *per se* are not patentable. 
**Eligibility Path:** To overcome 3(k), the invention must demonstrate a **technical effect** or **technical contribution**. Our proposed mechanism—incremental recomputation of affected components to reduce CPU/memory overhead during forensic restoration—presents a measurable improvement in system performance, which is a recognized technical effect.

## Relevant Patent Documents (Provisional Search)
*(Note: This is a simulated/preliminary landscape. Professional patent search is required prior to filing).*

1. **US8769345B2 (Data recovery in database systems)**
   - *Claims:* Mechanisms for recovering data from WAL logs during crash recovery.
   - *Limitation:* Focuses on single-stream, definitive transactional rollback. It does not disclose maintaining multiple probabilistic or competing reconstruction states.

2. **EP2345678A1 (Incremental re-computation of queries)**
   - *Claims:* Updating materialized views incrementally when base tables change.
   - *Limitation:* Operates on definitive transactional data, not ambiguous forensic fragments with unknown provenance.

3. **US10115049B2 (Probabilistic Database Management)**
   - *Claims:* Storing and querying uncertain data.
   - *Limitation:* Typically lacks the active "evidence acquisition" and constraint-guided repair mechanism.

## Initial Conclusion
The combination of (a) forensic fragment ingestion, (b) competing state generation based on constraints, and (c) incremental recomputation appears highly novel and distinct from traditional crash recovery or data cleaning patents.
