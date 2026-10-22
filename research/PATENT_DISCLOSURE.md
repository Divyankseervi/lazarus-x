# PATENT DISCLOSURE: LAZARUS-X (Non-Legal Analysis)

## 1. Technical Problem
Reconstructing relational databases from logs typically requires full recomputation of global constraints on every candidate state, causing combinatorial explosion. Simplistic beam-search pruning destroys the correct state when evidence arrives out of relational order (e.g. child record before parent record).

## 2. Proposed Novel Architecture
1. **Delta-Tracking Selective Recomputation**: Maintains a `constraintCache` and mathematically maintains a `globalViolations` delta based only on affected tables. Verified to perfectly mirror the accuracy of $O(N)$ full recomputation but with $O(K)$ localized operations.
2. **Violation Categorization**: Automatically categorizes violations into `fatal` (e.g., UNIQUE collisions) and `resolvable` (e.g., missing FOREIGN_KEY parents).
3. **Delayed Pruning**: Retains candidate states with 0 fatal violations up to a soft-bound threshold, even if they violate `topK` limits, preserving states suffering from out-of-order evidence until missing parents arrive.
4. **Information Gain Ambiguity Reduction**: Calculates the conditional entropy of disputed fields across the surviving state tree, explicitly recommending the optimal next query to collapse the tree.

## 3. Closest Verified Prior Art
- **US9081838B2 & US8577849B2 (Incremental Maintenance)**: Addresses incremental views, but assumes a single deterministic state. Lazarus-X applies incremental maintenance to *probabilistic multi-state trees*.
- **US9619494B2 (Constraint-Guided Cleaning)**: Prunes candidate repairs, but lacks explicit Information Gain querying.

## 4. Unresolved Eligibility Questions
While the algorithms are demonstrably implemented, the "Information Gain" formula is a well-known mathematical concept (Shannon Entropy). Patentability relies on the *novel combination* of applying this specific measure to guide active SQL forensics in a multi-hypothesis tracker. Independent patent counsel should review whether this specific application meets the threshold for inventive step.
