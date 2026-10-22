# LAZARUS-X — Comprehensive Data Dictionary

> **System**: LAZARUS-X Forensic Relational Database Reconstruction  
> **Course**: BCSE302P — Database Management Systems Assessment  
> **Schema Standard**: 11 Normalized Relational Tables (PostgreSQL 15 / SQLite 3 via Prisma ORM)  
> **Integrity Level**: Boyce-Codd Normal Form (BCNF) / 3NF  

---

## 1. Table Summary & Taxonomy

| # | Table Name | Category | Primary Key | Total Attributes | Purpose |
| :-: | :--- | :--- | :--- | :-: | :--- |
| **1** | `User` | Identity & RBAC | `id` (UUID) | 5 | Single users table maintaining administrative and investigator roles |
| **2** | `Session` | Authentication | `id` (UUID) | 5 | Ephemeral bearer session tokens with SHA-256 digest hashing (24h TTL) |
| **3** | `AuditLog` | Compliance | `id` (UUID) | 6 | Append-only system action logging for legal admissibility |
| **4** | `ReconstructionCase` | Forensic Core | `id` (UUID) | 10 | Primary investigation case envelope and cryptographic head container |
| **5** | `EvidenceFragment` | Forensic Core | `id` (UUID) | 8 | Granular scalar field-level observed evidence fragments |
| **6** | `EvidenceProvenanceEntry`| Cryptographic Ledger | `id` (UUID) | 11 | Immutable SHA-256 hash-chained Merkle ledger events |
| **7** | `CandidateReconstruction` | CSP Engine | `id` (UUID) | 6 | Ranked candidate relational database state interpretations |
| **8** | `ConstraintEvaluation` | CSP Engine | `id` (UUID) | 6 | AC-3 constraint satisfaction audit records and collision metrics |
| **9** | `Department` | Benchmark Target | `id` (Int) | 2 | Target enterprise organizational department relation |
| **10**| `Employee` | Benchmark Target | `id` (Int) | 3 | Target enterprise employee records with foreign key to Department |
| **11**| `Order` | Benchmark Target | `id` (Int) | 3 | Target commercial sales transactions linked to Employees |

---

## 2. Granular Table Specifications

### 2.1 Table: `User`
*Maintains all system identities in strict compliance with the Single Users Table rule.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | TEXT (UUID) | NO | PRIMARY KEY | `uuid()` | Globally unique identity identifier |
| `email` | TEXT | NO | UNIQUE, NOT NULL | - | Investigator login email address |
| `passwordHash` | TEXT | NO | NOT NULL | - | BCrypt hashed password (Cost 12) |
| `role` | TEXT | NO | CHECK ('ADMIN', 'INVESTIGATOR') | `'INVESTIGATOR'` | Role-based permission tier |
| `createdAt` | TIMESTAMP | NO | NOT NULL | `now()` | User registration timestamp |

---

### 2.2 Table: `Session`
*Manages ephemeral bearer session digests with automatic expiry cleanup.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | TEXT (UUID) | NO | PRIMARY KEY | `uuid()` | Session transaction identifier |
| `token` | TEXT | NO | UNIQUE, NOT NULL | - | SHA-256 digest of bearer token |
| `userId` | TEXT (UUID) | NO | FOREIGN KEY (`User.id`) | - | Owning investigator reference (`ON DELETE CASCADE`) |
| `expiresAt` | TIMESTAMP | NO | NOT NULL | - | Absolute session expiration threshold (24 hours) |
| `createdAt` | TIMESTAMP | NO | NOT NULL | `now()` | Session issuance timestamp |

---

### 2.3 Table: `AuditLog`
*Tamper-evident record of all security-critical system mutations.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | TEXT (UUID) | NO | PRIMARY KEY | `uuid()` | Audit event identifier |
| `userId` | TEXT (UUID) | NO | FOREIGN KEY (`User.id`) | - | Acting user reference |
| `action` | TEXT | NO | NOT NULL | - | Action name (`LOGIN`, `CREATE_CASE`, `SEAL_CASE`) |
| `resourceType` | TEXT | YES | - | `NULL` | Entity type affected (`CASE`, `EVIDENCE`, `USER`) |
| `resourceId` | TEXT | YES | - | `NULL` | Identifier of affected resource |
| `timestamp` | TIMESTAMP | NO | NOT NULL | `now()` | High-resolution event timestamp |

---

### 2.4 Table: `ReconstructionCase`
*Central container representing an active or sealed database reconstruction investigation.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | TEXT (UUID) | NO | PRIMARY KEY | `uuid()` | Investigation case identifier |
| `name` | TEXT | NO | NOT NULL | `'Untitled Case'` | Descriptive investigation case name |
| `status` | TEXT | NO | CHECK ('ACTIVE', 'SEALED', 'RESOLVED') | `'ACTIVE'` | Case lifecycle status |
| `currentState` | TEXT | NO | NOT NULL (JSON) | - | JSON serialized state of consensus candidate |
| `provenanceHead`| TEXT | NO | NOT NULL (SHA-256) | Genesis hash | Current tip hash of append-only audit chain |
| `provenanceSequence`| INTEGER | NO | NOT NULL | `0` | Monotonically incrementing ledger event counter |
| `provenanceSaltCiphertext`| TEXT | YES| AES-256-GCM | `NULL` | Encrypted case salt for proof isolation |
| `ownerId` | TEXT (UUID) | NO | FOREIGN KEY (`User.id`) | - | Lead investigator owner reference |
| `createdAt` | TIMESTAMP | NO | NOT NULL | `now()` | Case initialization timestamp |
| `updatedAt` | TIMESTAMP | NO | NOT NULL | `auto-updated`| Last modification timestamp |

*Indexes*: `@@index([ownerId, updatedAt])`

---

### 2.5 Table: `EvidenceFragment`
*Individual scalar attribute observations ingested from forensic sources.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | TEXT (UUID) | NO | PRIMARY KEY | `uuid()` | Evidence fragment identifier |
| `caseId` | TEXT (UUID) | NO | FOREIGN KEY (`ReconstructionCase.id`) | - | Parent case reference (`ON DELETE CASCADE`) |
| `table` | TEXT | NO | NOT NULL | - | Target relation (`Department`, `Employee`, `Order`) |
| `recordId` | INTEGER | NO | NOT NULL | - | Entity primary key in target domain |
| `field` | TEXT | NO | NOT NULL | - | Target attribute column name |
| `value` | TEXT | NO | NOT NULL | - | Serialized observed attribute value |
| `userId` | TEXT (UUID) | NO | FOREIGN KEY (`User.id`) | - | Submitting investigator identifier |
| `timestamp` | TIMESTAMP | NO | NOT NULL | `now()` | Ingestion timestamp |

*Indexes*: `@@index([caseId, id])`

---

### 2.6 Table: `EvidenceProvenanceEntry`
*Immutable, tamper-evident SHA-256 hash-chained event record providing non-repudiation.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | TEXT (UUID) | NO | PRIMARY KEY | `uuid()` | Immutable ledger entry UUID |
| `caseId` | TEXT (UUID) | NO | FOREIGN KEY (`ReconstructionCase.id`) | - | Parent case reference (`ON DELETE CASCADE`) |
| `sequence` | INTEGER | NO | NOT NULL | - | Monotonically ascending per-case counter |
| `eventType` | TEXT | NO | NOT NULL | - | Event type (`EVIDENCE_ACCEPTED`, `FUZZY_CORRECTION`) |
| `fragmentId` | TEXT (UUID) | NO | NOT NULL | - | Ingested evidence fragment identifier |
| `relatedFragmentIds`| TEXT | NO | NOT NULL (JSON) | - | Canonical JSON array of referenced fragments |
| `actorId` | TEXT | NO | NOT NULL | - | HMAC-SHA256 pseudonymized investigator identity |
| `receivedAt` | TIMESTAMP | NO | NOT NULL | - | UTC ingestion timestamp |
| `payload` | TEXT | NO | NOT NULL (JSON) | - | Canonical JSON payload of mutation details |
| `previousHash`| TEXT | NO | NOT NULL (SHA-256) | - | Hash commitment of preceding entry in chain |
| `hash` | TEXT | NO | NOT NULL (SHA-256) | - | SHA-256 digest of `(previousHash + payload + salt)` |

*Constraints & Indexes*:  
- `@@unique([caseId, sequence])` — Guarantees continuous linear progression without gaps  
- `@@index([caseId, hash])` — Rapid chain-of-custody verification lookups  
- `@@index([caseId, receivedAt])` — Temporal range audits  

---

### 2.7 Table: `CandidateReconstruction`
*Relational database hypotheses generated by the CSP entropy-minimization engine.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | TEXT (UUID) | NO | PRIMARY KEY | `uuid()` | Candidate interpretation identifier |
| `caseId` | TEXT (UUID) | NO | FOREIGN KEY (`ReconstructionCase.id`) | - | Parent case reference (`ON DELETE CASCADE`) |
| `stateDump` | TEXT | NO | NOT NULL (JSON) | - | JSON serialized full relational state dump |
| `probabilityScore`| REAL/FLOAT| NO | NOT NULL | `0.0` | Heuristic Bayesian likelihood score |
| `isPruned` | BOOLEAN | NO | NOT NULL | `false` | True if eliminated by fatal constraint collision |
| `createdAt` | TIMESTAMP | NO | NOT NULL | `now()` | Candidate generation timestamp |

---

### 2.8 Table: `ConstraintEvaluation`
*Audit trail tracking AC-3 relational constraint evaluations.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | TEXT (UUID) | NO | PRIMARY KEY | `uuid()` | Constraint evaluation record UUID |
| `caseId` | TEXT (UUID) | NO | FOREIGN KEY (`ReconstructionCase.id`) | - | Parent case reference (`ON DELETE CASCADE`) |
| `constraintId`| TEXT | NO | NOT NULL | - | Evaluated constraint identifier (`PK_UNIQUE`, `FK_DEP`) |
| `fatalViolations`| INTEGER | NO | NOT NULL | `0` | Count of unresolvable schema collisions |
| `resolvableViolations`| INTEGER | NO | NOT NULL | `0` | Count of resolvable missing parent relations |
| `evaluatedAt` | TIMESTAMP | NO | NOT NULL | `now()` | AC-3 execution timestamp |

---

### 2.9 Table: `Department`
*Target domain relation representing enterprise organizational divisions.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | INTEGER | NO | PRIMARY KEY, AUTOINCREMENT | Autoincrement | Department identifier |
| `name` | TEXT | NO | NOT NULL | - | Department name (e.g. 'Engineering', 'Forensics') |

---

### 2.10 Table: `Employee`
*Target domain relation representing personnel, linked via foreign key to Department.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | INTEGER | NO | PRIMARY KEY, AUTOINCREMENT | Autoincrement | Employee identifier |
| `name` | TEXT | NO | NOT NULL | - | Employee name |
| `departmentId`| INTEGER | NO | FOREIGN KEY (`Department.id`) | - | Department reference enforcing referential integrity |

---

### 2.11 Table: `Order`
*Target domain relation capturing commercial business operations.*

| Attribute | Data Type | Nullable | Key / Constraints | Default | Description |
| :--- | :--- | :-: | :--- | :--- | :--- |
| `id` | INTEGER | NO | PRIMARY KEY, AUTOINCREMENT | Autoincrement | Sales transaction identifier |
| `amount` | REAL/FLOAT| NO | NOT NULL | - | Monetary transaction amount |
| `employeeId`| INTEGER | NO | FOREIGN KEY (`Employee.id`) | - | Originating employee identifier |

---

## 3. Referential Integrity & Deletion Rules

```
User (1) ──────────┬───> Session (N)                  [CASCADE]
                   ├───> ReconstructionCase (N)        [RESTRICT]
                   ├───> AuditLog (N)                  [RESTRICT]
                   └───> EvidenceFragment (N)          [RESTRICT]

ReconstructionCase (1) ──┬───> EvidenceFragment (N)            [CASCADE]
                         ├───> EvidenceProvenanceEntry (N)     [CASCADE]
                         ├───> CandidateReconstruction (N)     [CASCADE]
                         └───> ConstraintEvaluation (N)        [CASCADE]

Department (1) ──────────────> Employee (N)                    [RESTRICT]
Employee (1) ────────────────> Order (N)                       [RESTRICT]
```
