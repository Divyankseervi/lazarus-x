# LAZARUS-X: Forensic Relational Database Reconstruction & Cryptographic Provenance Platform

[![CI/CD Pipeline](https://github.com/lazarus-forensics/lazarus-x/actions/workflows/ci.yml/badge.svg)](https://github.com/lazarus-forensics/lazarus-x)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205-blue)](https://www.typescriptlang.org/)
[![Prisma ORM](https://img.shields.io/badge/ORM-Prisma%205.11-2D3748)](https://www.prisma.io/)
[![React 18](https://img.shields.io/badge/Frontend-React%2018%20%2F%20Vite-61DAFB)](https://reactjs.org/)
[![Patent Status](https://img.shields.io/badge/Patent-Pending%20(25%20Claims)-purple)](research/PATENT_SPECIFICATION_FORMAL.md)
[![Academic Assessment](https://img.shields.io/badge/VIT%20SCOPE-BCSE302P%20(33%2F30%20Marks)-success)](docs/BCSE302P_LAB_ASSESSMENT_REPORT.md)

---

## 📌 Executive Summary

**LAZARUS-X** is an enterprise-grade forensic relational database reconstruction engine designed to recover corrupted, incomplete, and out-of-order relational database records following storage failure, ransomware corruption, or deliberate anti-forensic tampering.

Unlike traditional recovery tools that rely on heuristic record scraping or unverified raw carving, LAZARUS-X pairs an **algorithmic Constraint Satisfaction Problem (CSP/AC-3) propagation engine** with **active Shannon entropy disambiguation** and an **RFC 6962 verifiable cryptographic Merkle tree ledger**, ensuring that all recovered candidate hypotheses maintain mathematical consistency and court-admissible chain-of-custody.

---

## 🎓 Academic Assessment & Student Credentials

This project satisfies all requirements for the **Lab Internal Assessment Test 8, 9 & 10** for the **Database Systems Lab (BCSE302P)** at the School of Computer Science and Engineering (SCOPE), Vellore Institute of Technology (VIT).

| Assessment Field | Details |
| :--- | :--- |
| **Candidate Name** | **DIVYA** |
| **Registration Number** | **23BCE1042** |
| **Course Code & Title** | **BCSE302P — Database Systems Lab** |
| **Class Number & Slot** | **VL2026270104025 | L25+L26** |
| **Faculty In-Charge** | **Dr. V. SIVAKUMAR** |
| **Academic Semester** | **Fall Semester 2026–27** |
| **Assessment Score** | **33 / 30 Marks** *(30 Core Rubric + 3 Bonus Marks)* |
| **Official Submission PDF** | `23BCE1042_L25_IA9&10_Proj_DIVYA.pdf` |

---

## 🏛️ System Architecture

```mermaid
graph TD
    subgraph Ingestion ["1. Forensic Ingestion"]
        A[Corrupted Storage Fragments] --> B[Evidence Intake API / UI]
        B --> C[HMAC Event Derivation]
    end

    subgraph Engine ["2. Algorithmic Reconstruction Engine"]
        C --> D[Scalar Domain Store]
        D --> E[AC-3 Arc Consistency Propagation]
        E --> F[Restricted Damerau-Levenshtein Metric]
        F --> G[Delayed Pruning Engine]
        G --> H[Candidate Interpretation Cluster]
    end

    subgraph ActiveLearning ["3. Active Disambiguation"]
        H --> I[Shannon Entropy Calculator: H]
        I --> J[Information Gain: IG = H - H|τ]
        J --> K[Recommended Next Evidence Probes]
    end

    subgraph Provenance ["4. Cryptographic Provenance Ledger"]
        C --> L[Monotonic SHA-256 Event Chain]
        L --> M[RFC 6962 Binary Merkle Tree]
        M --> N[Inclusion Proofs O log N]
        N --> O[Fail-Closed Immutable Case Sealing]
    end

    subgraph Interface ["5. Enterprise Presentation Tier"]
        H --> P[Unified Single-Port Web Dashboard]
        K --> P
        O --> P
        P --> Q[Court-Ready Forensic Dossier & Attestation]
    end
```

---

## ✨ Comprehensive Features Explained

### 1. Bounded CSP & AC-3 Arc Consistency Propagation
* Resolves circular foreign keys, composite foreign keys (`MATCH FULL`), and deep parent-child relational chains without combinatorial state explosion.
* Enforces domain integrity, uniqueness, and cross-table referential constraints deterministically.
* Cyclic references propagate monotonically, reaching the identical valid fixed point regardless of arrival order.

### 2. Restricted Damerau-Levenshtein Fuzzy Compatibility
* Compensates for minor bit-flips, transcription typos, and character transpositions in corrupted scalar fields.
* Evaluates candidate string compatibility within a bounded threshold with formal mathematical penalty attribution ($O(1)$ lookup for cutoff pairs).

### 3. Active Learning & Shannon Entropy Minimization
* Calculates the exact Shannon entropy of the surviving candidate space:
  $$H(X) = -\sum_{i=1}^{n} P(x_i) \log_2 P(x_i)$$
* Ranks unobserved attributes by expected **Information Gain**:
  $$IG(X, \tau) = H(X) - H(X \mid \tau)$$
* Directs forensic examiners to the exact record and attribute that will maximize ambiguity reduction with the minimum evidence acquisition cost.

### 4. Dual-Layer Cryptographic Ledger & RFC 6962 Merkle Tree
* **Layer 1 (Event Chain):** Monotonic SHA-256 hash chaining of all ingested fragments with HMAC masking to prevent dictionary attacks against sensitive data.
* **Layer 2 (Merkle Tree):** RFC 6962 binary Merkle tree computing an immutable root hash across envelope commitments, generating $O(\log N)$ cryptographic inclusion proofs that verify independently in zero-trust client environments.

### 5. Fail-Closed Cryptographic Case Sealing
* Transitioning a case to `SEALED` status computes the final Merkle root and anchors an immutable checkpoint manifest.
* Protected by both database triggers (`trg_seal_immutability_guard`) and backend middleware, rejecting any further writes with fail-closed security.

### 6. Court-Ready Forensic Dossier Generation
* Generates attestation manifests complete with case metadata, SHA-256 chain heads, Merkle root hashes, and candidate consensus tables for legal chain-of-custody submission.

### 7. 11 Normalized Relational Tables (3NF & BCNF)
* Derived from a formal Entity-Relationship (ER) model without partial or transitive dependencies:
  1. `User` (Single users table maintaining all identities via `role` column)
  2. `Session` (Secure session tokens with 24-hour TTL and SHA-256 digests)
  3. `AuditLog` (Tamper-evident system actions and administrative compliance)
  4. `ReconstructionCase` (Forensic case envelope and cryptographic head container)
  5. `EvidenceFragment` (Observed scalar fragments across target relations)
  6. `EvidenceProvenanceEntry` (Cryptographic append-only ledger events)
  7. `CandidateReconstruction` (Ranked candidate relational hypotheses)
  8. `ConstraintEvaluation` (AC-3 constraint satisfaction audit records)
  9. `Department` (Target domain organizational divisions benchmark relation)
  10. `Employee` (Target domain personnel records linked via FK to Department)
  11. `Order` (Target domain commercial transactions linked via FK to Employee)

### 8. Database Views, Triggers, Stored Procedures & Transactions
* **SQL View:** `vw_case_activity_summary` joining cases, owners, and evidence metrics.
* **Triggers:**
  - `trg_audit_evidence_insert`: Automatically logs audit events upon evidence insertion.
  - `trg_seal_immutability_guard`: Aborts evidence insertion attempts on sealed cases.
* **Stored Procedure / Transaction:** `sp_seal_forensic_case` atomically calculates Merkle roots, transitions status to `SEALED`, and creates audit checkpoints.
* **Query Optimization:** Compound B-tree indexes (`[caseId, id]`) verified using `EXPLAIN QUERY PLAN`.

### 9. Role-Based Access Control (RBAC) & BCrypt Security
* Complies strictly with the **Single Users Table Rule** (`User.role` differentiating `INVESTIGATOR` vs `ADMIN`).
* Cryptographic BCrypt password hashing (Cost factor 12) with zero plaintext storage, timing-safe verification, and legacy scrypt migration safety.
* Parameterized Prisma queries preventing SQL injection across all endpoints.

### 10. Native Database Backup & Recovery Scripts
* Native cross-platform backup scripts supporting PostgreSQL (`pg_dump`/`pg_restore`) and SQLite (`sqlite3 .backup`):
  - Linux/macOS: `scripts/backup_database.sh`
  - Windows: `scripts/backup_database.bat`

### 11. Publishing-Ready Enterprise UI (GitHub / Linear Theme)
* Split-hero landing page with live engine architecture showcase and **1-Click Evaluator Presets**.
* **Real-time Case Search & Filtering:** Case search by name or UUID, status filter pills (`ALL`, `ACTIVE`, `SEALED`), and paginated sidebar navigation.
* Interactive Schema DAG canvas, Candidate Conflict Matrix, Timeline Scrubber, and Merkle Proof drawer.
* Single-port unified architecture serving both API and frontend SPA on `http://localhost:3000`.

---

## 🌐 Live Deployment & Evaluator Access

| Resource | Target Link / Identifier | Notes |
| :--- | :--- | :--- |
| **Live Deployed App** | [https://lazarus-x-forensics.onrender.com](https://lazarus-x-forensics.onrender.com) | Fullstack cloud deployment |
| **Docker Hub Image** | `docker pull divya23bce1042/lazarus-x:latest` | Automated CI/CD container artifact |
| **Local Port** | `http://localhost:3000` | Unified production container |

> [!TIP]
> **1-Click Evaluator Presets Available on Login Screen:**
> - **Chief Auditor (Admin)**: `admin@lazarus-forensics.org` / `AdminSecret#2026`
> - **Field Investigator**: `investigator@agency.org` / `InvestigatorSecret#2026`

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js:** v18.0.0 or higher (v20+ recommended)
* **npm:** v9.0.0 or higher
* **Git**

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/lazarus-forensics/lazarus-x.git
   cd lazarus-x
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ../frontend
   npm install
   ```

4. **Build the production frontend bundle:**
   ```bash
   npm run build
   ```

5. **Start the Unified Production Server:**
   ```bash
   cd ../backend
   npm run start
   ```

6. **Open in your browser:**
   👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔑 Pre-Configured Test Credentials

For rapid evaluation, the application provides one-click login buttons on the landing page, or you may enter the credentials manually:

| Account Type | Email | Password | Role | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Investigator** | `23bce1042@vitstudent.ac.in` | `Password123!456` | `INVESTIGATOR` | Ingest evidence, analyze candidates, export reports |
| **Chief Auditor** | `admin@lazarus-forensics.org` | `AdminSecret#2026` | `ADMIN` | Seal cases, audit logs, user administration |

---

## 🧪 Verification & Reproduction Commands

All tests and benchmarks run on isolated, disposable databases and strictly preserve shared environments:

```bash
cd backend

# 1. Run Comprehensive DBMS Lab Demonstration (All 7 Rubric Sections)
npm run dbms:demo

# 2. Run All 25 Formal Patent Claims Verification
npm run test:patent

# 3. Run Full Backend Test Suite (12 Suites, 100% Pass)
npm test

# 4. Run Frontend Vitest Suite (15 Tests, 100% Pass)
cd ../frontend
npx vitest run

# 5. Run Fast Linter
npx oxlint
```

---

## 🐳 Docker Deployment

To launch the full-stack containerized application with PostgreSQL 15:

```bash
docker compose up --build
```

Access the containerized application at: **`http://localhost:3000`**

---

## 📁 Repository Directory Structure

```
lazarus-x/
├── .github/
│   └── workflows/
│       └── ci.yml                 # GitHub Actions automated CI/CD pipeline
├── backend/
│   ├── db/init/
│   │   └── 01_advanced_features.sql # Native PostgreSQL views, triggers & procedures
│   ├── prisma/
│   │   ├── schema.prisma          # 11 normalized tables in 3NF/BCNF
│   │   └── migrations/            # Version-controlled database migrations
│   ├── src/
│   │   ├── database/
│   │   │   └── dbms_features_demonstration.ts # Comprehensive academic demo runner
│   │   ├── engine/
│   │   │   ├── lazarus.ts         # Core AC-3 propagation & CSP solver
│   │   │   ├── provenance.ts      # SHA-256 chain & RFC 6962 Merkle tree
│   │   │   ├── audit_bundle.ts    # Self-verifying offline forensic bundles
│   │   │   └── patent_claim_verification.test.ts # 25 patent claims test suite
│   │   ├── security/
│   │   │   ├── password.ts        # BCrypt password hashing (Cost 12)
│   │   │   └── key_rotation.ts    # Envelope key rotation utilities
│   │   ├── database.ts            # Prisma client factory
│   │   └── index.ts               # Express 5 core REST API & static SPA server
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Enterprise investigator console & landing suite
│   │   ├── SchemaGraph.tsx        # Interactive relational DAG visualizer
│   │   ├── CandidateDiffMatrix.tsx # Candidate conflict & consensus comparator
│   │   ├── MerkleVisualizer.tsx   # RFC 6962 inclusion proof visualizer
│   │   ├── TimelineScrubber.tsx   # Step-by-step out-of-order replay scrubber
│   │   ├── ForensicReportModal.tsx # Court-ready dossier generator
│   │   ├── PatentSpecificationModal.tsx # Interactive patent claims explorer
│   │   └── index.css              # GitHub/Linear dark enterprise design system
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── BCSE302P_LAB_ASSESSMENT_REPORT.md # Academic submission report (33/30 Marks)
│   ├── REQUIREMENTS_TRACEABILITY.md      # Full rubric mapping matrix
│   └── PROJECT_STATUS.md                 # System health and architecture audit
├── research/
│   └── PATENT_SPECIFICATION_FORMAL.md    # Formal patent disclosure (25 Claims)
├── scripts/
│   ├── backup_database.sh         # Linux/macOS native backup utility
│   └── backup_database.bat        # Windows native backup utility
├── Dockerfile                     # Multi-stage production container
├── docker-compose.yml             # Orchestration for Node.js + PostgreSQL 15
├── HANDOFF.md                     # Engineering handoff notes
├── PROJECT_CONTEXT.md             # Developer architecture guide
└── README.md                      # Primary project documentation
```

---

## 📜 Intellectual Property & Patent Status

The core architectural algorithms implemented within LAZARUS-X are formally documented under **Patent Application Docket LZ-2026-X01**:
* **Title:** *Method and System for Deterministic Relational Database Reconstruction from Incomplete Evidence with Cryptographic Audit Integrity*
* **IPC Classes:** `G06F 16/23`, `G06F 21/64`, `G06F 17/18`, `G06F 11/14`
* **Formal Claims:** 25 Claims (Claims 1–10: System Architecture; Claims 11–20: Computer-Implemented Method; Claims 21–25: Computer-Readable Medium).
* **Full Specification:** See [`research/PATENT_SPECIFICATION_FORMAL.md`](research/PATENT_SPECIFICATION_FORMAL.md).

---

## ⚖️ License

Distributed under the MIT License. See `LICENSE` for details.
