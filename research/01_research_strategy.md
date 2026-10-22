# Phase 1: Research Strategy

## Terminology
- **Database Reconstruction:** The process of assembling an operative database state from partial, damaged, or inconsistent data artifacts (e.g., WAL files, orphaned B-tree pages, fragmented DB files).
- **Relational Repair (Constraint-Guided):** Using schema integrity constraints (foreign keys, check constraints, uniqueness) to synthesize missing fragments or resolve data conflicts logically.
- **Incremental Dependency Recomputation:** Re-evaluating only the subset of the database state affected by newly acquired or altered evidentiary fragments.
- **Ambiguity Reduction (Information Gain):** Systematically identifying the missing evidence that would best distinguish between competing candidate reconstructions.

## Target Databases
- **Primary:** PostgreSQL (aligns with enterprise applications and DBMS lab requirements).
- **Secondary (Forensic baseline):** SQLite (ubiquitous in existing digital forensic literature and mobile devices).

## Core Questions
1. How do current forensic tools handle *conflicting* fragments in a relational context?
2. Is there prior art for maintaining *competing* relational database states based on ambiguous evidence?
3. What is the computational cost of re-evaluating constraint satisfaction across a massive schema when a single fragmented record is updated?

## Search Methodology
- **Sources:** Google Patents, WIPO PATENTSCOPE, Indian Patent Office (Section 3(k) compliance), ACM Digital Library, IEEE Xplore, VLDB, SIGMOD.
- **Key Phrases:** 
  - "database reconstruction" AND "digital forensics"
  - "incremental recomputation" AND "database recovery"
  - "constraint-guided data cleaning" OR "holistic data repair"
  - "active learning" AND "entity resolution" OR "ambiguity reduction"
