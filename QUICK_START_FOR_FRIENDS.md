# ⚡ Quick Start Guide (For Collaborators & Friends)

Welcome to **LAZARUS-X**! This repository is a forensic database reconstruction engine that recovers corrupted, incomplete, or tampered relational databases using active constraint satisfaction (AC-3), Shannon entropy disambiguation, and cryptographic Merkle tree chains.

---

## 🚀 How to Run in 1 Minute

### Option A: Windows (Easiest)
Just **double-click `start.bat`**!
It will automatically verify dependencies, start the unified server on `http://localhost:3000`, and launch your browser.

### Option B: macOS / Linux
Open a terminal in the project folder and run:
```bash
chmod +x start.sh
./start.sh
```

### Option C: Using npm
```bash
# 1. Install dependencies
cd backend && npm install
cd ../frontend && npm install

# 2. Start the unified application
cd ../backend
npx ts-node src/index.ts
```
Then open your browser to: 👉 **http://localhost:3000**

---

## 🔑 How to Log In (1-Click)

On the login page, you don't even need to type anything!
Just click the **One-Click Evaluator Access** buttons:
* **⚡ Investigator (23BCE1042)** $\rightarrow$ Signs you in as an investigator to ingest evidence and view reconstruction graphs.
* **🛡️ Chief Auditor (Admin)** $\rightarrow$ Signs you in as an admin with case sealing and full audit permissions.

---

## 🎯 Cool Features to Try Once You're In!

1. **One-Click Forensic Benchmarks:**
   Above the evidence intake form, click **"Disputed Badge (Entropy Demo)"** to inject contradictory evidence and watch the engine compute real-time candidate branching and Shannon Information Gain!
2. **Interactive Schema DAG:**
   Click the **"Schema DAG"** toggle button to explore the interactive visual map of all 11 relational tables and foreign keys.
3. **Forensic Dossier Export:**
   Click the **"Forensic Dossier"** button in the top header to generate a court-admissible verification document with cryptographic timestamps.
4. **Patent Claims Modal:**
   Click **"Patent Claims"** in the top header to inspect the formal 25 patent claims and mathematical formulas.
5. **Merkle Provenance Tree:**
   Click the **"Provenance"** tab on the right side to inspect the live SHA-256 event chain and click on any leaf to see its cryptographic $O(\log N)$ inclusion proof!

---

## 🧪 Verification Commands

To run all automated test suites:
```bash
cd backend
npm run dbms:demo     # Verifies all 7 database course criteria
npm run test:patent   # Verifies all 25 formal patent claims
npm test              # Runs all 12 backend test suites
```
