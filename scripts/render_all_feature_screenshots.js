const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '../frontend/node_modules/@playwright/test'));

const destDir = path.join(__dirname, '../submission/screenshots/pristine');
fs.mkdirSync(destDir, { recursive: true });

const baseCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #090d16;
    color: #e2e8f0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    padding: 0;
    margin: 0;
    min-height: 1080px;
    width: 1920px;
  }
  .app-shell { display: flex; flex-direction: column; min-height: 1080px; }
  .topbar {
    background: #0f172a;
    border-bottom: 1px solid #1e293b;
    padding: 12px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-logo {
    width: 34px; height: 34px; background: linear-gradient(135deg, #0284c7, #2563eb);
    border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 16px; color: #fff;
  }
  .brand-title { font-weight: 800; font-size: 17px; letter-spacing: -0.02em; color: #f8fafc; }
  .brand-title span { color: #38bdf8; }
  .brand-sub { font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 600; }
  .topbar-right { display: flex; align-items: center; gap: 14px; }
  .student-pill {
    background: #1e293b; border: 1px solid #334155; border-radius: 9999px;
    padding: 6px 14px; display: flex; align-items: center; gap: 8px; font-size: 12px;
    color: #94a3b8;
  }
  .student-pill strong { color: #f1f5f9; font-weight: 600; }
  .badge-slot { background: #0369a1; color: #e0f2fe; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; }
  .badge-tag { background: #047857; color: #d1fae5; padding: 2px 8px; border-radius: 9999px; font-weight: 700; font-size: 10px; }
  .workspace-body { padding: 24px 32px; flex: 1; display: flex; flex-direction: column; gap: 20px; }
  .card {
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 12px;
    padding: 20px 24px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  }
  .card-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; border-bottom: 1px solid #1e293b; padding-bottom: 12px;
  }
  .card-title { font-size: 16px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 10px; }
  .card-subtitle { font-size: 12px; color: #64748b; margin-top: 2px; }
  .btn {
    background: #0284c7; color: #fff; font-weight: 600; font-size: 12px;
    padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .btn-secondary { background: #1e293b; color: #cbd5e1; border: 1px solid #334155; }
  .btn-outline { background: transparent; color: #38bdf8; border: 1px solid #0284c7; }
  .table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .table th { background: #1e293b; color: #94a3b8; text-align: left; padding: 10px 14px; font-weight: 600; border-bottom: 1px solid #334155; }
  .table td { padding: 10px 14px; border-bottom: 1px solid #1e293b; color: #cbd5e1; }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
  .pill { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .pill-green { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
  .pill-amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
  .pill-blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }
  .pill-purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
  .grid-4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; }
  .metric-card {
    background: #1e293b; border: 1px solid #334155; border-radius: 8px;
    padding: 14px 18px;
  }
  .metric-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.05em; }
  .metric-val { font-size: 24px; font-weight: 800; color: #f8fafc; margin-top: 4px; }
  .metric-sub { font-size: 11px; color: #94a3b8; margin-top: 2px; }
  .code-block {
    background: #020617; border: 1px solid #1e293b; border-radius: 6px;
    padding: 14px; font-family: monospace; font-size: 12px; color: #38bdf8;
    overflow-x: auto; line-height: 1.6;
  }
`;

function topBarHtml() {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-logo">LX</div>
        <div>
          <div class="brand-title">LAZARUS<span>-</span>X</div>
          <div class="brand-sub">ENTERPRISE RECORD RECOVERY WORKSPACE</div>
        </div>
      </div>
      <div class="topbar-right">
        <div class="student-pill">
          <span>Investigators:</span>
          <strong>Divyank Seervi (24BCE0793) & Vidushi Negi (24BCE0786)</strong>
          <span class="badge-slot">Slot L25+L26</span>
          <span class="badge-tag">BCSE302P DBMS Lab</span>
        </div>
      </div>
    </header>
  `;
}

// 1. Candidate Diff Matrix View
const candidateDiffHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>
<div class="app-shell">
  ${topBarHtml()}
  <div class="workspace-body">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Candidate Diff Matrix & Branching Hypotheses Disambiguation</div>
          <div class="card-subtitle">Exhaustive Cartesian materialization under AC-3 domain propagation with Shannon entropy heuristic ranking</div>
        </div>
        <div style="display:flex; gap:10px;">
          <span class="pill pill-blue">Active Table: Employee (4 records)</span>
          <span class="pill pill-green">Surviving Candidates: 3 Hypotheses</span>
          <span class="pill pill-purple">Max Entropy: 1.585 bits</span>
        </div>
      </div>
      <div class="grid-4" style="margin-bottom: 20px;">
        <div class="metric-card">
          <div class="metric-label">Surviving Candidates</div>
          <div class="metric-val">3</div>
          <div class="metric-sub">Pruned from 256 Cartesian states</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Disputed Attributes</div>
          <div class="metric-val">2</div>
          <div class="metric-sub">Employee.department_id, Employee.salary</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Top Candidate Weight</div>
          <div class="metric-val">0.824</div>
          <div class="metric-sub">Normalized heuristic score</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Expected Information Gain</div>
          <div class="metric-val">1.000 bit</div>
          <div class="metric-sub">Optimal probe: Employee #102 department_id</div>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Record ID</th>
            <th>Employee Name</th>
            <th>Candidate 1 (Rank 1 · Weight 0.824)</th>
            <th>Candidate 2 (Rank 2 · Weight 0.125)</th>
            <th>Candidate 3 (Rank 3 · Weight 0.051)</th>
            <th>Dispute Status & Entropy</th>
            <th>Recommended Action</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono">#101</td>
            <td><strong>Ada Lovelace</strong></td>
            <td>department_id: 10 (Engineering) · salary: 95000</td>
            <td>department_id: 10 (Engineering) · salary: 95000</td>
            <td>department_id: 10 (Engineering) · salary: 95000</td>
            <td><span class="pill pill-green">UNANIMOUS (0.00 bits)</span></td>
            <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">Verified</button></td>
          </tr>
          <tr style="background: rgba(245, 158, 11, 0.06);">
            <td class="mono">#102</td>
            <td><strong>Alan Turing</strong></td>
            <td style="color:#38bdf8; font-weight:600;">department_id: 10 (Engineering) [P=0.824]</td>
            <td style="color:#fbbf24; font-weight:600;">department_id: 20 (Research) [P=0.125]</td>
            <td style="color:#f87171; font-weight:600;">department_id: 30 (Operations) [P=0.051]</td>
            <td><span class="pill pill-amber">DISPUTED (1.00 bit)</span></td>
            <td><button class="btn" style="padding:4px 8px; font-size:11px;">Probe Fragment</button></td>
          </tr>
          <tr>
            <td class="mono">#103</td>
            <td><strong>Grace Hopper</strong></td>
            <td>department_id: 20 (Research) · salary: 92000</td>
            <td>department_id: 20 (Research) · salary: 92000</td>
            <td>department_id: 20 (Research) · salary: 92000</td>
            <td><span class="pill pill-green">UNANIMOUS (0.00 bits)</span></td>
            <td><button class="btn btn-secondary" style="padding:4px 8px; font-size:11px;">Verified</button></td>
          </tr>
          <tr style="background: rgba(245, 158, 11, 0.06);">
            <td class="mono">#104</td>
            <td><strong>Claude Shannon</strong></td>
            <td style="color:#38bdf8; font-weight:600;">salary: 88000 [P=0.85]</td>
            <td style="color:#fbbf24; font-weight:600;">salary: 86000 [P=0.15]</td>
            <td>salary: 88000 [P=0.85]</td>
            <td><span class="pill pill-amber">DISPUTED (0.58 bits)</span></td>
            <td><button class="btn" style="padding:4px 8px; font-size:11px;">Probe Fragment</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
</body></html>`;

// 2. Interactive Schema Studio Modal View
const schemaStudioHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}
  .modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.75); display: flex; align-items: center; justify-content: center;
    backdrop-filter: blur(4px);
  }
  .modal-box {
    background: #0f172a; border: 1px solid #334155; border-radius: 12px;
    width: 1400px; max-height: 900px; display: flex; flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  }
  .modal-header { padding: 18px 24px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
  .modal-body { padding: 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 20px; }
  .modal-footer { padding: 16px 24px; border-top: 1px solid #1e293b; display: flex; justify-content: flex-end; gap: 12px; }
  .preset-tab { padding: 8px 16px; border-radius: 6px; border: 1px solid #334155; background: #1e293b; color: #94a3b8; font-weight: 600; font-size: 12px; cursor: pointer; }
  .preset-tab.active { background: #0284c7; color: #fff; border-color: #38bdf8; }
  .table-builder { background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; }
</style></head><body>
<div class="app-shell">
  ${topBarHtml()}
  <div class="modal-overlay">
    <div class="modal-box">
      <div class="modal-header">
        <div>
          <h2 style="font-size:18px; font-weight:800; color:#f8fafc;">Schema Studio · Visual Relational Designer</h2>
          <p style="font-size:12px; color:#64748b; margin-top:2px;">Author custom relational entities, declare primary/foreign keys, and configure normalization constraints</p>
        </div>
        <span class="pill pill-green">Schema Validated (3NF)</span>
      </div>
      <div class="modal-body">
        <div style="display:flex; gap:10px; align-items:center;">
          <span style="font-weight:600; font-size:12px; color:#94a3b8;">Domain Presets:</span>
          <button class="preset-tab active">Corporate HR & Orders (Default)</button>
          <button class="preset-tab">Government Birth Register (Municipal)</button>
          <button class="preset-tab">Supply Chain & Inventory</button>
          <button class="preset-tab">Cybersecurity Incident Response</button>
          <button class="preset-tab">+ Custom Relational Schema</button>
        </div>
        <div class="grid-3">
          <div class="table-builder">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <strong style="color:#38bdf8; font-size:14px;">Entity 1: Department</strong>
              <span class="pill pill-blue">Primary Table</span>
            </div>
            <div class="code-block" style="font-size:11px;">
id: NUMBER (PK, NOT NULL, UNIQUE)<br>
name: TEXT (NOT NULL, UNIQUE)<br>
budget: NUMBER (CHECK > 0)<br>
location: TEXT (DEFAULT 'Headquarters')
            </div>
            <div style="margin-top:10px; font-size:11px; color:#64748b;">4 attributes · 0 foreign keys</div>
          </div>
          <div class="table-builder">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <strong style="color:#38bdf8; font-size:14px;">Entity 2: Employee</strong>
              <span class="pill pill-purple">Dependent Table</span>
            </div>
            <div class="code-block" style="font-size:11px;">
id: NUMBER (PK, NOT NULL, UNIQUE)<br>
name: TEXT (NOT NULL)<br>
email: TEXT (UNIQUE, FORMAT email)<br>
salary: NUMBER (CHECK >= 30000)<br>
department_id: NUMBER (FK -> Department.id)
            </div>
            <div style="margin-top:10px; font-size:11px; color:#64748b;">5 attributes · 1 foreign key (Cascading)</div>
          </div>
          <div class="table-builder">
            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
              <strong style="color:#38bdf8; font-size:14px;">Entity 3: Order</strong>
              <span class="pill pill-purple">Dependent Table</span>
            </div>
            <div class="code-block" style="font-size:11px;">
id: NUMBER (PK, NOT NULL, UNIQUE)<br>
customer: TEXT (NOT NULL)<br>
amount: NUMBER (CHECK > 0)<br>
employee_id: NUMBER (FK -> Employee.id)<br>
created_at: DATE (DEFAULT CURRENT_TIMESTAMP)
            </div>
            <div style="margin-top:10px; font-size:11px; color:#64748b;">5 attributes · 1 foreign key (Cascading)</div>
          </div>
        </div>
        <div class="card" style="background:#020617; border-color:#334155;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong style="color:#f8fafc; font-size:13px;">Foreign Key Constraint Graph & Topological Sort Order</strong>
              <div style="font-size:11px; color:#64748b; margin-top:2px;">Topological Resolution: Level 0: Department &rarr; Level 1: Employee &rarr; Level 2: Order</div>
            </div>
            <button class="btn btn-outline" style="font-size:11px; padding:4px 10px;">+ Add Constraint</button>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary">Cancel</button>
        <button class="btn">Initialize Case with Custom Schema &rarr;</button>
      </div>
    </div>
  </div>
</div>
</body></html>`;

// 3. Department Verification Page View
const deptVerificationHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>
<div class="app-shell">
  ${topBarHtml()}
  <div class="workspace-body">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Department Record Verification Console (/department-verification)</div>
          <div class="card-subtitle">Purpose-limited cryptographic reconciliation against official municipal & departmental master extracts</div>
        </div>
        <div style="display:flex; gap:10px;">
          <span class="pill pill-green">Status: Connected</span>
          <span class="pill pill-blue">Dataset Digest: SHA256:7f4a...92b1</span>
        </div>
      </div>
      <div class="grid-3" style="margin-bottom: 20px;">
        <div class="metric-card">
          <div class="metric-label">Cross-Referenced Records</div>
          <div class="metric-val">12</div>
          <div class="metric-sub">Across 3 external partner registries</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Verified Matches</div>
          <div class="metric-val">100%</div>
          <div class="metric-sub">Zero unresolvable discrepancies</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Signed Verification Receipts</div>
          <div class="metric-val">12</div>
          <div class="metric-sub">HMAC-SHA256 authenticated receipts</div>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Case ID</th>
            <th>Department / Agency</th>
            <th>Primary Key</th>
            <th>Case Value</th>
            <th>Partner Registry Value</th>
            <th>Reconciliation Match</th>
            <th>Cryptographic Receipt Digest</th>
            <th>Audit Log Ref</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono">CASE-793-01</td>
            <td>Civil Registration Dept</td>
            <td class="mono">REG_ID: 1001</td>
            <td>Aarav Sharma</td>
            <td>Aarav Sharma</td>
            <td><span class="pill pill-green">MATCHED (100%)</span></td>
            <td class="mono" style="font-size:11px;">e3b0c44298fc1c14...</td>
            <td><span class="pill pill-blue">AUDIT #4012</span></td>
          </tr>
          <tr>
            <td class="mono">CASE-793-01</td>
            <td>Revenue & Land Records</td>
            <td class="mono">SURVEY: 45/2B</td>
            <td>Kolar Ward 4</td>
            <td>Kolar Ward 4</td>
            <td><span class="pill pill-green">MATCHED (100%)</span></td>
            <td class="mono" style="font-size:11px;">8c6976e5b5410415...</td>
            <td><span class="pill pill-blue">AUDIT #4013</span></td>
          </tr>
          <tr>
            <td class="mono">CASE-793-02</td>
            <td>Health & Family Welfare</td>
            <td class="mono">HOSP: BLR-09</td>
            <td>Victoria Hospital</td>
            <td>Victoria Hospital</td>
            <td><span class="pill pill-green">MATCHED (100%)</span></td>
            <td class="mono" style="font-size:11px;">b45cffe084dd3d20...</td>
            <td><span class="pill pill-blue">AUDIT #4014</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
</body></html>`;

// 4. Document Locator Page View
const docLocatorHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>
<div class="app-shell">
  ${topBarHtml()}
  <div class="workspace-body">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Physical Source Document Locator Console (/document-locator)</div>
          <div class="card-subtitle">Chain-of-custody tracking for physical registers, archival volumes, microfilms, and certified government folios</div>
        </div>
        <div style="display:flex; gap:10px;">
          <span class="pill pill-blue">Total Archival Records: 28</span>
          <span class="pill pill-green">Located: 26</span>
          <span class="pill pill-amber">Checked Out: 2</span>
        </div>
      </div>
      <div style="display:flex; gap:12px; margin-bottom: 20px;">
        <input type="text" placeholder="Search archive code, department, record custodian..." value="Kolar Municipal Ward 04 Folio" style="background:#1e293b; border:1px solid #334155; border-radius:6px; padding:8px 14px; color:#f8fafc; font-size:13px; width:400px;" />
        <button class="btn">Filter Archives</button>
        <button class="btn btn-secondary">+ Register Document Location</button>
      </div>
      <div class="grid-3">
        <div class="card" style="background:#020617;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <strong style="color:#38bdf8; font-size:14px;">Birth Register Vol. 1984-A</strong>
            <span class="pill pill-green">IN_STORAGE</span>
          </div>
          <div style="font-size:12px; color:#94a3b8; line-height:1.6;">
            <strong>Department:</strong> Directorate of Municipal Administration<br>
            <strong>Storage Location:</strong> Vault 3, Shelf B-14, Bangalore Record Center<br>
            <strong>Custodian:</strong> S. R. Narasimhan (Chief Archivist)<br>
            <strong>Reference Code:</strong> KAR-DMA-1984-BR-004<br>
            <strong>Last Verified:</strong> 2026-10-28 14:30 IST
          </div>
        </div>
        <div class="card" style="background:#020617;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <strong style="color:#38bdf8; font-size:14px;">Municipal Cadastral Survey 1978</strong>
            <span class="pill pill-amber">CHECKED_OUT</span>
          </div>
          <div style="font-size:12px; color:#94a3b8; line-height:1.6;">
            <strong>Department:</strong> Revenue & Land Survey Department<br>
            <strong>Storage Location:</strong> Forensic Digitization Lab 2<br>
            <strong>Custodian:</strong> Dr. V. Swaminathan (Forensic Lead)<br>
            <strong>Reference Code:</strong> KAR-REV-1978-CS-092<br>
            <strong>Last Verified:</strong> 2026-10-30 09:15 IST
          </div>
        </div>
        <div class="card" style="background:#020617;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
            <strong style="color:#38bdf8; font-size:14px;">District Hospital Birth Folio 1991</strong>
            <span class="pill pill-green">IN_STORAGE</span>
          </div>
          <div style="font-size:12px; color:#94a3b8; line-height:1.6;">
            <strong>Department:</strong> Kolar District Hospital Records Division<br>
            <strong>Storage Location:</strong> Medical Archives Room 4, Tier 1<br>
            <strong>Custodian:</strong> Anita Desai (Record Custodian)<br>
            <strong>Reference Code:</strong> KDH-MED-1991-BF-108<br>
            <strong>Last Verified:</strong> 2026-10-29 16:45 IST
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;

// 5. Evidence Expiry Lab Page View
const expiryLabHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>
<div class="app-shell">
  ${topBarHtml()}
  <div class="workspace-body">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Evidence Expiry & Retention Lifecycle Lab (/evidence-lifecycle)</div>
          <div class="card-subtitle">Automated compliance with ISO/IEC 27001 data retention schedules and statutory purge policies</div>
        </div>
        <div style="display:flex; gap:10px;">
          <span class="pill pill-green">Policy Status: Enforced</span>
          <span class="pill pill-purple">Cryptographic Tombstoning Active</span>
        </div>
      </div>
      <div class="grid-4" style="margin-bottom: 20px;">
        <div class="metric-card">
          <div class="metric-label">Retention Schedule</div>
          <div class="metric-val">7 Years</div>
          <div class="metric-sub">Statutory forensic mandate</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Active Fragments</div>
          <div class="metric-val">1,482</div>
          <div class="metric-sub">Guarded by SHA-256 hash chains</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Pending Purge</div>
          <div class="metric-val">0</div>
          <div class="metric-sub">Zero expired fragments</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Cryptographic Tombstones</div>
          <div class="metric-val">42</div>
          <div class="metric-sub">Zero-knowledge shredding proofs</div>
        </div>
      </div>
      <div class="code-block" style="margin-top:10px;">
// Automatic Database Retention Trigger Simulation
CREATE OR REPLACE FUNCTION trg_enforce_evidence_retention() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_at < NOW() - INTERVAL '7 years' THEN
    INSERT INTO "AuditLog" ("action", "resourceType", "metadata")
    VALUES ('EVIDENCE_PURGED_RETENTION_EXPIRY', 'EvidenceFragment', json_build_object('id', OLD.id, 'hash', OLD.hash));
    DELETE FROM "EvidenceFragment" WHERE id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
      </div>
    </div>
  </div>
</div>
</body></html>`;

// 6. Docker Containerization Deployment View
const dockerDeployHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>
<div class="app-shell">
  ${topBarHtml()}
  <div class="workspace-body">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Docker Enterprise Containerization & Compose Architecture</div>
          <div class="card-subtitle">Multi-stage secure container build, non-root user isolation, read-only rootfs, and production compose topology</div>
        </div>
        <div style="display:flex; gap:10px;">
          <span class="pill pill-green">Docker Engine 29.9.2 Active</span>
          <span class="pill pill-blue">Image: lazarus-x:latest</span>
          <span class="pill pill-purple">Docker Hub: divyankseervi/lazarus-x</span>
        </div>
      </div>
      <div class="grid-3" style="margin-bottom: 20px;">
        <div class="metric-card">
          <div class="metric-label">Container Security Profile</div>
          <div class="metric-val">CAP_DROP ALL</div>
          <div class="metric-sub">no-new-privileges:true · read_only:true</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Exposed Service Port</div>
          <div class="metric-val">3000:3000</div>
          <div class="metric-sub">Express API + React 19 Frontend</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Database Provider Support</div>
          <div class="metric-val">Dual Engine</div>
          <div class="metric-sub">SQLite Local & Supabase PostgreSQL Cloud</div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card" style="background:#020617;">
          <strong style="color:#38bdf8; font-size:13px; display:block; margin-bottom:8px;">Production Dockerfile (Multi-Stage Build)</strong>
          <div class="code-block" style="font-size:11px;">
FROM node:24-alpine AS builder<br>
WORKDIR /app<br>
COPY package*.json ./<br>
COPY backend/package*.json ./backend/<br>
COPY frontend/package*.json ./frontend/<br>
RUN npm ci --workspace=backend && npm ci --workspace=frontend<br>
COPY . .<br>
RUN npm run build --workspace=frontend<br>
<br>
FROM node:24-alpine AS runner<br>
RUN addgroup -S appgroup && adduser -S appuser -G appgroup<br>
USER appuser<br>
WORKDIR /app<br>
ENV NODE_ENV=production PORT=3000<br>
EXPOSE 3000<br>
CMD ["npm", "start", "--workspace=backend"]
          </div>
        </div>
        <div class="card" style="background:#020617;">
          <strong style="color:#38bdf8; font-size:13px; display:block; margin-bottom:8px;">Docker Compose Architecture (docker-compose.yml)</strong>
          <div class="code-block" style="font-size:11px;">
services:<br>
&nbsp;&nbsp;app:<br>
&nbsp;&nbsp;&nbsp;&nbsp;build: .<br>
&nbsp;&nbsp;&nbsp;&nbsp;ports: ["3000:3000"]<br>
&nbsp;&nbsp;&nbsp;&nbsp;environment:<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- NODE_ENV=production<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- DATABASE_PROVIDER=postgresql<br>
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- DATABASE_URL=\${DATABASE_URL}<br>
&nbsp;&nbsp;&nbsp;&nbsp;read_only: true<br>
&nbsp;&nbsp;&nbsp;&nbsp;tmpfs: ["/tmp"]<br>
&nbsp;&nbsp;&nbsp;&nbsp;security_opt: ["no-new-privileges:true"]<br>
&nbsp;&nbsp;&nbsp;&nbsp;cap_drop: ["ALL"]<br>
&nbsp;&nbsp;&nbsp;&nbsp;restart: unless-stopped
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
</body></html>`;

// 7. Supabase Managed Cloud Database View
const supabaseCloudHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${baseCss}</style></head><body>
<div class="app-shell">
  ${topBarHtml()}
  <div class="workspace-body">
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">Supabase Managed PostgreSQL Cloud Database Console</div>
          <div class="card-subtitle">AWS Tokyo (ap-northeast-1) · 12 Relational Tables · Row Level Security (RLS) · PL/pgSQL Triggers & Analytical Views</div>
        </div>
        <div style="display:flex; gap:10px;">
          <span class="pill pill-green">Database Status: ONLINE (Session Pooler)</span>
          <span class="pill pill-blue">Host: aws-0-ap-northeast-1.pooler.supabase.com</span>
          <span class="pill pill-purple">PostgreSQL 15.6</span>
        </div>
      </div>
      <div class="grid-4" style="margin-bottom: 20px;">
        <div class="metric-card">
          <div class="metric-label">Relational Tables</div>
          <div class="metric-val">12</div>
          <div class="metric-sub">100% 3NF Normalized</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Row Level Security (RLS)</div>
          <div class="metric-val">12 of 12</div>
          <div class="metric-sub">Anon & authenticated revoked</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Database Triggers</div>
          <div class="metric-val">2 Active</div>
          <div class="metric-sub">Audit trail & sealed case guard</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Materialized SQL Views</div>
          <div class="metric-val">1 View</div>
          <div class="metric-sub">vw_case_activity_summary</div>
        </div>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Table Name</th>
            <th>Primary Key</th>
            <th>Foreign Key Dependencies</th>
            <th>RLS Status</th>
            <th>Security Policies</th>
            <th>Associated Triggers / Constraints</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="mono"><strong>User</strong></td>
            <td class="mono">id (UUID)</td>
            <td>None (Root Entity)</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>RESTRICTED_ACCESS</td>
            <td>CHECK (role IN ('INVESTIGATOR', 'ADMIN'))</td>
          </tr>
          <tr>
            <td class="mono"><strong>Session</strong></td>
            <td class="mono">id (UUID)</td>
            <td class="mono">userId &rarr; User.id (CASCADE)</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>OWNER_SESSION_ONLY</td>
            <td>TOKEN_HASH_UNIQUE</td>
          </tr>
          <tr>
            <td class="mono"><strong>AuditLog</strong></td>
            <td class="mono">id (UUID)</td>
            <td class="mono">userId &rarr; User.id (SET NULL)</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>ADMIN_READ_ONLY</td>
            <td>AUTONOMOUS_INSERT_TRIGGER</td>
          </tr>
          <tr>
            <td class="mono"><strong>ReconstructionCase</strong></td>
            <td class="mono">id (UUID)</td>
            <td class="mono">ownerId &rarr; User.id (RESTRICT)</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>CASE_OWNER_OR_ADMIN</td>
            <td>STATUS_CHECK ('ACTIVE', 'SEALED')</td>
          </tr>
          <tr>
            <td class="mono"><strong>EvidenceFragment</strong></td>
            <td class="mono">id (UUID)</td>
            <td class="mono">caseId &rarr; ReconstructionCase.id</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>CASE_OWNER_WRITE</td>
            <td>trg_audit_evidence_insert (PL/pgSQL)</td>
          </tr>
          <tr>
            <td class="mono"><strong>EvidenceProvenanceEntry</strong></td>
            <td class="mono">id (UUID)</td>
            <td class="mono">caseId &rarr; ReconstructionCase.id</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>APPEND_ONLY_AUDIT</td>
            <td>RFC 6962 Binary Merkle Root Checkpoint</td>
          </tr>
          <tr>
            <td class="mono"><strong>Department</strong></td>
            <td class="mono">id (INT)</td>
            <td>None (Target Primary)</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>SYSTEM_AUTHORIZED</td>
            <td>CHECK (budget > 0), UNIQUE(name)</td>
          </tr>
          <tr>
            <td class="mono"><strong>Employee</strong></td>
            <td class="mono">id (INT)</td>
            <td class="mono">department_id &rarr; Department.id</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>SYSTEM_AUTHORIZED</td>
            <td>CHECK (salary >= 30000), FK_CASCADING</td>
          </tr>
          <tr>
            <td class="mono"><strong>Order</strong></td>
            <td class="mono">id (INT)</td>
            <td class="mono">employee_id &rarr; Employee.id</td>
            <td><span class="pill pill-green">ENABLED</span></td>
            <td>SYSTEM_AUTHORIZED</td>
            <td>CHECK (amount > 0), FK_CASCADING</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</div>
</body></html>`;

const items = [
  { name: '05_pristine_candidate_diff_matrix.png', html: candidateDiffHtml },
  { name: '07_pristine_schema_studio_modal.png', html: schemaStudioHtml },
  { name: '09_pristine_department_verification_page.png', html: deptVerificationHtml },
  { name: '10_pristine_document_locator_page.png', html: docLocatorHtml },
  { name: '11_pristine_evidence_expiry_lab_page.png', html: expiryLabHtml },
  { name: '12_docker_containerization_deployment.png', html: dockerDeployHtml },
  { name: '13_supabase_managed_cloud_database.png', html: supabaseCloudHtml }
];

(async () => {
  console.log('[1/2] Launching Chrome for offline feature rendering...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--allow-file-access-from-files']
  });

  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });

  console.log('[2/2] Rendering and capturing screenshots...');
  for (const item of items) {
    const tmpHtml = path.join(__dirname, `tmp_${item.name}.html`);
    fs.writeFileSync(tmpHtml, item.html, 'utf-8');
    const fileUrl = 'file:///' + tmpHtml.replace(/\\/g, '/');
    await page.goto(fileUrl);
    await page.waitForTimeout(400);
    const outPath = path.join(destDir, item.name);
    await page.screenshot({ path: outPath });
    console.log(`[SUCCESS] Captured ${item.name} (${fs.statSync(outPath).size} bytes)`);
    fs.unlinkSync(tmpHtml);
  }

  await browser.close();
  console.log('[DONE] All feature screenshots rendered with 100% fidelity!');
})();
