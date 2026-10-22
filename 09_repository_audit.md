# Phase 3: Repository Audit

## Investigated Repositories & Verified Licenses

| Repository | Purpose | License | Viability for LAZARUS-X |
| :--- | :--- | :--- | :--- |
| **xsqlite** | NFI Python package for SQLite forensic analysis. | **MIT License** | High. Safe for integration into the artifact ingestion layer. |
| **bring2lite** | SQLite deleted record recovery from WAL/Journals. | **GPL-3.0** | Low. The GPL-3.0 license is highly restrictive (copyleft) and could compromise the proprietary nature of our core engine if linked directly. Study only. |
| **sqlite-dissect** | DoD DC3 SQLite parser. | **Public Domain / MIT** | Moderate. Complex, but usable for raw extraction. |
| **holoclean** | ML system for data cleaning. | **Apache 2.0** | High conceptual value. We will not use the codebase directly (as it expects intact datasets), but the constraint-modeling architecture is deeply influential. |
| **datacompy** | Pandas dataframe comparison. | **MIT License** | High. Excellent for our Experimental Validation framework (Phase 7). |
| **csvdb** | Treat CSVs as databases via SQLite/DuckDB. | **MIT License** | Low. Not directly relevant to forensic reconstruction. |
| **shadcndashboard**| React/Next.js UI template. | **MIT License** | High. Perfect for building the professional Engineering Workbench UI required in Phase 5. |

## Strategy
1. **Frontend:** Adapt `shadcndashboard` (MIT).
2. **Backend/Ingestion:** Wrap or study `xsqlite` (MIT) for raw artifact ingestion.
3. **Core Engine:** Implement the Incremental Recomputation and Ambiguity Reduction engine entirely from scratch (proprietary/private).
4. **Validation:** Use `datacompy` (MIT) in the test suite.
