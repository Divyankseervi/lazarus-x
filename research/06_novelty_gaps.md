# Novelty Gaps & Identified Contributions

## 1. Verified Core Contribution
The primary technical contribution supported by our reproducible benchmarking is the **Dependency-Aware Selective Recomputation with Delayed Pruning**. 
While incremental recomputation is well known in the context of single-state databases (e.g., Materialized Views), LAZARUS-X successfully adapts it to a multi-hypothesis probabilistic tree. By categorizing violations into `fatal` (UNIQUE) and `resolvable` (FOREIGN_KEY missing parents) and applying a soft upper-bound to `Top-K` pruning, the engine mathematically survives out-of-order relational evidence streams that cause heuristic pruning algorithms to catastrophically delete the ground-truth state.

## 2. Interactive Ambiguity Reduction
LAZARUS-X calculates the conditional entropy (Shannon Entropy) of all disputed fields across the surviving candidate tree. It explicitly ranks which forensic query will yield the highest Expected Information Gain, directly addressing the limitations of offline, black-box probabilistic cleaning tools.

## 3. Limitations (Not claimed as novel)
- The core algorithm does not claim to solve the NP-Hard constraint satisfaction problem in polynomial time. Highly adversarial inputs can still exceed the soft bound and cause truth loss.
- The scoring heuristic ($1 / (1 + violations)$) is acknowledged as a heuristic penalty, not a mathematically calibrated Bayesian probability.
