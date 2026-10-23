# Prior-Art Claim Matrix & Literature Context

| Reference | Summary | Overlap with LAZARUS-X | Technical Distinctions & Context | Relationship |
| :--- | :--- | :--- | :--- | :--- |
| **Guided Data Repair (Yakout et al., SIGMOD 2011)** | Active learning and value-of-information (VoI) framework for constraint violation resolution via user feedback. | Uses information gain / uncertainty reduction principles to request missing cell values over relational integrity constraints. | Guided Data Repair targets database cleaning in live operational databases; LAZARUS-X applies bounded AC-3 candidate propagation to fragmented forensic streams with cryptographic ledger commitment. Value-of-information for constraint disambiguation is known prior art. | Related / Literature Precedent |
| **Probabilistic Unclean Databases (ICDT 2019 / HoloClean)** | Probabilistic semantics and possible-worlds models over unclean relational tables. | Models multiple plausible relational candidate worlds under denial constraints and functional dependencies. | Uses statistical machine learning / probabilistic inference engines offline. LAZARUS-X uses deterministic constraint satisfaction with heuristic penalty weighting. Possible-worlds candidate repair is known art. | Related / Conceptual Overlap |
| **US9081838B2** | Incremental maintenance of materialized views. | Uses delta tracking for relational queries. | Assumes a single deterministic state. LAZARUS-X tracks localized constraint violations across multiple competing hypotheses. | Distinguished |
| **US8577849B2** | Incremental recomputation of constraints. | Caches localized constraint states to avoid full scans. | Relies on a single source of truth. LAZARUS-X handles out-of-order evidence streams with temporary FK violations. | Distinguished |
| **US9619494B2** | Constraint-guided data cleaning. | Prunes candidate repairs that violate relational rules. | Employs automated batch pruning without interactive evidence-prioritization heuristics. | Distinguished |

*Note:* Technical comparisons in this matrix are engineering benchmarks for academic analysis only and do not constitute a legal prior-art or freedom-to-operate opinion.

