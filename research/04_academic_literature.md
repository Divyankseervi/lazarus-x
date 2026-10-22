# Phase 2: Academic Literature Review

## Core Papers Reviewed

1. **"Forensic Analysis of SQLite Databases" (DFRWS)**
   - *Method:* Analyzes how SQLite B-Trees store deleted records in unallocated space and unlinked pages.
   - *Relevance:* Provides the foundational understanding of what "fragments" look like before relational reconstruction begins.
   - *Limitations:* Does not address relational integrity.

2. **"HoloClean: Holistic Data Repairs with Probabilistic Inference" (Rekatsinas et al., VLDB 2017)**
   - *Method:* Uses integrity constraints, external dictionaries, and quantitative statistics to build a probabilistic model for data repair.
   - *Results:* Demonstrated superior precision in repairing structured datasets over rule-based systems.
   - *Relevance:* Proves that constraint-guided repair is highly effective. Our hypothesized invention takes this concept and applies it to forensic fragments, adding incremental recomputation.

3. **"Incremental View Maintenance" (Various, SIGMOD)**
   - *Method:* Techniques for updating views without full recomputation.
   - *Relevance:* The mathematical basis for our proposed incremental recomputation engine.

## The Academic Gap
While probabilistic data cleaning (HoloClean) and incremental view maintenance are established, the literature lacks a unifying architecture for **forensic restoration under uncertainty**. Specifically, there is a gap in algorithms that identify exactly *which* missing piece of evidence would mathematically collapse the most competing relational states (Ambiguity Reduction).
