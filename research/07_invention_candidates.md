# Phase 1 & 2: Invention Candidates

## Candidate 1: The Original Hypothesis
*Incremental constraint-guided reconstruction with active evidence prioritization.*
- **Feasibility:** High. Can be built over PostgreSQL using an ORM and custom graph algorithms.
- **Novelty:** High. The combination of incremental recomputation with ambiguity reduction in forensics is unique.
- **DBMS Assessment Relevance:** Excellent. Requires complex schemas, views, stored procedures (for the recomputation logic), and triggers.

## Candidate 2: Conflict-Aware Relational Recovery via WAL Analysis
*Directly parsing WAL files to build a conflict graph before applying them to the DB.*
- **Feasibility:** Moderate. Parsing PostgreSQL WAL files directly is highly complex and versions-specific.
- **Novelty:** Moderate. Exists conceptually in advanced replication engines.
- **DBMS Assessment Relevance:** Poor. Bypasses standard SQL interactions.

## Candidate 3: Forensic Database Page Reconstruction
*Stitching orphaned B-tree pages together using ML.*
- **Feasibility:** Low. Requires massive training datasets of corrupted pages.
- **Novelty:** High. 
- **DBMS Assessment Relevance:** Poor. Doesn't utilize relational DB features effectively.

## Recommendation
**Candidate 1** is technically strongest, most defensible from a patent perspective, and aligns perfectly with the requirement to build a robust relational schema with CRUD, joins, and transactions.
