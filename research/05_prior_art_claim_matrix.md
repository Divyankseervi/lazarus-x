# Prior-Art Claim Matrix

| Reference | Summary | Overlap with LAZARUS-X | Key Difference | Status |
| :--- | :--- | :--- | :--- | :--- |
| **US9081838B2** | Incremental maintenance of materialized views. | Uses delta tracking for relational queries. | Assumes a single deterministic state. LAZARUS-X tracks deltas across a probabilistic tree of competing hypotheses. | Distinguished |
| **US8577849B2** | Incremental recomputation of constraints. | Caches localized constraint states to avoid full scans. | Does not resolve ambiguity; relies on a single source of truth. LAZARUS-X handles out-of-order evidence streams with temporary violations. | Distinguished |
| **US9619494B2** | Constraint-guided data cleaning. | Prunes candidate repairs that violate relational rules. | Lacks an explicit Active Learning / Information Gain mechanism to request human intervention for optimal tree collapse. | Distinguished |
| **HoloClean (Academic)** | Probabilistic data cleaning framework. | Uses statistical learning to infer missing cells. | Focuses on offline ML-based inference. LAZARUS-X focuses on deterministic forensics with interactive Ambiguity Reduction. | Distinguished |
