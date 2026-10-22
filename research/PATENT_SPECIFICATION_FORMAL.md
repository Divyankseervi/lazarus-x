# PATENT APPLICATION SPECIFICATION

**UNITED STATES PATENT AND TRADEMARK OFFICE (USPTO) / PCT INTERNATIONAL APPLICATION / INDIAN PATENT OFFICE (IPO)**

---

## TITLE OF THE INVENTION
**SYSTEM, METHOD, AND NON-TRANSITORY COMPUTER-READABLE MEDIUM FOR DETERMINISTIC MULTI-HYPOTHESIS RELATIONAL DATABASE FORENSIC RECONSTRUCTION WITH ENTROPY-GUIDED ACTIVE DISAMBIGUATION AND DUAL-LAYER CRYPTOGRAPHIC CHAIN-OF-CUSTODY**

---

## CROSS-REFERENCE TO RELATED APPLICATIONS
[0001] This application claims priority to and the benefit of prior technical disclosures in the Lazarus-X forensic reconstruction architecture, the entire disclosures of which are hereby incorporated by reference in their entirety.

---

## TECHNICAL FIELD
[0002] The present disclosure relates generally to database management systems, automated digital forensics, and cryptographic data integrity verification. More specifically, the present disclosure relates to systems and methods for:
1. Deterministically reconstructing relational database states from out-of-order, unsequenced, and partial forensic evidence fragments without reliance on database transaction logs, write-ahead logs (WAL), or system change numbers (SCN);
2. Managing a bounded multi-hypothesis candidate state lattice using delta-tracked Arc-Consistency (AC-3) constraint propagation over composite foreign keys and error-tolerant string transposition metrics;
3. Actively guiding investigative evidence acquisition using Shannon conditional entropy reduction and expected information gain to achieve optimal collapse of competing candidate interpretations; and
4. Enforcing an auditable, court-ready dual-layer cryptographic chain-of-custody combining append-only cryptographic hash chaining, keyed HMAC commitment envelopes for selective/zero-knowledge disclosure, RFC 6962 binary Merkle tree accumulators, and immutable atomic case sealing.

**Classification Mapping:**
- **IPC/CPC:**
  - `G06F 16/23` — Updating and database reconstruction
  - `G06F 21/64` — Data integrity verification and cryptographic provenance
  - `G06F 17/18` — Statistical evaluation, probability, and entropy calculation
  - `G06F 11/14` — Error detection, database recovery, and consistency checking

---

## BACKGROUND OF THE INVENTION
### 1. Limitations of Existing Database Recovery Systems
[0003] Conventional database crash recovery systems (e.g., as exemplified by US Patent No. 8,769,345 B2) rely strictly on sequential write-ahead logs (WAL), redo logs, or monotonically incrementing System Change Numbers (SCN). Such systems operate under the assumption that a continuous, ordered stream of discrete transactional operations is available. In digital forensics, data recovery following catastrophic storage failure, ransomware incidents, or deliberate evidentiary spoliation, sequential transaction logs are frequently destroyed, fragmented, or unavailable. 

[0004] When investigators recover disconnected fragments of data from unallocated disk space, memory dumps, network packet captures, or forensic disk carvings, existing recovery systems are entirely incapable of reconstructing relational tables because the temporal order of operations and transaction boundaries are absent.

### 2. Limitations of Holistic Data Repair and Constraint Cleaning
[0005] Existing constraint-guided data repair frameworks (e.g., US Patent No. 9,116,934 B2 and academic systems such as HoloClean) attempt to resolve data inconsistencies by identifying functional dependency violations and computing a single, minimal-cost repair. These systems suffer from fundamental architectural flaws when applied to forensic investigations:
1. *Destructive Premature Convergence:* They immediately overwrite or alter contradictory cell values to satisfy integrity constraints, thereby destroying genuine competing interpretations and introducing unverified hallucinations into evidentiary records.
2. *Closed-World Presumption:* Conventional data repair operates under a Closed-World Assumption (CWA), treating any missing referenced record as an immediate, fatal violation. When forensic evidence arrives out-of-order (for example, where a child record referencing a parent entity is recovered before the parent entity itself is recovered), conventional constraint algorithms prematurely prune or corrupt valid relational states.
3. *Passive Ingestion:* Conventional data repair is purely passive. It lacks any mathematical mechanism to interrogate the ambiguity of surviving hypotheses and recommend specific, high-leverage investigative inquiries to human examiners.

### 3. Limitations of Data Provenance and Audit Trails
[0006] Existing provenance frameworks (e.g., US Patent No. 9,195,725 B2) associate static metadata tags or policies with data sources to resolve integration conflicts according to rigid, hard-coded priority hierarchies. Furthermore, conventional transparency logs (e.g., RFC 6962, Sigstore Rekor) log standalone binary artifacts rather than relational database state transitions. In legal and forensic proceedings, investigators face a critical dilemma: disclosing raw forensic evidence exposes confidential or personally identifiable information (PII), whereas redacting evidence destroys the ability of independent opposing examiners or courts to mathematically verify data integrity and receipt order.

[0007] There is, therefore, an urgent and unmet technological need for an automated, mathematically rigorous, and cryptographically verifiable system capable of reconstructing relational databases from non-sequential partial fragments, preserving competing interpretations across a bounded hypothesis lattice, actively guiding ambiguity resolution, and providing court-ready selective disclosure.

---

## SUMMARY OF THE INVENTION
[0008] To overcome the aforementioned deficiencies of the prior art, the present disclosure provides a novel system, computer-implemented method, and non-transitory computer-readable medium for deterministic multi-hypothesis relational database forensic reconstruction.

[0009] **Technical Problem Solved:** The combinatorial explosion of candidate database states when evaluating unsequenced partial fragments across global relational constraints, the permanent destruction of correct states caused by premature pruning during out-of-order arrival, and the inability to prove unbroken custody and selective disclosure in court without revealing sensitive underlying attributes.

[0010] **Concrete Technical Solution & Technical Effects:**
1. *Delta-Tracked Constraint Satisfaction with Dual-Category Violation Classification:* The system executes an Arc-Consistency 3 (AC-3) constraint propagation engine over arbitrary relational schemas supporting composite primary and foreign keys. Integrity violations are dynamically separated into `fatal` violations (e.g., primary key uniqueness collisions, contradictory immutable attributes) and `resolvable` violations (e.g., dangling foreign keys missing a parent under open-world semantics).
2. *Delayed Pruning Hypothesis Lattice:* The system maintains a bounded multi-hypothesis state space $\mathcal{C} = \{S_1, S_2, \dots, S_M\}$. Candidates exhibiting resolvable violations are preserved up to a soft capacity bound $K_{\text{soft}}$, guaranteeing that states suffering temporarily from out-of-order evidence are not pruned prior to the arrival of matching parent fragments.
3. *Error-Tolerant String Transposition Metric:* Foreign key consistency verification integrates a bounded restricted Damerau-Levenshtein (optimal string alignment) metric. String transpositions within a configured threshold generate auditable ledger events (`FUZZY_CORRECTION`) and apply heuristic penalty weights rather than rejecting genuine corruptions.
4. *Shannon Entropy-Guided Active Disambiguation:* The system calculates the exact Shannon entropy $H(\mathcal{C})$ of the surviving candidate set and the conditional entropy $H(\mathcal{C} \mid A = v)$ across all disputed attributes. The system computes the Expected Information Gain $E[IG(A)] = H(\mathcal{C}) - E_v[H(\mathcal{C} \mid A = v)]$ and automatically rank-orders evidence probes, outputting an optimal investigation schedule that minimizes examiner inquiry time.
5. *Dual-Layer Verifiable Provenance Ledger:* Each fragment commit generates:
   - A sequential SHA-256 cryptographic hash chain ensuring immutable chronological ordering;
   - An event-scoped Keyed-Hash Message Authentication Code (HMAC) commitment envelope masking investigator identities and fragment values;
   - An incremental RFC 6962 binary Merkle tree accumulator computing verifiable inclusion proofs $(\pi)$ with $O(\log N)$ extraction and offline verification; and
   - An atomic case sealing mechanism freezing the case into an immutable state (`SEALED`) and exporting a standalone, zero-dependency audit bundle.

[0011] **Statutory Eligibility (Alice / 35 U.S.C. § 101 & Section 3(k) CRI Compliance):**
The invention achieves a clear, tangible, and measurable technical effect in computing systems:
- It eliminates combinatorial CPU and memory exhaustion, reducing recomputation complexity from exponential $O(K^N)$ to localized delta-tracked $O(K \cdot |\text{dom}|)$;
- It optimizes system storage by pruning fatal branches while preserving valid relational graphs in volatile memory; and
- It transforms physical computer storage by constructing verifiable tamper-evident cryptographic data structures and automated database states that function reliably in disconnected, zero-trust environments.

---

## BRIEF DESCRIPTION OF THE DRAWINGS
[0012] The accompanying drawings, which are incorporated in and constitute a part of this specification, illustrate embodiments of the invention and, together with the description, serve to explain the principles of the invention.

[0013] **FIG. 1** is a high-level architectural block diagram illustrating the Lazarus-X forensic reconstruction system, including evidence intake, constraint propagation engine, hypothesis lattice, active guidance engine, and dual-layer cryptographic ledger.

[0014] **FIG. 2** is a flowchart depicting the method for ingesting non-sequential partial evidence fragments, performing delta-tracked AC-3 constraint propagation, and classifying violations into fatal and resolvable categories.

[0015] **FIG. 3** is a schematic diagram illustrating the bounded multi-hypothesis candidate lattice, highlighting delayed pruning of candidate states during out-of-order relational fragment arrival.

[0016] **FIG. 4** is a mathematical workflow diagram illustrating the calculation of candidate probability distributions, Shannon entropy, conditional entropy, and Expected Information Gain (\Delta H).

[0017] **FIG. 5** is a structural diagram of the dual-layer cryptographic provenance ledger, showing the SHA-256 hash chain, HMAC public commitment envelope, and RFC 6962 binary Merkle accumulator.

[0018] **FIG. 6** is a state machine diagram showing the cryptographic case custody lifecycle, including atomic case sealing and fail-closed evidence rejection.

[0019] **FIG. 7** is a schematic representation of the binary Merkle inclusion proof tree traversal and offline independent verification algorithm.

[0020] **FIG. 8** is an exemplary graphical user interface illustration showing the cell-level candidate conflict matrix, relational lineage DAG, and court-ready forensic dossier.

---

## DETAILED DESCRIPTION OF THE PREFERRED EMBODIMENTS
[0021] The following detailed description refers to the accompanying drawings. The same reference numbers in different drawings identify the same or similar elements.

### 1. System Architecture & Relational Schema Modeling
[0022] Referring to **FIG. 1**, the system 100 comprises an Evidence Ingestion Interface 102, an Arc-Consistency Constraint Engine 104, a Multi-Hypothesis State Lattice 106, an Active Entropy Guidance Engine 108, a Dual-Layer Cryptographic Ledger 110, and a Forensic Visualization & Dossier Subsystem 112.

[0023] The database schema is formally defined as a tuple $\Sigma = (\mathcal{R}, \mathcal{U}, \mathcal{F})$, where:
- $\mathcal{R} = \{R_1, R_2, \dots, R_m\}$ is a set of relational tables;
- $\mathcal{U}$ is a set of unique constraints $\text{Unique}(R_i, \mathbf{U}_k)$, where $\mathbf{U}_k \subseteq \text{Attributes}(R_i)$;
- $\mathcal{F}$ is a set of foreign key constraints $\text{FK}(R_{\text{src}}, \mathbf{F}_{\text{src}}, R_{\text{tgt}}, \mathbf{F}_{\text{tgt}}, \mu)$, where $\mathbf{F}_{\text{src}}$ is an ordered list of source attributes, $\mathbf{F}_{\text{tgt}}$ is an ordered list of target attributes, and $\mu \in \{\text{SIMPLE}, \text{FULL}\}$ specifies null-value matching semantics.

### 2. Delta-Tracked AC-3 Propagation and Delayed Pruning
[0024] When an evidence fragment $e = (R_i, r_{\text{loc}}, A_j, v)$ is received, where $R_i \in \mathcal{R}$ is the relation name, $r_{\text{loc}} \in \mathbb{N}$ is the record locator, $A_j$ is the attribute name, and $v \in \text{Domain}(A_j)$ is the observed value, the system creates candidate state transitions.

[0025] Conventional systems evaluate all global constraints across the entire database instance $\mathcal{D}$, incurring $O(|\mathcal{R}| \cdot |\mathcal{D}|^2)$ computational overhead per incoming record. The present system maintains a localized constraint cache $C_{\text{cache}}$ and only evaluates constraints directly dependent on relation $R_i$ or tables referencing $R_i$.

[0026] Violations are partitioned into two strictly separated classes:
$$\mathcal{V}_{\text{fatal}}(S) = \{ v \in \text{Violations}(S) \mid \text{Type}(v) \in \{\text{UNIQUE\_COLLISION}, \text{IMMUTABLE\_CONFLICT}\} \}$$
$$\mathcal{V}_{\text{resolvable}}(S) = \{ v \in \text{Violations}(S) \mid \text{Type}(v) \in \{\text{MISSING\_FOREIGN\_PARENT}, \text{PENDING\_COMPOSITE}\} \}$$

[0027] **Delayed Pruning Algorithm:**
Let $K_{\text{hard}}$ be the maximum hard candidate bound (e.g., 10,000) and $K_{\text{soft}}$ be the target active hypothesis count (e.g., 200). If $|\mathcal{C}| > K_{\text{soft}}$:
1. Candidate states having $|\mathcal{V}_{\text{fatal}}(S)| > 0$ are immediately pruned.
2. Candidate states having $|\mathcal{V}_{\text{fatal}}(S)| = 0$ but $|\mathcal{V}_{\text{resolvable}}(S)| > 0$ are retained in memory in an unresolved pool $\mathcal{P}_{\text{resolv}}$ until $|\mathcal{C}| \ge K_{\text{hard}}$, at which point candidates are ranked and trimmed according to a heuristic scoring function $f_{\text{score}}(S)$:
$$f_{\text{score}}(S) = \alpha \cdot |\mathcal{V}_{\text{fatal}}(S)| + \beta \cdot |\mathcal{V}_{\text{resolvable}}(S)| + \gamma \cdot \text{FuzzyPenalty}(S) + \delta \cdot \sum_{e \in S} (1 - \text{conf}(e))$$
where $\alpha \gg \beta > 0$, guaranteeing that genuine states awaiting parent fragments survive out-of-order streams.

### 3. Error-Tolerant Damerau-Levenshtein Metric
[0028] In forensic evidence extraction, physical media corruption often induces single-character transpositions, insertions, deletions, or substitutions. For foreign key matching where exact string identity fails, the system executes an optimal string alignment metric computing the restricted Damerau-Levenshtein distance $d_{\text{DL}}(s_1, s_2)$ allowing:
1. Insertion of a character (cost 1);
2. Deletion of a character (cost 1);
3. Substitution of a character (cost 1); and
4. Transposition of two adjacent characters (cost 1).

[0029] When $d_{\text{DL}}(\text{val}_{\text{src}}, \text{val}_{\text{tgt}}) \le \theta_{\text{cutoff}}$ (where $\theta_{\text{cutoff}} \in [1, 2]$), the foreign key match is accepted as a valid fuzzy link, triggering:
- Emission of an immutable `FUZZY_CORRECTION` ledger event;
- Computation of normalization entropy in nats: $H_{\text{nats}} = -\sum p_j \ln(p_j)$; and
- Application of a bounded penalty term to $f_{\text{score}}(S)$ without causing catastrophic state rejection.

### 4. Shannon Entropy-Guided Disambiguation
[0030] Referring to **FIG. 4**, the system models the surviving candidate states $\mathcal{C} = \{S_1, S_2, \dots, S_M\}$ as a probability distribution where the normalized probability $P(S_i)$ of hypothesis $S_i$ is computed as:
$$P(S_i) = \frac{\exp\left(-f_{\text{score}}(S_i)\right)}{\sum_{k=1}^{M} \exp\left(-f_{\text{score}}(S_k)\right)}$$

[0031] The base Shannon entropy $H(\mathcal{C})$ representing the total ambiguity in the reconstructed database is computed in bits as:
$$H(\mathcal{C}) = -\sum_{i=1}^{M} P(S_i) \log_2 P(S_i)$$

[0032] For any unconfirmed attribute $A_j$ of record $r_{\text{loc}}$ in relation $R_k$, let $\mathcal{V}(A_j) = \{v_1, v_2, \dots, v_q\}$ be the set of distinct values assigned to attribute $A_j$ across the surviving hypotheses. The marginal probability of observing value $v \in \mathcal{V}(A_j)$ is:
$$P(A_j = v) = \sum_{S_i \in \mathcal{C} : S_i[R_k][r_{\text{loc}}][A_j] = v} P(S_i)$$

[0033] Conditioning the candidate space on hypothetical observation $A_j = v$ yields the conditional probability distribution $P(S_i \mid A_j = v) = \frac{P(S_i)}{P(A_j = v)}$ for states consistent with $v$. The conditional entropy of the hypothesis lattice given observation $v$ is:
$$H(\mathcal{C} \mid A_j = v) = -\sum_{S_i \in \mathcal{C} : S_i(A_j) = v} P(S_i \mid A_j = v) \log_2 P(S_i \mid A_j = v)$$

[0034] The Expected Conditional Entropy across all potential outcomes for attribute $A_j$ is:
$$E_v[H(\mathcal{C} \mid A_j = v)] = \sum_{v \in \mathcal{V}(A_j)} P(A_j = v) H(\mathcal{C} \mid A_j = v)$$

[0035] The Expected Information Gain $E[IG(A_j)]$ is calculated as:
$$E[IG(A_j)] = H(\mathcal{C}) - E_v[H(\mathcal{C} \mid A_j = v)]$$

[0036] The system identifies all disputed attributes where $|\mathcal{V}(A_j)| > 1$, evaluates $E[IG(A_j)]$, and constructs an optimal rank-ordered recommendation list $\mathcal{R}_{\text{inquiry}} = \text{sort}_{\text{desc}}(E[IG(A_j)])$. This enables investigators to formulate active forensic queries that eliminate the maximum bits of uncertainty per probe.

### 5. Dual-Layer Verifiable Cryptographic Provenance Ledger
[0037] Referring to **FIG. 5**, each committed evidence event $k$ is permanently recorded in a dual-layer cryptographic ledger comprising:
1. *Sequential Hash Chain:*
   $$h_k = \text{SHA-256}(h_{k-1} \mathbin{\Vert} \text{Seq}_k \mathbin{\Vert} \text{Timestamp}_k \mathbin{\Vert} \text{EventData}_k)$$
   where $h_0 = \text{GenesisHash} = \text{SHA-256}(\text{CaseID} \mathbin{\Vert} \text{MasterSalt})$.
2. *Selective Disclosure HMAC Commitment Envelope:*
   To prevent leaking investigator identity and sensitive attribute data to unauthorized parties, the system generates:
   $$\text{ActorCommitment}_k = \text{HMAC-SHA256}(K_{\text{actor}}, \text{InvestigatorID} \mathbin{\Vert} \text{Seq}_k)$$
   $$\text{PayloadCommitment}_k = \text{HMAC-SHA256}(K_{\text{payload}}, \text{CanonicalJSON}(\text{Fragment}_k) \mathbin{\Vert} \text{Seq}_k)$$
   $$\text{EnvelopeHash}_k = \text{SHA-256}(\text{PrevEnvelopeHash}_{k-1} \mathbin{\Vert} \text{Seq}_k \mathbin{\Vert} \text{ActorCommitment}_k \mathbin{\Vert} \text{PayloadCommitment}_k)$$
3. *RFC 6962 Binary Merkle Accumulator:*
   Each envelope commitment forms a leaf node in an incremental RFC 6962 binary Merkle tree:
   $$L_i = \text{SHA-256}(0x00 \mathbin{\Vert} \text{EnvelopeHash}_i)$$
   $$N_{\text{parent}} = \text{SHA-256}(0x01 \mathbin{\Vert} \text{LeftChild} \mathbin{\Vert} \text{RightChild})$$
   When an odd number of nodes exists at a given depth, the rightmost node is duplicated according to RFC 6962 rules.
   The accumulator provides $O(\log N)$ inclusion proofs $\pi_i = (L_i, \{S_1, S_2, \dots, S_d\}, \text{RootHash})$ verifying inclusion of any evidence fragment without requiring access to other case fragments.

### 6. Atomic Case Sealing and Fail-Closed Evidentiary Freeze
[0038] Referring to **FIG. 6**, when an investigation reaches completion, the investigator issues an authenticated seal command. The system initiates an atomic database transaction:
1. Case status is set to `SEALED` and `sealedAt` timestamp is anchored.
2. A final `ProvenanceCheckpointManifest` is computed, anchoring:
   $$\text{SealedRoot} = \text{MerkleRoot}_N$$
   $$\text{FinalSequence} = N$$
   $$\text{ChainHeadHash} = h_N$$
3. All subsequent calls to `POST /api/cases/:id/evidence` are rejected immediately with HTTP `409 CASE_SEALED`.
4. The system exports a standardized, standalone audit bundle (`application/vnd.lazarus-x.audit-bundle.v1+json`) verifiable offline by an independent verifier (`verify-audit-bundle.cjs`) with zero third-party dependencies.

---

## FORMAL PATENT CLAIMS

### What is claimed is:

**1. A forensic database reconstruction computing system, comprising:**
one or more hardware processors; and
one or more non-transitory computer-readable storage media storing instructions that, when executed by the one or more hardware processors, cause the system to:
ingest a plurality of partial forensic evidence fragments associated with a relational database schema comprising a plurality of relations, at least one unique constraint, and at least one foreign key constraint, wherein the partial forensic evidence fragments arrive out-of-order and unsequenced without database transaction log boundaries;
maintain a multi-hypothesis candidate state space comprising a plurality of competing candidate database instances;
execute an incremental Arc-Consistency constraint propagation process over the plurality of relations for each incoming partial forensic evidence fragment;
classify constraint violations detected during the constraint propagation process into fatal violations comprising primary key collisions and contradictory immutable attributes, and resolvable violations comprising missing referenced foreign key records under an open-world relational assumption;
delay pruning of candidate database instances exhibiting resolvable violations while immediately pruning candidate database instances exhibiting fatal violations, thereby preserving valid relational hypotheses during out-of-order fragment arrival;
compute, for each surviving candidate database instance, a heuristic penalty score and a normalized probability distribution; and
record each ingested partial forensic evidence fragment in an append-only cryptographic provenance ledger.

**2. The system of claim 1,** wherein the at least one foreign key constraint is a composite foreign key constraint defined over an ordered plurality of source fields and an ordered plurality of target fields, and wherein the instructions further cause the system to evaluate the composite foreign key constraint according to configurable simple null matching semantics and full null matching semantics.

**3. The system of claim 1,** wherein the instructions further cause the system to evaluate foreign key string compatibility using a bounded restricted Damerau-Levenshtein metric that tolerates adjacent character transpositions within a predetermined distance threshold, and wherein identifying a transposition match causes the system to emit an auditable fuzzy correction ledger event and apply a heuristic penalty weight to the candidate database instance.

**4. The system of claim 1,** wherein the instructions further cause the system to retain candidate database instances exhibiting zero fatal violations and one or more resolvable violations in an unresolved candidate pool up to a soft candidate threshold, and to prune the unresolved candidate pool only when a total hypothesis count exceeds a hard candidate threshold.

**5. The system of claim 1,** wherein the instructions further cause the system to:
calculate a base Shannon entropy across the plurality of surviving candidate database instances representing total relational ambiguity;
calculate an expected conditional entropy for each disputed attribute across the plurality of surviving candidate database instances; and
determine an Expected Information Gain for each disputed attribute and output a rank-ordered investigative inquiry schedule to guide subsequent evidence acquisition.

**6. The system of claim 1,** wherein the append-only cryptographic provenance ledger comprises:
a sequential hash chain linking each ingested fragment to an immediately preceding block hash; and
a selective disclosure commitment envelope comprising a keyed hash message authentication code (HMAC) commitment of an investigator identity and a keyed HMAC commitment of a canonical fragment payload, whereby the provenance ledger proves tamper-evident sequence monotonicity without disclosing unredacted attribute values.

**7. The system of claim 6,** wherein the instructions further cause the system to incrementally accumulate envelope hashes into an RFC 6962 binary Merkle tree, and to extract a logarithmic inclusion proof verifying inclusion of a specific evidence fragment relative to a published Merkle root hash.

**8. The system of claim 1,** wherein the instructions further cause the system to execute an atomic case sealing transaction in response to an authorized sealing command, wherein executing the atomic case sealing transaction sets an immutable sealed status on the case, anchors a final Merkle root checkpoint, and causes all subsequent evidence ingestion requests for the case to be rejected fail-closed with a status conflict response.

**9. The system of claim 8,** wherein the instructions further cause the system to export an offline audit bundle comprising the plurality of commitment envelopes, the final Merkle root checkpoint, and cryptographic verification metadata formatted according to a standardized media type.

**10. The system of claim 5,** further comprising a display device configured to render an interactive cell-level candidate conflict matrix displaying unanimous consensus attributes, disputed attributes, probability distribution bars for predicted values, and expected information gain metrics.

---

**11. A computer-implemented method for entropy-guided active forensic disambiguation in database reconstruction, comprising:**
maintaining, by one or more processors, a candidate set of competing relational database states reconstructed from partial evidence fragments;
assigning, by the one or more processors, a probability $P(S_i)$ to each competing candidate state $S_i$ based on constraint violation penalties and source confidence weights;
computing, by the one or more processors, a base Shannon entropy $H(\mathcal{C})$ of the candidate set according to:
$$H(\mathcal{C}) = -\sum_{i=1}^{M} P(S_i) \log_2 P(S_i)$$
identifying, by the one or more processors, a set of disputed attributes, wherein each disputed attribute exhibits two or more distinct values across the candidate set;
for each disputed attribute $A$, calculating an expected conditional entropy $E[H(\mathcal{C} \mid A)]$ across potential observed values $\mathcal{V}(A)$ according to:
$$E[H(\mathcal{C} \mid A)] = \sum_{v \in \mathcal{V}(A)} P(A = v) \left( -\sum_{S_i : S_i(A)=v} P(S_i \mid A=v) \log_2 P(S_i \mid A=v) \right)$$
calculating an Expected Information Gain $E[IG(A)] = H(\mathcal{C}) - E[H(\mathcal{C} \mid A)]$; and
generating and displaying a prioritized investigation probe recommendation list rank-ordered by Expected Information Gain to guide active evidence collection.

**12. The method of claim 11,** further comprising:
receiving a user selection of a recommended investigation probe from the prioritized investigation probe recommendation list; and
automatically pre-populating an evidence intake form with a relation identifier, a record locator, and an attribute name corresponding to the selected investigation probe.

**13. The method of claim 11,** wherein the candidate set of competing relational database states is generated by executing an Arc-Consistency 3 (AC-3) domain propagation algorithm over composite foreign key constraints.

**14. The method of claim 11,** wherein candidate states exhibiting unfulfilled foreign key references are classified as resolvable violations and preserved under an open-world relational assumption to accommodate out-of-order evidence arrival.

**15. The method of claim 11,** wherein foreign key evaluations accommodate string transpositions via a restricted Damerau-Levenshtein distance within a threshold of two edits.

**16. The method of claim 11,** further comprising committing each received evidence fragment to an append-only cryptographic hash chain and computing a binary RFC 6962 Merkle tree root.

**17. The method of claim 16,** further comprising generating a selective disclosure verification envelope using keyed hash message authentication code (HMAC) commitments.

**18. The method of claim 11,** further comprising executing an atomic case sealing operation that freezes candidate state evolution and prevents subsequent evidence commits.

---

**19. A non-transitory computer-readable storage medium storing instructions that, when executed by one or more processors, cause the one or more processors to perform operations comprising:**
ingesting a stream of unsequenced partial relational database evidence fragments;
generating a plurality of candidate database instances by evaluating incoming fragments against relational schema constraints;
classifying constraint violations into fatal violations and resolvable violations, wherein resolvable violations represent missing referenced parent records;
delaying pruning of candidate database instances having resolvable violations until a total candidate count exceeds a capacity threshold;
recording each ingested evidence fragment into a dual-layer cryptographic provenance ledger comprising:
a sequential SHA-256 hash chain guaranteeing chronological ordering;
a keyed HMAC selective disclosure envelope masking sensitive attributes and examiner identities; and
an incremental binary Merkle tree accumulator computing a cryptographically verifiable inclusion root; and
in response to an authorized case seal request, executing an atomic transaction that transitions the case to an immutable sealed status, anchors a final Merkle root, and rejects all subsequent evidence submissions.

**20. The non-transitory computer-readable storage medium of claim 19,** wherein the operations further comprise generating an RFC 6962 Merkle inclusion proof for any selected evidence fragment, wherein the inclusion proof comprises sibling node hashes and sibling side indicators enabling independent offline verification of the fragment against the final Merkle root.

**21. The non-transitory computer-readable storage medium of claim 19,** wherein the operations further comprise evaluating composite foreign key constraints across an ordered list of fields with configurable null matching semantics.

**22. The non-transitory computer-readable storage medium of claim 19,** wherein the operations further comprise evaluating foreign key text strings using a restricted Damerau-Levenshtein metric permitting adjacent character transpositions.

**23. The non-transitory computer-readable storage medium of claim 19,** wherein the operations further comprise calculating Shannon conditional entropy across disputed attributes to generate a prioritized forensic inquiry recommendation list.

**24. The non-transitory computer-readable storage medium of claim 19,** wherein the operations further comprise exporting a self-contained offline audit bundle verifiable by an independent zero-dependency verifier script.

**25. The non-transitory computer-readable storage medium of claim 19,** wherein the operations further comprise rendering an interactive graphical user interface comprising a relational schema lineage graph, a cell-level conflict matrix, and an official court-ready forensic dossier.

---

## ABSTRACT OF THE DISCLOSURE
A system, method, and non-transitory computer-readable medium are disclosed for deterministic multi-hypothesis relational database forensic reconstruction. The system ingests unsequenced, partial evidence fragments without transaction logs and maintains a bounded candidate hypothesis space under delta-tracked Arc-Consistency (AC-3) constraint propagation over composite foreign keys and error-tolerant string transposition metrics. Constraint violations are categorized into fatal violations (pruned immediately) and resolvable violations (preserved under open-world delayed pruning to prevent premature state destruction during out-of-order evidence arrival). The system calculates candidate probabilities and Shannon entropy, determining Expected Information Gain to rank-order active forensic inquiry probes. Each fragment is anchored in a dual-layer cryptographic provenance ledger combining a sequential hash chain, a selective disclosure keyed HMAC envelope, an RFC 6962 binary Merkle tree accumulator, and atomic case sealing for court-ready custody attestation.
