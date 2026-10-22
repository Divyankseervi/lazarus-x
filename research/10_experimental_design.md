# Phase 7: Experimental Design

## Objective
To rigorously evaluate the LAZARUS-X hypothesized mechanism (Ambiguity Reduction + Incremental Recomputation) against appropriate baselines without inventing results or relying on subjective evaluations.

## Baselines for Comparison
1. **Baseline A (Naive Reconstruction):** Inserts all recovered fragments directly, applying constraints passively (rejecting fragments that violate constraints immediately).
2. **Baseline B (Full Recomputation):** Generates competing states for all fragments but re-evaluates the *entire* schema for constraint satisfaction every time a new piece of evidence is added.
3. **LAZARUS-X:** Incremental, dependency-aware recomputation with algorithmic ambiguity reduction.

## Datasets
- Synthetically generated PostgreSQL schemas representing typical enterprise domains (e.g., Supply Chain, HR).
- Ground truth databases will be artificially degraded by deleting random foreign keys, nullifying required fields, and generating contradictory duplicate records (to simulate forensic fragmentation).

## Measured Metrics
1. **Reconstruction Precision & Recall:** How closely the top-ranked candidate state matches the original ground truth (using `datacompy`).
2. **False-Positive / False-Repair Rates:** Count of records incorrectly synthesized by constraints.
3. **Processing Time & CPU/Memory:** Total execution time and peak memory usage to reconstruct a heavily fragmented DB.
4. **Recomputation Cost:** The number of schema components/tables re-evaluated upon acquiring new evidence (Baseline B vs. LAZARUS-X).
5. **Evidence Operations:** Number of targeted queries ("Ambiguity Reduction" operations) needed to converge on a single, highly-probable candidate state.

## Controls
- All experiments must run with fixed random seeds for the degradation phase to ensure reproducibility.
- Hardware specifications must be heavily documented.
- Caching effects must be explicitly isolated and reported.
