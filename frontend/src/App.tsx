import { Component, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { MerkleVisualizer } from './MerkleVisualizer';
import { SchemaGraph } from './SchemaGraph';
import { TimelineScrubber } from './TimelineScrubber';
import { CandidateDiffMatrix } from './CandidateDiffMatrix';
import { ForensicReportModal } from './ForensicReportModal';
import { AuditLogsModal } from './AuditLogsModal';
import { SchemaStudio } from './SchemaStudio';
import { createPresetSchema, createWalkthroughEvidence, hasWalkthroughConflictTarget, type CaseSchema } from './schemaTypes';
import { parseEvidenceCsv, type ImportedEvidenceFragment } from './evidenceCsv';
import { divyank24BCE0793_EXAMPLE_SCENARIOS } from './exampleScenarios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, ArrowDownToLine, ArrowRight, Award, BadgeCheck, Boxes, ChevronDown, CircleAlert,
  ClipboardCheck, Cpu, Database, Edit2, Fingerprint, FileSpreadsheet, GitBranch, KeyRound, Loader2, Lock, LogOut, Mail, Split,
  Plus, RefreshCw, Search, Shield, ShieldCheck, Sparkles, TimerReset, Trash2, Upload, Zap,
} from 'lucide-react';
import {
  deriveEnvelopeMerkleProofDetails,
  verifyDisclosedClaim,
  verifyEnvelopeInclusionProof,
  verifyProvenanceCheckpoint,
  type EnvelopeMerklePathStep,
  type EnvelopeMerkleProof,
  type PublicEnvelopeEntry,
} from './provenanceVerifier';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

type CandidateState = {
  id: string;
  data: Record<string, Array<Record<string, unknown>>>;
  probabilityScore: number;
  fatalViolations: number;
  resolvableViolations: number;
  fuzzyPenalty?: number;
  fuzzyCorrections?: Array<{ editDistance: number; source: { value: string }; target: { value: string } }>;
};

type CandidateSummary = {
  id: string;
  rank: number;
  score: number;
  fatalViolations: number;
  resolvableViolations: number;
  fuzzyPenalty: number;
  sourceReliabilityPenalty?: number;
  isSelected: boolean;
};

type CaseSummary = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  provenanceSequence: number;
};

type CandidateValuePrediction = {
  value: unknown;
  probability: number;
  candidateCount: number;
};

type Recommendation = {
  table: string;
  recordId: number;
  field: string;
  expectedInformationGain: number;
  currentEntropy?: number;
  expectedRemainingEntropy?: number;
  candidateValues?: CandidateValuePrediction[];
  explanation?: string;
} | null;

type BranchingDiagnostics = {
  totalCandidateStates: number;
  priorEntropyBits: number;
  disputedAttributesCount: number;
  recommendationsCount: number;
  exhausted: boolean;
  contradictionFallback: boolean;
};

type AuditResponse = {
  valid: boolean;
  checkedEntries: number;
  totalEntries: number;
  nextAfterSequence: number | null;
  entries: PublicEnvelopeEntry[];
  publicEnvelope: {
    genesisHash: string;
    headHash: string;
    pagePreviousHash: string;
    pageHeadHash: string;
    zeroKnowledgeProof: false;
    note: string;
  };
};

type EvidenceTimelineItem = {
  id: string;
  table: string;
  recordId: number;
  field: string;
  value: string | number | boolean | null;
  at: string;
  sourceRef?: string;
  sourceSha256?: string;
};

type AppError = Error & { code?: string };
type ClaimVerificationStatus = { kind: 'valid' | 'invalid' | 'error'; message: string } | null;
type ProofStatus = { sequence: number; kind: 'valid' | 'invalid' | 'error'; message: string } | null;
type ProofInspection = {
  sequence: number;
  totalEvents: number;
  envelopeHash: string;
  leafHash: string;
  treeRootHash: string;
  countedRootHash: string;
  checkpointRootHash: string;
  checkpointDigest: string;
  checkpointVerified: boolean;
  pathSteps: EnvelopeMerklePathStep[];
} | null;

async function request<T>(path: string, token?: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as { error?: string; code?: string } & T;
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`) as AppError;
    error.code = payload.code;
    throw error;
  }
  return payload;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Invalid number in audit envelope.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new TypeError('Invalid value in audit envelope.');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function verifyEnvelopePage(entries: PublicEnvelopeEntry[], startHash: string, startSequence: number): Promise<boolean> {
  if (!crypto.subtle) return false;
  let previousHash = startHash;
  let sequence = startSequence;
  for (const entry of entries) {
    if (entry.sequence !== sequence + 1 || entry.previousEnvelopeHash !== previousHash) return false;
    const { envelopeHash, ...commitment } = entry;
    if (await sha256(canonicalJson(commitment)) !== envelopeHash) return false;
    previousHash = envelopeHash;
    sequence = entry.sequence;
  }
  return true;
}

function shortHash(value: string): string {
  return value.length > 22 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

function parseJsonScalar(input: string): { ok: true; value: string | number | boolean | null } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(input);
    if (parsed === null || typeof parsed === 'string' || typeof parsed === 'boolean') return { ok: true, value: parsed };
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return { ok: true, value: parsed };
    return { ok: false, error: 'Only JSON scalar values are supported; objects and arrays are not accepted.' };
  } catch {
    return { ok: false, error: 'Enter valid JSON, such as "text", 42, true, or null.' };
  }
}

export class CaseViewErrorBoundary extends Component<{ children: ReactNode; onReset: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="case-error-fallback" role="alert" aria-live="assertive">
          <CircleAlert size={22} />
          <h2>This case view could not be rendered</h2>
          <p>The case response may be malformed. Your saved evidence remains available; return to the case list and reopen it.</p>
          <button type="button" className="secondary-button" onClick={this.props.onReset}>Return to cases</button>
        </section>
      );
    }
    return this.props.children;
  }
}

function RowGraph({ state, tables, schema }: { state: CandidateState | null; tables: string[]; schema: CaseSchema | null }) {
  const graph = useMemo(() => {
    const columns = new Map<string, Array<{ key: string; table: string; row: Record<string, unknown>; index: number }>>();
    for (const table of tables) {
      columns.set(table, (state?.data?.[table] ?? []).slice(0, 16).map((row, index) => ({
        key: `${table}:${String(row._recordId ?? index)}`, table, row, index,
      })));
    }
    const tableGap = 250;
    const width = Math.max(540, tables.length * tableGap + 60);
    const maxRows = Math.max(1, ...Array.from(columns.values(), items => items.length));
    const height = Math.max(260, 110 + (maxRows - 1) * 76);
    const tableIndex = new Map(tables.map((table, index) => [table, index]));
    const nodePositions = new Map<string, { x: number; y: number }>();
    for (const [table, rows] of columns) rows.forEach(node => nodePositions.set(node.key, {
      x: 120 + (tableIndex.get(table) ?? 0) * tableGap,
      y: 74 + node.index * 76,
    }));
    const edges: Array<{ from: string; to: string }> = [];
    for (const constraint of schema?.constraints ?? []) {
      if (constraint.type !== 'FOREIGN_KEY' || !constraint.targetTable) continue;
      const fromField = constraint.fields?.[0] ?? constraint.field;
      const toField = constraint.targetFields?.[0] ?? constraint.targetField ?? 'id';
      for (const source of columns.get(constraint.table) ?? []) {
        const sourceValue = source.row[fromField];
        if (sourceValue === undefined || sourceValue === null) continue;
        const target = (columns.get(constraint.targetTable) ?? []).find(candidate => candidate.row[toField] !== undefined && String(candidate.row[toField]) === String(sourceValue));
        if (target) edges.push({ from: source.key, to: target.key });
      }
    }
    const rows = Array.from(columns.values()).flat();
    return { rows, columns, nodePositions, edges, height, width, tableGap };
  }, [state, tables, schema]);

  if (!state) return <div className="graph-empty">Define a target schema, then submit partial record observations.</div>;
  if (graph.rows.length === 0) return <div className="graph-empty">No record fragments have been observed yet. The graph will emerge as evidence is added.</div>;
  return (
    <div className="graph-scroll custom-scrollbar" aria-label="Candidate relational hypothesis graph">
      <svg className="record-graph" viewBox={`0 0 ${graph.width} ${graph.height}`} role="img" aria-label="Observed records connected by declared foreign keys">
        <defs><linearGradient id="edgeGlow" x1="0" x2="1"><stop offset="0" stopColor="#55d6be"/><stop offset="1" stopColor="#8d82ff"/></linearGradient></defs>
        {tables.map((table, index) => <text key={table} x={120 + index * graph.tableGap} y="27" textAnchor="middle" className="graph-column-title">{table.toUpperCase()} · {graph.columns.get(table)?.length ?? 0}</text>)}
        {graph.edges.map(edge => {
          const from = graph.nodePositions.get(edge.from)!; const to = graph.nodePositions.get(edge.to)!;
          return <path key={`${edge.from}->${edge.to}`} d={`M ${from.x - 70} ${from.y} C ${(from.x + to.x) / 2} ${from.y}, ${(from.x + to.x) / 2} ${to.y}, ${to.x + 70} ${to.y}`} className="graph-edge"/>;
        })}
        {graph.rows.map(node => {
          const point = graph.nodePositions.get(node.key)!;
          const displayField = schema?.tableDefinitions?.find(table => table.name === node.table)?.columns.find(column => column.name !== 'id')?.name;
          const label = (displayField ? node.row[displayField] : undefined) ?? node.row.name ?? node.row.title ?? node.row.hostname ?? node.row.id ?? `record ${String(node.row._recordId ?? node.index + 1)}`;
          const identifier = node.row.id ?? node.row._recordId ?? node.index + 1;
          const index = tables.indexOf(node.table);
          return <g key={node.key} transform={`translate(${point.x} ${point.y})`} className={`graph-node graph-node-generic graph-node-${Math.max(0, index) % 5}`}><rect x="-72" y="-26" width="144" height="52" rx="12"/><text x="0" y="-3" textAnchor="middle" className="graph-node-label">{String(label).slice(0, 19)}</text><text x="0" y="14" textAnchor="middle" className="graph-node-meta">record {String(identifier)}</text></g>;
        })}
      </svg>
      <div className="graph-legend">{tables.map((table, index) => <span key={table}><i className={`legend-dot graph-legend-dot-${index % 5}`}/>{table}</span>)}<span className="muted">Showing up to 16 rows per relation · only observed references are connected</span></div>
    </div>
  );
}

function CandidateMap({ candidates, total, selectedId, onSelect }: {
  candidates: CandidateSummary[];
  total: number;
  selectedId: string | null;
  onSelect: (candidateId: string) => void;
}) {
  if (candidates.length === 0) return null;
  const width = Math.max(420, 142 + candidates.length * 73);
  const nodes = candidates.map((candidate, index) => ({
    candidate,
    x: 137 + index * 72,
    y: index % 2 === 0 ? 30 : 70,
  }));
  return (
    <div className="candidate-map-wrap" aria-label="Candidate state hypothesis graph">
      <div className="candidate-map-label"><span className="map-root-dot" /><span>Shared evidence</span><i /> <strong>{total.toLocaleString()} state{total === 1 ? '' : 's'}</strong></div>
      <div className="candidate-map-scroll custom-scrollbar"><svg viewBox={`0 0 ${width} 100`} className="candidate-map" role="group" aria-label="Shared evidence linked to ranked candidate states">
        <line x1="74" y1="50" x2={width - 30} y2="50" className="candidate-spine" />
        <circle cx="50" cy="50" r="20" className="candidate-root" /><text x="50" y="53" className="candidate-root-label" textAnchor="middle">EV</text>
        {nodes.map(({ candidate, x, y }) => <g key={candidate.id} className={candidate.id === selectedId ? 'candidate-map-node selected' : 'candidate-map-node'} role="button" tabIndex={0} aria-label={`Show candidate ${candidate.rank}`} onClick={() => onSelect(candidate.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(candidate.id); } }}>
          <line x1={x} y1="50" x2={x} y2={y} className="candidate-branch" />
          <circle cx={x} cy={y} r="15" /><text x={x} y={y + 3} textAnchor="middle">{candidate.rank}</text>
        </g>)}
      </svg></div>
      <span className="candidate-map-caption">Showing the highest ranked {candidates.length} interpretations. Scores are heuristic.</span>
    </div>
  );
}

type AdminOverview = {
  cases: number;
  evidenceFragments: number;
  auditLogs: number;
  users: number;
  administrators: number;
  generatedAt: string;
};

function exportTableAsCSV(relationName: string, rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) return;
  const headers = Object.keys(rows[0]!).filter(k => k !== '_recordId');
  const csvRows = [
    headers.join(','),
    ...rows.map(row => headers.map(h => {
      const val = row[h];
      const str = val === null || val === undefined ? '' : String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    }).join(','))
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${relationName}_reconstructed_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function exportTableAsJSON(relationName: string, rows: Record<string, unknown>[]) {
  if (!rows || rows.length === 0) return;
  const cleaned = rows.map(r => {
    const copy = { ...r };
    delete copy._recordId;
    return copy;
  });
  const blob = new Blob([JSON.stringify(cleaned, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${relationName}_reconstructed_${Date.now()}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function AdministratorDashboard({
  token,
  email,
  onLogout,
  onBackup,
}: {
  token: string;
  email: string;
  onLogout: () => void;
  onBackup: () => void;
}) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setOverview(await request<AdminOverview>('/admin/overview', token));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load administrator overview.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let ignore = false;
    void request<AdminOverview>('/admin/overview', token)
      .then(data => {
        if (!ignore) {
          setOverview(data);
          setError('');
          setLoading(false);
        }
      })
      .catch(cause => {
        if (!ignore) {
          setError(cause instanceof Error ? cause.message : 'Could not load administrator overview.');
          setLoading(false);
        }
      });
    return () => { ignore = true; };
  }, [token]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-icon"><Cpu size={20} /></span><div><strong>LAZARUS<span>−</span>X</strong><small>ADMINISTRATOR CONTROL CENTER</small></div></div>
        <div className="topbar-right">
          <div className="student-pill" title="Lab Assessment Identity (Instruction 7)">
            <Award size={13} />
            <span>Divyank Seervi (24BCE0793)</span>
            <span className="slot-tag">L25+L26</span>
          </div>
          <div className="system-pill"><span className="status-light" /> ADMIN ENGINE ONLINE</div>
          <div className="user-pill"><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span>{email}</span><span className="role-tag">ADMIN</span></div>
          <button className="icon-button" aria-label="Log out" title="Log out" onClick={onLogout}><LogOut size={17} /></button>
        </div>
      </header>
      <main className="workspace admin-dashboard">
        <aside className="sidebar admin-sidebar">
          <div className="sidebar-head"><div><span className="eyebrow">ADMINISTRATION</span><h2>System controls</h2></div><ShieldCheck size={22} /></div>
          <button type="button" className="new-case-button" onClick={() => setAuditOpen(true)}><ClipboardCheck size={15} /> Audit trail</button>
          <button type="button" className="secondary-button full-width" onClick={onBackup}><Database size={15} /> Native database backup</button>
          <div className="sidebar-footer"><Shield size={15} /><span>Privileged actions are enforced by the API.</span></div>
        </aside>
        <section className="main-column">
          <div className="page-heading">
            <div>
              <div className="eyebrow">ROLE-BASED ADMINISTRATION <span className="eyebrow-line" /></div>
              <h1>Administrator dashboard</h1>
              <p>Monitor platform-wide database activity, audit events, users, and recovery operations.</p>
            </div>
            <div className="heading-actions">
              <button type="button" className="secondary-button" onClick={() => void loadOverview()} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh overview</button>
              <button type="button" className="secondary-button" onClick={onBackup}><Database size={15} /> Backup database</button>
            </div>
          </div>
          {error && <div className="banner banner-error" role="alert"><CircleAlert size={16} />{error}</div>}
          <section className="panel admin-hero-panel">
            <div className="panel-heading"><div className="panel-title"><span className="panel-icon violet-icon"><ShieldCheck size={17} /></span><div><h2>Privileged operations</h2><p>This dashboard is intentionally separate from investigator reconstruction work.</p></div></div><span className="live-tag"><i /> ADMIN ONLY</span></div>
            <div className="admin-feature-grid">
              <article><Database size={20} /><strong>Backup and recovery</strong><span>Generate a native SQLite backup and verify database integrity.</span><button type="button" className="secondary-button" onClick={onBackup}>Run backup</button></article>
              <article><ClipboardCheck size={20} /><strong>Cross-user audit visibility</strong><span>Review application events across all investigators with filters and pagination.</span><button type="button" className="secondary-button" onClick={() => setAuditOpen(true)}>Open audit trail</button></article>
              <article><Activity size={20} /><strong>System monitoring</strong><span>Inspect counts for users, cases, evidence fragments, and audit records.</span><button type="button" className="secondary-button" onClick={() => void loadOverview()}>Refresh metrics</button></article>
            </div>
          </section>
          <section className="admin-metric-grid" aria-label="Administrator system metrics">
            {[
              ['Registered users', overview?.users ?? 0, 'Single Users table'],
              ['Administrators', overview?.administrators ?? 0, 'Provisioned operators'],
              ['Reconstruction cases', overview?.cases ?? 0, 'All owners'],
              ['Evidence fragments', overview?.evidenceFragments ?? 0, 'Committed observations'],
              ['Audit events', overview?.auditLogs ?? 0, 'Cross-user visibility'],
            ].map(([label, value, hint]) => <article className="admin-metric-card" key={label}><span>{label}</span><strong>{loading ? '…' : value}</strong><small>{hint}</small></article>)}
          </section>
        </section>
      </main>
      <AuditLogsModal isOpen={auditOpen} onClose={() => setAuditOpen(false)} currentUser={{ id: email, email, role: 'ADMIN' }} apiBase={API_BASE} token={token} />
    </div>
  );
}

const DEFAULT_PORTAL_CREDENTIALS = {
  INVESTIGATOR: {
    email: 'investigator@lazarus.local',
    password: 'Investigator2026!',
  },
  ADMIN: {
    email: 'admin@lazarus.local',
    password: 'Admin2026!Pass',
  },
} as const;

function App() {
  const initialPortal: 'INVESTIGATOR' | 'ADMIN' = window.location.pathname === '/admin-login' ? 'ADMIN' : 'INVESTIGATOR';
  const [token, setToken] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [authPortal, setAuthPortal] = useState<'INVESTIGATOR' | 'ADMIN'>(initialPortal);
  const [authEmail, setAuthEmail] = useState<string>(DEFAULT_PORTAL_CREDENTIALS[initialPortal].email);
  const [authPassword, setAuthPassword] = useState<string>(DEFAULT_PORTAL_CREDENTIALS[initialPortal].password);
  const [registerMode, setRegisterMode] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseSchema, setCaseSchema] = useState<CaseSchema | null>(null);
  const [schemaStudioOpen, setSchemaStudioOpen] = useState(false);
  const [caseStatus, setCaseStatus] = useState<string>('ACTIVE');
  const [graphViewMode, setGraphViewMode] = useState<'row' | 'schema'>('row');
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [auditLogsModalOpen, setAuditLogsModalOpen] = useState(false);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [diffViewOpen, setDiffViewOpen] = useState(false);

  const triggerAdminBackup = async () => {
    if (!token || role !== 'ADMIN') return;
    setBackupInProgress(true);
    try {
      const res = await fetch(`${API_BASE}/admin/backup`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert(`[DATABASE BACKUP SUCCESS]\n\nFile: ${data.backup?.filename}\nSize: ${data.backup?.bytes} bytes\nTimestamp: ${data.backup?.timestamp}\nLocation: ${data.backup?.location}`);
      } else {
        alert(`[DATABASE BACKUP ERROR]\n\n${data.error || 'Failed to trigger backup'}`);
      }
    } catch (err: any) {
      alert(`[DATABASE BACKUP ERROR]\n\n${err.message || 'Network error'}`);
    } finally {
      setBackupInProgress(false);
    }
  };
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [caseSearch, setCaseSearch] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SEALED'>('ALL');
  const [casePage, setCasePage] = useState(1);
  const [caseTotal, setCaseTotal] = useState(0);
  const [caseTotalPages, setCaseTotalPages] = useState(1);
  const [caseName, setCaseName] = useState('');
  const [isEditingCaseName, setIsEditingCaseName] = useState(false);
  const [caseNameDraft, setCaseNameDraft] = useState('');
  const [tableFilterQuery, setTableFilterQuery] = useState('');
  const [engineState, setEngineState] = useState<CandidateState | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateSummary[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation>(null);
  const [rankedRecommendations, setRankedRecommendations] = useState<NonNullable<Recommendation>[]>([]);
  const [branchingDiag, setBranchingDiag] = useState<BranchingDiagnostics | null>(null);
  const [entropy, setEntropy] = useState<{ before?: number; after: number; reduction?: number; candidateCount: number }>({ after: 0, candidateCount: 0 });
  const [auditEntries, setAuditEntries] = useState<PublicEnvelopeEntry[]>([]);
  const [auditNext, setAuditNext] = useState<number | null>(null);
  const [auditHead, setAuditHead] = useState('');
  const [auditValid, setAuditValid] = useState<boolean | null>(null);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditNote, setAuditNote] = useState('');
  const [auditTab, setAuditTab] = useState<'guidance' | 'ledger'>('guidance');
  const [claimVerifierOpen, setClaimVerifierOpen] = useState(false);
  const [claimJson, setClaimJson] = useState('');
  const [claimVerification, setClaimVerification] = useState<ClaimVerificationStatus>(null);
  const [claimVerifying, setClaimVerifying] = useState(false);
  const [proofStatus, setProofStatus] = useState<ProofStatus>(null);
  const [proofInspection, setProofInspection] = useState<ProofInspection>(null);
  const [bundleExporting, setBundleExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [table, setTable] = useState<string>('Person');
  const [recordId, setRecordId] = useState('1');
  const [field, setField] = useState('name');
  const [value, setValue] = useState('');
  const [sourceConfidence, setSourceConfidence] = useState(1);
  const [sourceRef, setSourceRef] = useState('');
  const [sourceSha256, setSourceSha256] = useState('');
  const [valueFormat, setValueFormat] = useState<'text' | 'json'>('text');
  const [formErrors, setFormErrors] = useState<{ recordId?: string; field?: string; value?: string; confidence?: string; sourceRef?: string; sourceSha256?: string }>({});
  const [timeline, setTimeline] = useState<EvidenceTimelineItem[]>([]);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const TABLES = caseSchema?.tables ?? [];
  const selectedTableDefinition = caseSchema?.tableDefinitions?.find(definition => definition.name === table);
  const selectedColumnDefinition = selectedTableDefinition?.columns.find(column => column.name === field);

  const normalizedField = field.trim();
  const numericRecordId = Number(recordId);
  const displayedRecordIdError = formErrors.recordId ?? (recordId.trim() === '' ||
    !Number.isSafeInteger(numericRecordId) || numericRecordId < 0 ? 'Record locator must be a non-negative whole number.' : undefined);
  const displayedFieldError = formErrors.field ?? (normalizedField.length === 0
    ? 'Attribute name is required.'
    : normalizedField === '_recordId' ? '_recordId is reserved for internal record identity.' : undefined);
  const jsonValueCheck = valueFormat === 'json' && value.length > 0 ? parseJsonScalar(value) : undefined;
  const displayedValueError = formErrors.value ?? (jsonValueCheck && !jsonValueCheck.ok ? jsonValueCheck.error : undefined);
  const displayedConfidenceError = formErrors.confidence ?? (!Number.isFinite(sourceConfidence) || sourceConfidence <= 0 || sourceConfidence > 1
    ? 'Source confidence must be greater than 0 and at most 1.' : undefined);

  const loadCases = async (
    accessToken: string,
    search = caseSearch,
    status = caseStatusFilter,
    page = casePage
  ) => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (status && status !== 'ALL') params.set('status', status);
    params.set('page', String(page));
    params.set('limit', '8');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await request<{
      cases: CaseSummary[];
      pagination?: { total: number; page: number; limit: number; totalPages: number };
      total?: number;
      totalPages?: number;
    }>(`/cases${queryString}`, accessToken);
    setCases(response.cases || []);
    if (response.pagination) {
      setCaseTotal(response.pagination.total);
      setCaseTotalPages(response.pagination.totalPages);
    } else if (typeof response.total === 'number') {
      setCaseTotal(response.total);
      setCaseTotalPages(response.totalPages || 1);
    } else {
      setCaseTotal(response.cases?.length || 0);
      setCaseTotalPages(1);
    }
  };

  const loadAudit = async (id: string, accessToken: string, after = 0, append = false) => {
    const response = await request<AuditResponse>(`/cases/${encodeURIComponent(id)}/provenance?view=commitments&afterSequence=${after}&limit=50`, accessToken);
    const pageIsValid = response.entries.length === 0
      ? response.publicEnvelope.pageHeadHash === response.publicEnvelope.pagePreviousHash
      : await verifyEnvelopePage(response.entries, response.publicEnvelope.pagePreviousHash, after);
    const localPageHead = response.entries.at(-1)?.envelopeHash ?? response.publicEnvelope.pagePreviousHash;
    const fullHeadMatches = response.nextAfterSequence !== null || response.publicEnvelope.headHash === response.publicEnvelope.pageHeadHash;
    const commitmentCheckValid = pageIsValid && localPageHead === response.publicEnvelope.pageHeadHash && fullHeadMatches;
    setAuditEntries(current => append ? [...current, ...response.entries] : response.entries);
    setAuditNext(response.nextAfterSequence);
    setAuditHead(response.publicEnvelope.headHash);
    setAuditTotal(response.totalEntries);
    setAuditNote(response.publicEnvelope.note);
    setAuditValid(current => response.valid && commitmentCheckValid && (append ? current !== false : true));
  };

  const authenticate = async (register: boolean) => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      if (register) {
        await request('/auth/register', undefined, { method: 'POST', body: JSON.stringify({ email: authEmail, password: authPassword }) });
      }
      const session = await request<{ token: string; role: string; email: string }>('/auth/login', undefined, {
        method: 'POST', body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      if (session.role !== authPortal) {
        throw new Error(`This account belongs to the ${session.role.toLowerCase()} portal. Choose the matching login page.`);
      }
      setToken(session.token);
      setEmail(session.email);
      setRole(session.role);
      await loadCases(session.token);
      if (register) setNotice('Investigator account created and authenticated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const switchAuthPortal = (nextPortal: 'INVESTIGATOR' | 'ADMIN') => {
    setAuthPortal(nextPortal);
    setRegisterMode(false);
    setError('');
    setAuthEmail(DEFAULT_PORTAL_CREDENTIALS[nextPortal].email);
    setAuthPassword(DEFAULT_PORTAL_CREDENTIALS[nextPortal].password);
    window.history.replaceState({}, '', nextPortal === 'ADMIN' ? '/admin-login' : '/investigator-login');
  };

  const resetCase = () => {
    setCaseId(null);
    setCaseSchema(null);
    setSchemaStudioOpen(false);
    setCaseName('');
    setIsEditingCaseName(false);
    setCaseNameDraft('');
    setTableFilterQuery('');
    setEngineState(null);
    setSelectedCandidateId(null);
    setCandidates([]);
    setRecommendation(null);
    setEntropy({ after: 0, candidateCount: 0 });
    setAuditEntries([]);
    setAuditNext(null);
    setAuditHead('');
    setAuditValid(null);
    setAuditTotal(0);
    setClaimVerifierOpen(false);
    setClaimJson('');
    setClaimVerification(null);
    setProofStatus(null);
    setProofInspection(null);
    setTimeline([]);
    setDivyank24BCE0793_selectedScenarioId('ir-clean');
  };

  const handleRenameCase = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    if (!caseId || !token || !caseNameDraft.trim()) return;
    try {
      const res = await request<{ success: boolean; case: { name: string } }>(
        `/cases/${encodeURIComponent(caseId)}`,
        token,
        { method: 'PATCH', body: JSON.stringify({ name: caseNameDraft.trim() }) }
      );
      setCaseName(res.case.name);
      setIsEditingCaseName(false);
      setNotice(`Case renamed to "${res.case.name}".`);
      await loadCases(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not rename case.');
    }
  };

  const handleDeleteCase = async () => {
    if (!caseId || !token) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete case "${caseName || caseId}"?\n\nThis will permanently purge all evidence fragments, ledger entries, and candidate hypotheses.`
    );
    if (!confirmed) return;
    setLoading(true);
    try {
      await request(`/cases/${encodeURIComponent(caseId)}`, token, { method: 'DELETE' });
      setNotice('Case deleted successfully.');
      resetCase();
      await loadCases(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete case.');
    } finally {
      setLoading(false);
    }
  };

  const openCase = async (id: string) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const state = await request<{
        id: string;
        name?: string;
        status?: string;
        schemaDefinition?: CaseSchema;
        bestState: CandidateState;
        candidates: CandidateSummary[];
        ambiguityReduction: Recommendation;
        evidenceRecommendations?: NonNullable<Recommendation>[];
        branchingDiagnostics?: BranchingDiagnostics;
        recentEvidence?: Array<{ id: string; sequence: number; table: string; recordId: number; field: string; value: string | number | boolean | null; sourceRef?: string; sourceSha256?: string; at: string }>;
        ambiguity: { entropyBits: number; candidateCount: number };
      }>(`/cases/${encodeURIComponent(id)}`, token);
      setCaseId(state.id);
      setCaseName(state.name || 'Untitled Case');
      setCaseNameDraft(state.name || 'Untitled Case');
      setIsEditingCaseName(false);
      setCaseStatus(state.status || 'ACTIVE');
      // Old API responses predate per-case schemas; their behavior was the legacy workforce demo.
      const openedSchema = state.schemaDefinition
        ? { ...state.schemaDefinition, tableDefinitions: state.schemaDefinition.tableDefinitions ?? state.schemaDefinition.tables.map(name => ({ name, columns: [] })) }
        : createPresetSchema('workforce-orders');
      setCaseSchema(openedSchema);
      if (openedSchema.preset === 'workforce-orders') {
        setDivyank24BCE0793_selectedScenarioId('wf-clean');
      } else if (openedSchema.preset === 'incident-response') {
        setDivyank24BCE0793_selectedScenarioId('ir-clean');
      }
      const firstTable = openedSchema.tables[0] ?? 'Department';
      setTable(firstTable);
      setField(openedSchema.tableDefinitions?.find(definition => definition.name === firstTable)?.columns?.[0]?.name ?? 'name');
      setEngineState(state.bestState);
      setSelectedCandidateId(state.bestState.id);
      setCandidates(state.candidates);
      setRecommendation(state.ambiguityReduction);
      setRankedRecommendations(state.evidenceRecommendations ?? (state.ambiguityReduction ? [state.ambiguityReduction] : []));
      setBranchingDiag(state.branchingDiagnostics ?? null);
      setEntropy({ after: state.ambiguity.entropyBits, candidateCount: state.ambiguity.candidateCount });
      setTimeline((state.recentEvidence ?? []).map(item => ({ id: item.id || String(item.sequence), table: item.table, recordId: item.recordId, field: item.field, value: item.value, at: item.at, ...(item.sourceRef ? { sourceRef: item.sourceRef } : {}), ...(item.sourceSha256 ? { sourceSha256: item.sourceSha256 } : {}) })));
      setProofStatus(null);
      setProofInspection(null);
      await loadAudit(state.id, token);
      setNotice('Case restored from its verified evidence ledger.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open case.');
    } finally {
      setLoading(false);
    }
  };

  const createCase = async (caseNameInput: string, schemaInput: CaseSchema) => {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const created = await request<{ id: string; name?: string; status?: string; schemaDefinition?: CaseSchema; bestState: CandidateState; candidates: CandidateSummary[] }>('/cases', token, { method: 'POST', body: JSON.stringify({ name: caseNameInput, schemaDefinition: schemaInput }) });
      // Legacy/mocked servers omit schemaDefinition and create the historical workforce schema.
      const createdSchema = created.schemaDefinition ?? createPresetSchema('workforce-orders');
      setCaseId(created.id);
      setCaseSchema(createdSchema);
      if (createdSchema.preset === 'workforce-orders') {
        setDivyank24BCE0793_selectedScenarioId('wf-clean');
      } else if (createdSchema.preset === 'incident-response') {
        setDivyank24BCE0793_selectedScenarioId('ir-clean');
      }
      setSchemaStudioOpen(false);
      setTable(createdSchema.tables[0] ?? 'Person');
      setField(createdSchema.tableDefinitions?.find(definition => definition.name === createdSchema.tables[0])?.columns?.[0]?.name ?? 'id');
      setCaseName(created.name || caseNameInput || 'Untitled Case');
      setCaseNameDraft(created.name || 'Untitled Case');
      setIsEditingCaseName(false);
      setCaseStatus(created.status || 'ACTIVE');
      setEngineState(created.bestState);
      setSelectedCandidateId(created.bestState.id);
      setCandidates(created.candidates);
      setRecommendation(null);
      setEntropy({ after: 0, candidateCount: created.candidates.length });
      setTimeline([]);
      setAuditEntries([]);
      setAuditNext(null);
      setAuditHead('');
      setAuditValid(true);
      setAuditTotal(0);
      setProofStatus(null);
      setProofInspection(null);
      setNotice(`New reconstruction case initialized. ${createdSchema.tables.length} declared relations are ready for partial evidence and hypothesis comparison.`);
      await loadCases(token);
      await loadAudit(created.id, token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create case.');
    } finally {
      setLoading(false);
    }
  };

  type EvidenceBatchResponse = {
    bestState: CandidateState;
    candidates: CandidateSummary[];
    ambiguityReduction: Recommendation;
    evidenceRecommendations?: NonNullable<Recommendation>[];
    branchingDiagnostics?: BranchingDiagnostics;
    ambiguity: { entropyBeforeBits: number; entropyAfterBits: number; reductionBits: number; candidateCountAfter: number };
    provenance: { sequence: number; appendedEvents: number };
  };

  const commitEvidenceBatch = async (
    evidence: ImportedEvidenceFragment[],
    successMessage: string,
    replaceTimeline = false,
    exactNotice?: string,
  ) => {
    if (!caseId || !token || evidence.length === 0) return;
    setLoading(true);
    setError('');
    setNotice('');
    let commitSucceeded = false;
    let committedSequence: number | undefined;
    try {
      const response = await request<EvidenceBatchResponse>(`/cases/${encodeURIComponent(caseId)}/evidence`, token, {
        method: 'POST', body: JSON.stringify({ evidence }),
      });
      commitSucceeded = true;
      committedSequence = response.provenance.sequence;
      setEngineState(response.bestState);
      setSelectedCandidateId(response.bestState.id);
      setCandidates(response.candidates);
      setRecommendation(response.ambiguityReduction);
      setRankedRecommendations(response.evidenceRecommendations ?? (response.ambiguityReduction ? [response.ambiguityReduction] : []));
      setBranchingDiag(response.branchingDiagnostics ?? null);
      setEntropy({ before: response.ambiguity.entropyBeforeBits, after: response.ambiguity.entropyAfterBits, reduction: response.ambiguity.reductionBits, candidateCount: response.ambiguity.candidateCountAfter });
      const timestamp = new Date().toISOString();
      const appendedEvents = Number.isSafeInteger(response.provenance.appendedEvents) ? response.provenance.appendedEvents : evidence.length;
      const timelineItems = evidence.map((item, index) => ({
        id: `${response.provenance.sequence - appendedEvents + index + 1}-${Date.now()}-${index}`,
        table: item.table, recordId: item.recordId, field: item.field, value: item.value, at: timestamp, ...(item.sourceRef ? { sourceRef: item.sourceRef } : {}), ...(item.sourceSha256 ? { sourceSha256: item.sourceSha256 } : {}),
      })).reverse();
      setTimeline(current => (replaceTimeline ? timelineItems : [...timelineItems, ...current]).slice(0, 50));
      setValue('');
      setSourceRef('');
      setSourceSha256('');
      setFormErrors({});
      setNotice(exactNotice ?? `${successMessage} · ${evidence.length} fragment(s) · ledger sequence ${response.provenance.sequence}`);
      // The evidence commit is durable before the secondary UI refreshes run. If a
      // refresh fails, don't tell the investigator to submit the same evidence again.
      await loadAudit(caseId, token);
      await loadCases(token);
    } catch (cause) {
      if (commitSucceeded) {
        setError(`Evidence was committed at ledger sequence ${committedSequence}, but a follow-up display refresh failed. Reopen the case to refresh its state; do not resubmit the same batch.`);
      } else {
        setError(cause instanceof Error ? cause.message : 'Evidence could not be accepted.');
      }
    } finally {
      setLoading(false);
    }
  };

  const csvCell = (value: string | number | boolean | null) => {
    const text = value === null ? '' : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };

  const downloadEvidenceCsvTemplate = () => {
    if (!caseSchema) return;
    const rows: Array<Array<string | number | boolean | null>> = [['table', 'recordId', 'field', 'value', 'confidence', 'sourceRef', 'sourceSha256']];
    const exampleValues = new Map<string, string | number | boolean | null>();
    caseSchema.tableDefinitions.forEach((definition, index) => {
      for (const column of definition.columns) {
        let example: string | number | boolean | null;
        if (column.type === 'NUMBER') example = /id$/i.test(column.name) || column.unique ? index + 1 : 100 + index;
        else if (column.type === 'BOOLEAN') example = true;
        else if (column.name.toLowerCase() === 'sha256') example = '0'.repeat(64); // format-only template placeholder, not a real artifact digest
        else if (/name|hostname|title|role|severity|finding/i.test(column.name)) example = `Example ${definition.name} ${column.name}`;
        else example = `sample-${definition.name.toLowerCase()}-${column.name.toLowerCase()}`;
        exampleValues.set(`${definition.name}.${column.name}`, example);
      }
    });
    for (const constraint of caseSchema.constraints) {
      if (constraint.type !== 'FOREIGN_KEY' || !constraint.targetTable || !constraint.targetField) continue;
      const targetValue = exampleValues.get(`${constraint.targetTable}.${constraint.targetField}`);
      if (targetValue !== undefined) exampleValues.set(`${constraint.table}.${constraint.field}`, targetValue);
    }
    caseSchema.tableDefinitions.forEach((definition, index) => {
      for (const column of definition.columns) {
        rows.push([definition.name, index + 1, column.name, exampleValues.get(`${definition.name}.${column.name}`) ?? '', 0.95, '', '']);
      }
    });
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `lazarus-evidence-template-${caseSchema.preset || 'custom'}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleEvidenceCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !caseSchema || !caseId || !token) return;
    if (file.size > 512 * 1024) { setError('CSV file must be 512 KiB or smaller so the resulting request fits the API request limit.'); return; }
    try {
      const parsed = parseEvidenceCsv(await file.text(), caseSchema);
      const approved = window.confirm(`Import ${parsed.length} evidence fragments from “${file.name}” into ${caseName}? This is a single batch transaction; accepted fragments become part of the case ledger and cannot be individually removed. Review your CSV before continuing.`);
      if (!approved) return;
      await commitEvidenceBatch(parsed, `Imported ${file.name}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not parse evidence CSV.');
      setNotice('');
    }
  };

  const submitEvidence = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!caseId || !token) return;
    const numericRecordId = Number(recordId);
    const nextErrors: { recordId?: string; field?: string; value?: string; confidence?: string; sourceRef?: string; sourceSha256?: string } = {};
    if (recordId.trim() === '' || !Number.isSafeInteger(numericRecordId) || numericRecordId < 0) {
      nextErrors.recordId = 'Record locator must be a non-negative whole number.';
    }
    if (normalizedField.length === 0) nextErrors.field = 'Attribute name is required.';
    else if (normalizedField === '_recordId') nextErrors.field = '_recordId is reserved for internal record identity.';
    else if (normalizedField.length > 256) nextErrors.field = 'Attribute name may contain at most 256 characters.';
    if (!Number.isFinite(sourceConfidence) || sourceConfidence <= 0 || sourceConfidence > 1) {
      nextErrors.confidence = 'Source confidence must be greater than 0 and at most 1.';
    }
    if (sourceRef.trim().length > 256 || sourceRef.split('').some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) nextErrors.sourceRef = 'Source reference must be a printable label of at most 256 characters.';
    if (sourceSha256.trim() && !/^[a-f0-9]{64}$/i.test(sourceSha256.trim())) nextErrors.sourceSha256 = 'Source SHA-256 must contain exactly 64 hexadecimal characters.';

    let evidenceValue: string | number | boolean | null;
    if (valueFormat === 'json') {
      const parsed = parseJsonScalar(value);
      if (parsed.ok) evidenceValue = parsed.value;
      else {
        nextErrors.value = parsed.error;
        evidenceValue = value;
      }
    } else {
      const numericValue = Number(value);
      if (selectedColumnDefinition?.type === 'NUMBER' && value.trim() !== '' && Number.isFinite(numericValue)) evidenceValue = numericValue;
      else if (selectedColumnDefinition?.type === 'BOOLEAN' && ['true', 'false'].includes(value.trim().toLowerCase())) evidenceValue = value.trim().toLowerCase() === 'true';
      else evidenceValue = value;
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      setError('Fix the highlighted evidence fields before submitting.');
      return;
    }
    setFormErrors({});
    await commitEvidenceBatch([{ table, recordId: numericRecordId, field: normalizedField, value: evidenceValue, confidence: sourceConfidence, ...(sourceRef.trim() ? { sourceRef: sourceRef.trim() } : {}), ...(sourceSha256.trim() ? { sourceSha256: sourceSha256.trim().toLowerCase() } : {}) }], 'Evidence accepted');
  };

  const divyank24BCE0793_scenarioList = divyank24BCE0793_EXAMPLE_SCENARIOS;
  const [divyank24BCE0793_selectedScenarioId, setDivyank24BCE0793_selectedScenarioId] = useState<string>('ir-clean');

  const divyank24BCE0793_loadExampleScenario = async (scenarioId: string) => {
    if (!caseId || !token || !caseSchema || loading || caseStatus === 'SEALED') return;
    if (auditTotal > 0) {
      setError('Example scenarios can only be loaded into a case with an empty evidence ledger. Create a fresh case to keep the demonstration reproducible.');
      return;
    }
    const scenario = divyank24BCE0793_scenarioList.find(s => s.id === scenarioId);
    if (!scenario) return;
    if (caseSchema.preset !== scenario.preset) {
      setError(`This scenario requires the '${scenario.preset}' preset. Create a new case with that preset to load it.`);
      return;
    }
    const confirmed = window.confirm(`Load ${scenario.evidence.length} EXAMPLE fragments into this case? These are demo values, not recovered evidence, and cannot be removed individually.`);
    if (!confirmed) return;
    await commitEvidenceBatch(
      scenario.evidence,
      `Example '${scenario.title}' loaded`,
      true,
      `Example '${scenario.title}' loaded (${scenario.evidence.length} fragments)`,
    );
  };

  const loadSyntheticWalkthrough = async () => {
    if (!caseId || !token || !caseSchema || loading || caseStatus === 'SEALED') return;
    if (auditTotal > 0) {
      setError('The synthetic walkthrough can only be loaded into a case with an empty evidence ledger. Create a fresh case to keep the demonstration reproducible.');
      return;
    }
    if (!hasWalkthroughConflictTarget(caseSchema)) {
      setError('The synthetic ambiguity walkthrough needs at least one non-unique field. Add a non-unique field in Schema Studio and create a new case.');
      return;
    }
    const evidence = createWalkthroughEvidence(caseSchema);
    if (evidence.length === 0) {
      setError('This schema has no suitable fields for the walkthrough. Add declared fields in Schema Studio and create a new case.');
      return;
    }
    const confirmed = window.confirm(`Load ${evidence.length} SYNTHETIC evidence fragments into “${caseName}”? This deliberately introduces one conflicting value to demonstrate candidate ambiguity. These are example values, not recovered/source evidence, and cannot be removed individually.`);
    if (!confirmed) return;
    await commitEvidenceBatch(evidence, `Synthetic walkthrough loaded across ${caseSchema.tables.length} relations`, true);
  };

  const openCandidate = async (candidateId: string) => {
    if (!caseId || !token || selectedCandidateId === candidateId) return;
    setLoading(true);
    setError('');
    try {
      const response = await request<{ candidate: CandidateState }>(
        `/cases/${encodeURIComponent(caseId)}/candidates/${encodeURIComponent(candidateId)}`,
        token,
      );
      setEngineState(response.candidate);
      setSelectedCandidateId(response.candidate.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load candidate state.');
    } finally {
      setLoading(false);
    }
  };

  const loadNextAuditPage = async () => {
    if (!token || !caseId || auditNext === null) return;
    setLoading(true);
    try {
      await loadAudit(caseId, token, auditNext, true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the next ledger page.');
    } finally {
      setLoading(false);
    }
  };


  const sealCase = async () => {
    if (!caseId || !token || loading || caseStatus === 'SEALED') return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/cases/${caseId}/seal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || 'Could not seal case.');
      }
      setCaseStatus('SEALED');
      setNotice(`Case ${caseId} is sealed in LAZARUS-X. Evidence intake through this application is blocked; direct database access remains outside this control.`);
      await loadAudit(caseId, token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to seal case.');
    } finally {
      setLoading(false);
    }
  };

  const exportAudit = () => {
    const payload = JSON.stringify({
      format: 'LAZARUS-X-PUBLIC-COMMITMENT-ENVELOPE-V1',
      caseId,
      anchoredHead: auditHead,
      firstSequence: auditEntries[0]?.sequence ?? null,
      lastSequence: auditEntries.at(-1)?.sequence ?? null,
      entries: auditEntries,
    }, null, 2);
    const href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = `lazarus-x-${caseId}-commitments.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  const exportInclusionProof = async (sequence: number) => {
    if (!caseId || !token) return;
    setProofStatus(null);
    setProofInspection(null);
    try {
      const response = await request<{
        caseId: string;
        envelope: PublicEnvelopeEntry;
        proof: EnvelopeMerkleProof;
        checkpoint: Record<string, unknown>;
        note: string;
      }>(`/cases/${encodeURIComponent(caseId)}/provenance/proofs/${sequence}`, token);
      const checkpointValid = await verifyProvenanceCheckpoint(response.checkpoint);
      const root = response.checkpoint.publicEnvelopeMerkleRoot;
      const proofDetails = await deriveEnvelopeMerkleProofDetails(response.envelope, response.proof);
      const proofValid = checkpointValid && response.caseId === caseId &&
        response.checkpoint.caseId === caseId && response.checkpoint.sequence === response.proof.totalEvents &&
        typeof root === 'string' && proofDetails !== null && proofDetails.countedRootHash === root &&
        await verifyEnvelopeInclusionProof(response.envelope, response.proof, root);
      if (!proofValid) {
        setProofStatus({ sequence, kind: 'invalid', message: `Proof for event ${sequence} failed local verification; no file was downloaded.` });
        return;
      }
      setProofInspection({
        sequence,
        totalEvents: response.proof.totalEvents,
        envelopeHash: response.envelope.envelopeHash,
        leafHash: proofDetails.leafHash,
        treeRootHash: proofDetails.treeRootHash,
        countedRootHash: proofDetails.countedRootHash,
        checkpointRootHash: root as string,
        checkpointDigest: String(response.checkpoint.manifestDigest),
        checkpointVerified: checkpointValid && proofDetails.countedRootHash === root,
        pathSteps: proofDetails.pathSteps,
      });
      const payload = JSON.stringify({ format: 'LAZARUS-X-ENVELOPE-INCLUSION-PROOF-V1', ...response }, null, 2);
      const href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `lazarus-x-${caseId}-proof-${sequence}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      setProofStatus({ sequence, kind: 'valid', message: `Event ${sequence} inclusion proof verified locally and downloaded.` });
    } catch (cause) {
      setProofStatus({ sequence, kind: 'error', message: cause instanceof Error ? cause.message : 'Could not retrieve inclusion proof.' });
    }
  };

  const exportOfflineAuditBundle = async () => {
    if (!caseId || !token) return;
    setBundleExporting(true);
    setError('');
    try {
      const bundle = await request<{ bundleDigest: string; caseId: string; format: string }>(
        `/cases/${encodeURIComponent(caseId)}/export/audit-bundle`, token,
      );
      const payload = JSON.stringify(bundle, null, 2);
      const href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = `lazarus-x-${caseId}-audit-bundle.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 1000);
      setNotice(`Offline audit bundle exported · digest ${bundle.bundleDigest.slice(0, 16)}…`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not export the offline audit bundle.');
    } finally {
      setBundleExporting(false);
    }
  };

  const verifyClaimInput = async () => {
    setClaimVerification(null);
    if (claimJson.trim().length === 0) {
      setClaimVerification({ kind: 'error', message: 'Paste a disclosure and envelope JSON payload to verify.' });
      return;
    }
    if (new TextEncoder().encode(claimJson).byteLength > 131072) {
      setClaimVerification({ kind: 'error', message: 'The pasted payload exceeds the 128 KiB verification limit.' });
      return;
    }

    setClaimVerifying(true);
    try {
      const parsed: unknown = JSON.parse(claimJson);
      if (!isObjectRecord(parsed) || !('disclosure' in parsed) || !('envelope' in parsed)) {
        setClaimVerification({ kind: 'invalid', message: 'TAMPERED / MISMATCHED — payload must contain disclosure and envelope objects.' });
      } else if (await verifyDisclosedClaim(parsed.disclosure, parsed.envelope)) {
        setClaimVerification({ kind: 'valid', message: 'VALID CLAIM — disclosed fields match the event-scoped commitments and envelope hash.' });
      } else {
        setClaimVerification({ kind: 'invalid', message: 'TAMPERED / MISMATCHED — one or more disclosed fields do not match the envelope.' });
      }
    } catch {
      setClaimVerification({ kind: 'error', message: 'Could not verify this payload. Check that it is valid JSON and that Web Crypto is available.' });
    } finally {
      setClaimVerifying(false);
    }
  };

  const logout = async () => {
    if (token) await request('/auth/logout', token, { method: 'POST' }).catch(() => undefined);
    setToken(null);
    setEmail('');
    setRole('');
    setCases([]);
    setCaseSearch('');
    setCaseStatusFilter('ALL');
    setCasePage(1);
    setCaseTotal(0);
    setCaseTotalPages(1);
    resetCase();
    setAuthEmail(DEFAULT_PORTAL_CREDENTIALS[authPortal].email);
    setAuthPassword(DEFAULT_PORTAL_CREDENTIALS[authPortal].password);
  };

  useEffect(() => {
    document.title = caseId ? `Case ${caseId.slice(0, 8)} · LAZARUS-X` : 'LAZARUS-X · Investigator Console';
  }, [caseId]);

  if (!token) {
    return (
      <div className="auth-shell">
        <div className="auth-container">
          {/* Left Column: GitHub / Palantir Enterprise Platform Showcase */}
          <div className="auth-hero-showcase">
            <div className="hero-brand-lockup">
              <span className="brand-icon"><Cpu size={26} /></span>
              <div>
                <strong>LAZARUS<span>−</span>X</strong>
                <span className="hero-version-pill">v2.4.0 · RESEARCH DRAFT</span>
              </div>
            </div>

            <div className="hero-headline-wrap">
              <div className="hero-kicker">
                <span className="status-light" />
                <span>ACTIVE RELATIONAL INFERENCE ENGINE</span>
              </div>
              <h1>Relational database reconstruction from corrupted &amp; out-of-order evidence.</h1>
              <p>
                This platform does not recover deleted bytes directly from disk. It takes analyst-supplied fragments, builds competing relational hypotheses, checks declared constraints, recommends the next observation that could distinguish them, and records accepted evidence in a tamper-evident ledger.
              </p>
            </div>

            <div className="hero-capabilities-grid">
              <div className="hero-cap-card">
                <div className="cap-icon-wrap"><Cpu size={18} /></div>
                <div>
                  <strong>Bounded CSP &amp; AC-3 Solver</strong>
                  <p>AC-3 propagation reduces the search space; explicit work limits reject oversized searches instead of silently truncating them.</p>
                </div>
              </div>
              <div className="hero-cap-card">
                <div className="cap-icon-wrap violet-icon"><Activity size={18} /></div>
                <div>
                  <strong>Predictive Shannon Branching</strong>
                  <p>Ranks candidate follow-up observations by expected information gain under heuristic state weights.</p>
                </div>
              </div>
              <div className="hero-cap-card">
                <div className="cap-icon-wrap cyan-icon"><ShieldCheck size={18} /></div>
                <div>
                  <strong>RFC 6962 Merkle Provenance</strong>
                  <p>Dual-layer cryptographic ledger with HMAC masking and independently verifiable audit manifests.</p>
                </div>
              </div>
            </div>

            <div className="hero-academic-attribution">
              <Award size={16} className="text-amber" />
              <div>
                <strong>Divyank Seervi · 24BCE0793</strong>
                <small>BCSE302P Database Management Systems · Slot L25+L26</small>
              </div>
            </div>
          </div>

          {/* Right Column: High-Precision Authentication Console */}
          <motion.section className="auth-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <div className="auth-card-topline">
              <div className="auth-card-kicker"><ShieldCheck size={14} /> SECURE CONSOLE ACCESS</div>
              <span className="auth-env-badge">ENTERPRISE GATEWAY</span>
            </div>

            <div className="auth-portal-switch" role="tablist" aria-label="Choose login portal">
              <button
                type="button"
                className={authPortal === 'INVESTIGATOR' ? 'primary-button' : 'secondary-button'}
                role="tab"
                aria-selected={authPortal === 'INVESTIGATOR'}
                onClick={() => switchAuthPortal('INVESTIGATOR')}
              >
                Investigator Login
              </button>
              <button
                type="button"
                className={authPortal === 'ADMIN' ? 'primary-button' : 'secondary-button'}
                role="tab"
                aria-selected={authPortal === 'ADMIN'}
                onClick={() => switchAuthPortal('ADMIN')}
              >
                Administrator Login
              </button>
            </div>

            <h2>
              {registerMode
                ? 'Create Investigator Workspace'
                : authPortal === 'ADMIN' ? 'Administrator Console Login' : 'Investigator Workspace Login'}
            </h2>
            <p className="subtle">
              {authPortal === 'ADMIN'
                ? 'Sign in to manage backups, audit visibility, and privileged case operations.'
                : 'Sign in to collect evidence, compare hypotheses, and verify provenance.'}
            </p>

            <div className="demo-presets-panel">
              <div className="demo-presets-header">
                <Sparkles size={13} />
                <span>PRESET DEFAULT CREDENTIALS</span>
              </div>
              <div className="demo-presets-row">
                <button
                  type="button"
                  className={`demo-preset-chip ${authPortal === 'INVESTIGATOR' && !registerMode ? 'active' : ''}`}
                  onClick={() => {
                    if (authPortal !== 'INVESTIGATOR') {
                      switchAuthPortal('INVESTIGATOR');
                    } else {
                      setRegisterMode(false);
                      setAuthEmail(DEFAULT_PORTAL_CREDENTIALS.INVESTIGATOR.email);
                      setAuthPassword(DEFAULT_PORTAL_CREDENTIALS.INVESTIGATOR.password);
                    }
                  }}
                  title="Preset default Investigator credentials"
                >
                  <Cpu size={14} />
                  <div>
                    <strong>Investigator</strong>
                    <small style={{ display: 'block', opacity: 0.75, fontSize: '10px' }}>investigator@lazarus.local</small>
                  </div>
                </button>
                <button
                  type="button"
                  className={`demo-preset-chip ${authPortal === 'ADMIN' ? 'active' : ''}`}
                  onClick={() => {
                    if (authPortal !== 'ADMIN') {
                      switchAuthPortal('ADMIN');
                    } else {
                      setRegisterMode(false);
                      setAuthEmail(DEFAULT_PORTAL_CREDENTIALS.ADMIN.email);
                      setAuthPassword(DEFAULT_PORTAL_CREDENTIALS.ADMIN.password);
                    }
                  }}
                  title="Preset default Administrator credentials"
                >
                  <ShieldCheck size={14} />
                  <div>
                    <strong>Administrator</strong>
                    <small style={{ display: 'block', opacity: 0.75, fontSize: '10px' }}>admin@lazarus.local</small>
                  </div>
                </button>
              </div>
            </div>

            <form onSubmit={event => { event.preventDefault(); void authenticate(registerMode); }} className="auth-form">
              <label htmlFor="authEmail">{authPortal === 'ADMIN' ? 'Administrator email' : 'Investigator email'}</label>
              <div className="input-wrap">
                <Mail size={16} />
                <input id="authEmail" type="email" autoComplete="email" placeholder="investigator@agency.org" value={authEmail} onChange={event => setAuthEmail(event.target.value)} required />
              </div>
              <label htmlFor="authPassword">Password</label>
              <div className="input-wrap">
                <KeyRound size={16} />
                <input id="authPassword" type="password" autoComplete={registerMode ? 'new-password' : 'current-password'} minLength={registerMode ? 12 : undefined} placeholder="••••••••••••" value={authPassword} onChange={event => setAuthPassword(event.target.value)} required />
              </div>
              {error && <div className="inline-error" role="alert"><CircleAlert size={15} />{error}</div>}
              {notice && <div className="inline-success" role="status"><BadgeCheck size={15} />{notice}</div>}
              <button className="primary-button full-width" type="submit" disabled={loading}>
                {loading ? <Loader2 size={17} className="spin" /> : registerMode ? 'Create account' : 'Authenticate'}
                <ArrowRight size={16} />
              </button>
            </form>
            {authPortal === 'INVESTIGATOR' && (
              <button
                type="button"
                className="text-button auth-switch"
                onClick={() => {
                  const nextMode = !registerMode;
                  setRegisterMode(nextMode);
                  setError('');
                  if (!nextMode) {
                    setAuthEmail(DEFAULT_PORTAL_CREDENTIALS.INVESTIGATOR.email);
                    setAuthPassword(DEFAULT_PORTAL_CREDENTIALS.INVESTIGATOR.password);
                  } else {
                    setAuthEmail('');
                    setAuthPassword('');
                  }
                }}
              >
                {registerMode ? 'Already have access? Sign in' : 'Need an investigator account? Register'}
              </button>
            )}
            <div className="auth-foot">
              <ShieldCheck size={13} /> BCSE302P DBMS Project · Divyank Seervi (24BCE0793) · Slot L25+L26
            </div>
          </motion.section>
        </div>
      </div>
    );
  }

  if (role === 'ADMIN') {
    return <AdministratorDashboard token={token} email={email} onLogout={() => void logout()} onBackup={() => void triggerAdminBackup()} />;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><span className="brand-icon"><Cpu size={20} /></span><div><strong>LAZARUS<span>−</span>X</strong><small>INVESTIGATOR CONSOLE</small></div></div>
        <div className="topbar-right">
          <div className="student-pill" title="Lab Assessment Identity (Instruction 7)">
            <Award size={13} />
            <span>Divyank Seervi (24BCE0793)</span>
            <span className="slot-tag">L25+L26</span>
          </div>
          <div className="system-version-pill" title="LAZARUS-X Platform">
            <ShieldCheck size={13} />
            <span>LAZARUS-X</span>
            <span className="slot-tag">v2.4</span>
          </div>
          <div className="system-pill"><span className="status-light" /> ENGINE ONLINE</div>
          <button
            type="button"
            className="secondary-button topbar-nav-btn"
            onClick={() => setAuditLogsModalOpen(true)}
            title="Inspect relational database audit trail and system actions"
          >
            <ClipboardCheck size={14} /> Audit Trail
          </button>
          {role === 'ADMIN' && (
            <button
              type="button"
              className="secondary-button topbar-nav-btn admin-backup-btn"
              onClick={() => void triggerAdminBackup()}
              disabled={backupInProgress}
              title="Generate native database backup file"
            >
              <Database size={14} /> {backupInProgress ? 'Backing up…' : 'Backup DB'}
            </button>
          )}
          <div className="user-pill"><span className="avatar">{email.slice(0, 1).toUpperCase()}</span><span>{email}</span><span className="role-tag">{role}</span></div>
          <button className="icon-button" aria-label="Log out" title="Log out" onClick={logout}><LogOut size={17} /></button>
        </div>
      </header>

      <main className="workspace">
        <aside className="sidebar">
          <div className="sidebar-head"><div><span className="eyebrow">WORKSPACE</span><h2>Case files</h2></div><button className="square-button" onClick={() => setSchemaStudioOpen(true)} disabled={loading} aria-label="Create new case" title="Create new case"><Plus size={18} /></button></div>
          <button className="new-case-button" onClick={() => setSchemaStudioOpen(true)} disabled={loading}><Plus size={15} /> New reconstruction</button>

          {/* Search Bar */}
          <div className="case-search-wrap">
            <Search size={13} className="case-search-icon" />
            <input
              type="text"
              placeholder="Search case name or ID..."
              value={caseSearch}
              onChange={event => {
                const nextSearch = event.target.value;
                setCaseSearch(nextSearch);
                setCasePage(1);
                if (token) void loadCases(token, nextSearch, caseStatusFilter, 1);
              }}
              className="case-search-input"
              aria-label="Search case files"
            />
            {caseSearch && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => {
                  setCaseSearch('');
                  setCasePage(1);
                  if (token) void loadCases(token, '', caseStatusFilter, 1);
                }}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Status Filter Pills */}
          <div className="case-filter-pills" role="tablist" aria-label="Filter cases by status">
            {(['ALL', 'ACTIVE', 'SEALED'] as const).map(filter => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={caseStatusFilter === filter}
                className={`filter-pill ${caseStatusFilter === filter ? 'active' : ''}`}
                onClick={() => {
                  setCaseStatusFilter(filter);
                  setCasePage(1);
                  if (token) void loadCases(token, caseSearch, filter, 1);
                }}
              >
                {filter === 'ALL' ? 'All' : filter === 'ACTIVE' ? 'Active' : 'Sealed'}
              </button>
            ))}
          </div>

          <div className="case-list custom-scrollbar">
            {cases.map((item, index) => (
              <button key={item.id} onClick={() => void openCase(item.id)} className={`case-item ${caseId === item.id ? 'selected' : ''}`}>
                <span className="case-symbol"><Database size={16} /></span>
                <span className="case-copy">
                  <div className="case-title-row">
                    <strong>{item.name || `Case ${index + 1}`}</strong>
                    <span className={`status-badge status-${(item.status || 'ACTIVE').toLowerCase()}`}>
                      {item.status || 'ACTIVE'}
                    </span>
                  </div>
                  <small>{item.provenanceSequence} ledger events · {new Date(item.updatedAt).toLocaleDateString()}</small>
                </span>
                <span className="case-chevron">›</span>
              </button>
            ))}
            {cases.length === 0 && (
              <div className="empty-cases">
                <Boxes size={21} />
                <span>{caseSearch.trim() || caseStatusFilter !== 'ALL' ? 'No cases found' : 'No cases yet'}</span>
                <small>{caseSearch.trim() || caseStatusFilter !== 'ALL' ? 'No cases match your filter criteria.' : 'Create a case to start collecting evidence.'}</small>
              </div>
            )}
          </div>

          {/* Pagination Controls */}
          {caseTotalPages > 1 && (
            <div className="case-pagination">
              <button
                type="button"
                className="pagination-btn"
                disabled={casePage <= 1 || loading}
                onClick={() => {
                  const nextP = casePage - 1;
                  setCasePage(nextP);
                  if (token) void loadCases(token, caseSearch, caseStatusFilter, nextP);
                }}
                aria-label="Previous page"
              >
                ‹ Prev
              </button>
              <span className="pagination-info">
                {casePage} / {caseTotalPages} ({caseTotal})
              </span>
              <button
                type="button"
                className="pagination-btn"
                disabled={casePage >= caseTotalPages || loading}
                onClick={() => {
                  const nextP = casePage + 1;
                  setCasePage(nextP);
                  if (token) void loadCases(token, caseSearch, caseStatusFilter, nextP);
                }}
                aria-label="Next page"
              >
                Next ›
              </button>
            </div>
          )}

          <div className="sidebar-footer"><Shield size={15} /><span>Evidence is scoped to its case owner.</span></div>
        </aside>

        <CaseViewErrorBoundary key={caseId ?? 'no-case'} onReset={resetCase}>
        <section className="main-column">
          <div className="page-heading">
            <div>
              <div className="eyebrow">RECONSTRUCTION WORKSPACE <span className="eyebrow-line" /></div>
              {caseId ? (
                isEditingCaseName ? (
                  <form onSubmit={handleRenameCase} className="rename-case-form">
                    <input
                      type="text"
                      value={caseNameDraft}
                      onChange={e => setCaseNameDraft(e.target.value)}
                      className="rename-input"
                      autoFocus
                      maxLength={100}
                    />
                    <button type="submit" className="rename-save-btn">Save</button>
                    <button type="button" className="rename-cancel-btn" onClick={() => { setIsEditingCaseName(false); setCaseNameDraft(caseName); }}>Cancel</button>
                  </form>
                ) : (
                  <div className="case-title-heading">
                    <h1>{caseName || `Case ${caseId.slice(0, 8)}`}</h1>
                    {caseStatus !== 'SEALED' && (
                      <button
                        type="button"
                        className="rename-trigger-btn"
                        onClick={() => setIsEditingCaseName(true)}
                        title="Rename case"
                        aria-label="Rename case"
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                  </div>
                )
              ) : (
                <h1>Reconstruction overview</h1>
              )}
              <p>{caseId ? `UUID: ${caseId}` : 'Select a case or create a new reconstruction to begin.'}</p>
            </div>
            <div className="heading-actions">
              {caseId && (
                <>
                  <button
                    type="button"
                    className="secondary-button dossier-btn"
                    aria-label="Forensic dossier — Export reconstruction report"
                    onClick={() => setReportModalOpen(true)}
                    title="Export an investigation report with ledger and candidate summaries"
                  >
                    <Award size={14} className="text-cyan" /> <span aria-label="Forensic dossier">Export reconstruction report</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-button delete-case-btn"
                    onClick={() => void handleDeleteCase()}
                    title="Delete case and purge all associated evidence"
                    disabled={loading || (caseStatus === 'SEALED' && role !== 'ADMIN')}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </>
              )}
              {caseId && (caseStatus === 'SEALED' ? (
                <span className="sealed-status-badge" aria-label="Case is sealed"><Lock size={13} /> SEALED &amp; FROZEN</span>
              ) : (
                <button className="secondary-button seal-button" onClick={() => void sealCase()} disabled={!caseId || loading || caseStatus === "SEALED"} title="Seal the case in this application and block further evidence intake"><Lock size={13} /> Seal case</button>
              ))}
              <button className="secondary-button" onClick={() => caseId && token && void openCase(caseId)} disabled={!caseId || loading}>
                <RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh
              </button>
            </div>
          </div>
          {(error || notice) && <div className={`banner ${error ? 'banner-error' : 'banner-success'}`} role={error ? 'alert' : 'status'}>{error ? <CircleAlert size={16} /> : <BadgeCheck size={16} />}{error || notice}<button onClick={() => { setError(''); setNotice(''); }} aria-label="Dismiss message">×</button></div>}

          <nav className="reconstruction-pipeline" aria-label="Reconstruction workflow">
            <div className={`pipeline-step ${caseSchema ? 'pipeline-done' : 'pipeline-current'}`}><span>01</span><div><strong>Define schema</strong><small>{caseSchema ? `${caseSchema.tables.length} relations · ${caseSchema.constraints.filter(c => c.type === 'FOREIGN_KEY').length} FK links` : 'Choose relations and constraints'}</small></div></div>
            <ArrowRight size={14}/>
            <div className={`pipeline-step ${auditTotal > 0 ? 'pipeline-done' : caseSchema ? 'pipeline-current' : ''}`}><span>02</span><div><strong>Collect fragments</strong><small>{auditTotal} provenance events committed</small></div></div>
            <ArrowRight size={14}/>
            <div className={`pipeline-step ${auditTotal > 0 ? 'pipeline-current' : ''}`}><span>03</span><div><strong>Compare hypotheses</strong><small>{entropy.candidateCount} surviving state(s)</small></div></div>
            <ArrowRight size={14}/>
            <div className={`pipeline-step ${auditValid ? 'pipeline-done' : ''}`}><span>04</span><div><strong>Verify custody</strong><small>{auditValid ? 'Ledger verified' : 'Inspect provenance when ready'}</small></div></div>
          </nav>

          <div className="metric-grid primary-metrics">
            <article className="metric-card"><span className="metric-icon teal"><GitBranch size={17} /></span><span className="metric-label">SURVIVING INTERPRETATIONS</span><strong>{entropy.candidateCount.toLocaleString()}</strong><small>Materialized candidate states under search limits</small></article>
            <article className="metric-card"><span className="metric-icon violet"><Activity size={17} /></span><span className="metric-label">CANDIDATE ENTROPY</span><strong>{entropy.after.toFixed(3)} <em>bits</em></strong><small>Derived from heuristic candidate weights; not calibrated truth probability</small></article>
            <article className="metric-card"><span className="metric-icon amber"><Fingerprint size={17} /></span><span className="metric-label">PROVENANCE EVENTS</span><strong>{auditTotal.toLocaleString()}</strong><small className={auditValid === false ? 'text-danger' : ''}>{auditValid === false ? 'Integrity check needs review' : auditValid ? 'Server and page commitment verified' : 'Awaiting ledger check'}</small></article>
          </div>
          <details className="secondary-metrics">
            <summary><TimerReset size={14} /> More metrics <span>Ambiguity change</span><ChevronDown size={14} /></summary>
            <div className="metric-grid">
              <article className="metric-card"><span className="metric-icon blue"><TimerReset size={17} /></span><span className="metric-label">AMBIGUITY CHANGE</span><strong>{entropy.reduction === undefined ? '—' : `${entropy.reduction >= 0 ? '−' : '+'}${Math.abs(entropy.reduction).toFixed(3)}`} <em>bits</em></strong><small>{entropy.reduction === undefined ? 'Submit evidence to measure change' : `${entropy.reduction >= 0 ? '−' : '+'}${Math.abs(entropy.reduction).toFixed(3)} bits after latest evidence · ${entropy.reduction >= 0 ? 'Entropy reduced' : 'New evidence introduced ambiguity'}`}</small></article>
            </div>
          </details>

          <section className="panel evidence-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <span className="panel-icon"><Database size={17} /></span>
                <div>
                  <h2>Evidence intake · Evidence fragments</h2>
                  <p>Record one source observation at a time. Conflicting observations remain visible as competing hypotheses.</p>
                </div>
              </div>
              <div className="panel-heading-meta evidence-actions">
                <span className="live-tag"><i /> LIVE INGESTION</span>
                <button type="button" className="secondary-button csv-action" onClick={downloadEvidenceCsvTemplate} disabled={!caseSchema || loading}><FileSpreadsheet size={14}/> CSV template</button>
                <button type="button" className="secondary-button csv-action" onClick={() => csvInputRef.current?.click()} disabled={!caseSchema || !caseId || loading || caseStatus === 'SEALED'}><Upload size={14}/> Import CSV</button>
                <input ref={csvInputRef} type="file" accept=".csv,text/csv" hidden onChange={event => void handleEvidenceCsv(event)} aria-label="Import evidence CSV" />
              </div>
            </div>

            {caseId && caseSchema && (() => {
              const divyank24BCE0793_currentScenario = divyank24BCE0793_scenarioList.find(s => s.id === divyank24BCE0793_selectedScenarioId);
              const isSyntheticWalkthroughSelected = divyank24BCE0793_selectedScenarioId === 'synthetic-walkthrough';
              const isScenarioDisabled = Boolean(
                !caseId || loading || caseStatus === 'SEALED' || auditTotal > 0 ||
                (!isSyntheticWalkthroughSelected && divyank24BCE0793_currentScenario && caseSchema.preset !== divyank24BCE0793_currentScenario.preset) ||
                (isSyntheticWalkthroughSelected && !hasWalkthroughConflictTarget(caseSchema))
              );
              let scenarioTooltip = '';
              if (!caseId) {
                scenarioTooltip = 'Select a case to load example scenarios';
              } else if (caseStatus === 'SEALED') {
                scenarioTooltip = 'Case is sealed; new evidence cannot be loaded';
              } else if (auditTotal > 0) {
                scenarioTooltip = 'Evidence ledger must be empty to load example scenarios. Create a fresh case.';
              } else if (!isSyntheticWalkthroughSelected && divyank24BCE0793_currentScenario && caseSchema.preset !== divyank24BCE0793_currentScenario.preset) {
                scenarioTooltip = `Create a case using the '${divyank24BCE0793_currentScenario.preset}' preset to load this scenario`;
              } else if (isSyntheticWalkthroughSelected && !hasWalkthroughConflictTarget(caseSchema)) {
                scenarioTooltip = 'The synthetic ambiguity walkthrough needs at least one non-unique field. Add a non-unique field in Schema Studio and create a new case.';
              } else {
                scenarioTooltip = isSyntheticWalkthroughSelected
                  ? 'Load synthetic guided walkthrough'
                  : `Load demo fragments for ${divyank24BCE0793_currentScenario?.title ?? ''}`;
              }

              return (
                <div className="example-scenarios-panel walkthrough-strip" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <div className="walkthrough-copy">
                      <span className="walkthrough-kicker"><Sparkles size={13}/> ONE-CLICK EXAMPLE SCENARIOS</span>
                      <strong>Fill an empty case with ready-made demo scenarios</strong>
                      <small>Select a pre-configured scenario to observe constraint resolution, branching, and recommendations without manual typing.</small>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <select
                        id="exampleScenarioSelect"
                        aria-label="Select example scenario"
                        value={divyank24BCE0793_selectedScenarioId}
                        onChange={e => setDivyank24BCE0793_selectedScenarioId(e.target.value)}
                        className="secondary-button"
                        style={{ padding: '6px 12px', fontSize: '12px', background: 'var(--panel-bg, rgba(20,24,33,0.9))', color: 'var(--text, #e5e7eb)' }}
                      >
                        <optgroup label="Incident Response Preset">
                          <option value="ir-clean">A) Clean incident (no conflicts)</option>
                          <option value="ir-out-of-order">B) Out-of-order evidence (parent arrives late)</option>
                          <option value="ir-name-conflict">C) Conflicting name from a weaker source</option>
                          <option value="ir-unique-clash">D) Duplicate id (fatal violation)</option>
                        </optgroup>
                        <optgroup label="Workforce & Orders Preset">
                          <option value="wf-clean">E) Workforce and orders (clean)</option>
                          <option value="wf-missing-parent">F) Order points to unknown employee</option>
                          <option value="wf-amount-conflict">G) Two amounts for one order</option>
                        </optgroup>
                        <optgroup label="General Walkthrough">
                          <option value="synthetic-walkthrough">Guided Walkthrough (Dynamic Conflict)</option>
                        </optgroup>
                      </select>
                      <button
                        type="button"
                        aria-label={`Load scenario ${isSyntheticWalkthroughSelected ? 'Synthetic walkthrough' : (divyank24BCE0793_currentScenario?.title ?? '')}`}
                        className="secondary-button walkthrough-button"
                        onClick={() => {
                          if (isSyntheticWalkthroughSelected) {
                            void loadSyntheticWalkthrough();
                          } else {
                            void divyank24BCE0793_loadExampleScenario(divyank24BCE0793_selectedScenarioId);
                          }
                        }}
                        disabled={isScenarioDisabled}
                        title={scenarioTooltip}
                      >
                        <Zap size={14}/> {loading ? 'Loading…' : 'Load scenario'}
                      </button>
                    </div>
                  </div>
                  {divyank24BCE0793_currentScenario && !isSyntheticWalkthroughSelected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--muted, #9aa3b2)', flexWrap: 'wrap', gap: '6px' }}>
                        <span><strong>Goal:</strong> {divyank24BCE0793_currentScenario.learningGoal}</span>
                        <span className="role-tag" style={{ textTransform: 'uppercase' }}>Preset: {divyank24BCE0793_currentScenario.preset}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--muted, #9aa3b2)' }}>
                        {divyank24BCE0793_currentScenario.description}
                      </div>
                      <div className="scenario-expected-note" style={{ fontSize: '11px', color: '#a78bfa' }}>
                        <strong>Expected:</strong> {divyank24BCE0793_currentScenario.expected.note}
                      </div>
                    </div>
                  )}
                  {isSyntheticWalkthroughSelected && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ fontSize: '11px', color: 'var(--muted, #9aa3b2)' }}>
                        Dynamically constructs sample evidence matching this case's declared relations, plus one intentional non-unique conflict.
                      </div>
                      <div className="scenario-expected-note" style={{ fontSize: '11px', color: '#a78bfa' }}>
                        <strong>Expected:</strong> Demonstrates branch generation and Shannon information gain targeting the conflicting field.
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
            {caseStatus === 'SEALED' && <div className="sealed-alert" role="status"><Lock size={14} /> Case is sealed in the application. Evidence intake through this interface is closed; direct database access is outside this control.</div>}
            <form onSubmit={event => void submitEvidence(event)} className="evidence-form">
              <div className="form-control"><label htmlFor="evTable">Relation</label><select id="evTable" value={table} onChange={event => { const nextTable = event.target.value; setTable(nextTable); setField(caseSchema?.tableDefinitions?.find(definition => definition.name === nextTable)?.columns?.[0]?.name ?? 'name'); setFormErrors(current => ({ ...current, field: undefined })); }}>{TABLES.map(name => <option key={name}>{name}</option>)}</select></div>
              <div className="form-control record-control"><label htmlFor="evRecord">Record locator</label><input id="evRecord" type="number" min="0" step="1" value={recordId} aria-invalid={!!displayedRecordIdError} aria-describedby={displayedRecordIdError ? 'evRecord-error' : undefined} onChange={event => { setRecordId(event.target.value); setFormErrors(current => ({ ...current, recordId: undefined })); }} required />{displayedRecordIdError && <span id="evRecord-error" className="field-error">{displayedRecordIdError}</span>}</div>
              <div className="form-control"><label htmlFor="evField">Attribute</label>{selectedTableDefinition && selectedTableDefinition.columns.length > 0 ? <select id="evField" value={field} onChange={event => { setField(event.target.value); setFormErrors(current => ({ ...current, field: undefined })); }} aria-invalid={!!displayedFieldError} required><option value="_recordId" hidden>Internal record identity</option>{selectedTableDefinition.columns.map(column => <option key={column.name} value={column.name}>{column.name} · {column.type}{column.required ? ' · required' : ''}{column.unique ? ' · unique' : ''}</option>)}</select> : <input id="evField" value={field} onChange={event => { setField(event.target.value); setFormErrors(current => ({ ...current, field: undefined })); }} placeholder="e.g. name" maxLength={256} aria-invalid={!!displayedFieldError} aria-describedby={displayedFieldError ? 'evField-error' : undefined} required />}{displayedFieldError && <span id="evField-error" className="field-error">{displayedFieldError}</span>}</div>
              <div className="form-control"><label htmlFor="evValueFormat">Value format</label><select id="evValueFormat" value={valueFormat} onChange={event => { setValueFormat(event.target.value as 'text' | 'json'); setFormErrors(current => ({ ...current, value: undefined })); }}><option value="text">Text</option><option value="json">JSON scalar</option></select></div>
              <div className="form-control value-control"><label htmlFor="evValue">Observed value</label><input id="evValue" value={value} onChange={event => { setValue(event.target.value); setFormErrors(current => ({ ...current, value: undefined })); }} placeholder={valueFormat === 'json' ? 'e.g. "Ada", 42, true, null' : 'Enter a fragment'} maxLength={8192} aria-invalid={!!displayedValueError} aria-describedby={displayedValueError ? 'evValue-error' : undefined} required />{displayedValueError && <span id="evValue-error" className="field-error">{displayedValueError}</span>}</div>
              <div className="form-control confidence-control"><label htmlFor="evConfidence" title="Investigator-assessed heuristic, not a calibrated probability">Source confidence · heuristic</label><input id="evConfidence" type="number" min="0.01" max="1" step="0.01" value={sourceConfidence} aria-invalid={!!displayedConfidenceError} aria-describedby={displayedConfidenceError ? 'evConfidence-error' : 'evConfidence-hint'} onChange={event => { setSourceConfidence(Number(event.target.value)); setFormErrors(current => ({ ...current, confidence: undefined })); }} />{displayedConfidenceError ? <span id="evConfidence-error" className="field-error">{displayedConfidenceError}</span> : <span id="evConfidence-hint" className="field-hint">0 &lt; confidence ≤ 1</span>}</div>
              <div className="form-control source-reference-control"><label htmlFor="evSourceRef">Source reference · optional</label><input id="evSourceRef" value={sourceRef} onChange={event => { setSourceRef(event.target.value); setFormErrors(current => ({ ...current, sourceRef: undefined })); }} placeholder="e.g. manifest-02 / exhibit A" maxLength={256} aria-invalid={!!formErrors.sourceRef} aria-describedby={formErrors.sourceRef ? 'evSourceRef-error' : undefined} />{formErrors.sourceRef ? <span id="evSourceRef-error" className="field-error">{formErrors.sourceRef}</span> : <span className="field-hint">A short exhibit/manifest label, not a local file path.</span>}</div>
              <div className="form-control source-hash-control"><label htmlFor="evSourceSha256">Source SHA-256 · optional</label><input id="evSourceSha256" value={sourceSha256} onChange={event => { setSourceSha256(event.target.value); setFormErrors(current => ({ ...current, sourceSha256: undefined })); }} placeholder="64 hex characters from the manifest" maxLength={64} spellCheck={false} aria-invalid={!!formErrors.sourceSha256} aria-describedby={formErrors.sourceSha256 ? 'evSourceSha256-error' : undefined} />{formErrors.sourceSha256 ? <span id="evSourceSha256-error" className="field-error">{formErrors.sourceSha256}</span> : <span className="field-hint">Records a digest from a separate manifest; this field does not re-hash the source file.</span>}</div>
              <button className="primary-button commit-button" type="submit" disabled={!caseId || loading || caseStatus === 'SEALED'}><Plus size={16} /> Commit fragment</button>
            </form>
            <div className="evidence-footnote"><ShieldCheck size={13} /> Each accepted fragment is written with its provenance event in one database transaction.</div>
          </section>

          <details className="collapsible-panel">
            <summary><GitBranch size={15} /> Schema and relationship graph <span>Optional visual analysis</span><ChevronDown size={15} /></summary>
          <section className="panel graph-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <span className="panel-icon violet-icon"><GitBranch size={17} /></span>
                <div>
                  <h2>{graphViewMode === 'schema' ? 'Declared schema & constraints' : 'Candidate relational hypothesis graph'}</h2>
                  <p>{graphViewMode === 'schema' ? 'The exact case schema used by the solver; fields and links are not hard-coded to a demo domain.' : 'Edges are drawn only when an observed source value matches a target value under a declared foreign key.'}</p>
                </div>
              </div>
              <div className="graph-heading-controls">
                <div className="view-toggle">
                  <button type="button" className={`view-toggle-btn ${graphViewMode === 'row' ? 'active' : ''}`} onClick={() => setGraphViewMode('row')}>Candidate view</button>
                  <button type="button" className={`view-toggle-btn ${graphViewMode === 'schema' ? 'active' : ''}`} onClick={() => setGraphViewMode('schema')}>Schema DAG</button>
                </div>
                <span className="candidate-count">{candidates.length} ranked candidate{candidates.length === 1 ? '' : 's'}</span>
              </div>
            </div>
            {graphViewMode === 'schema' ? (
              <SchemaGraph tables={[...TABLES]} schema={caseSchema} engineData={engineState?.data} selectedTable={table} onSelectTable={name => setTable(name)} />
            ) : (
              <>
                <CandidateMap candidates={candidates} total={entropy.candidateCount} selectedId={selectedCandidateId} onSelect={id => void openCandidate(id)} />
                <RowGraph state={engineState} tables={TABLES} schema={caseSchema} />
              </>
            )}
            <div className="candidate-strip">
              {candidates.map(candidate => (
                <button key={candidate.id} className={`candidate-chip ${candidate.id === selectedCandidateId ? 'candidate-selected' : ''}`} onClick={() => void openCandidate(candidate.id)} disabled={loading} aria-pressed={candidate.id === selectedCandidateId}>
                  <span className="candidate-rank">{String(candidate.rank).padStart(2, '0')}</span><span className="candidate-info"><strong>{candidate.id === selectedCandidateId ? 'Viewed interpretation' : candidate.isSelected ? 'Top-ranked interpretation' : `Candidate ${candidate.rank}`}</strong><small>{candidate.fatalViolations} fatal · {candidate.resolvableViolations} resolvable · fuzzy {candidate.fuzzyPenalty.toFixed(2)} · source penalty {(candidate.sourceReliabilityPenalty ?? 0).toFixed(2)}</small></span><span className="candidate-score">{candidate.score.toFixed(4)}</span>
                </button>
              ))}
              {engineState && candidates.length === 0 && <span className="muted small">Candidate summary will appear after the first materialization.</span>}
            </div>
          </section>
          </details>

          <section className="panel selected-state-panel">
            <div className="panel-heading">
              <div className="panel-title">
                <span className="panel-icon amber-icon"><Boxes size={17} /></span>
                <div>
                  <h2>{diffViewOpen ? 'Candidate Field Inspection' : 'Selected reconstruction'}</h2>
                  <p>{diffViewOpen ? 'Highlights conflicts surfaced by ranked probes; unmarked fields are not guaranteed to agree across every candidate.' : 'Observed fields in the currently selected candidate.'}</p>
                </div>
              </div>
              <div className="state-panel-actions">
                <div className="table-search-box">
                  <Search size={12} />
                  <input
                    type="text"
                    placeholder="Filter records..."
                    value={tableFilterQuery}
                    onChange={e => setTableFilterQuery(e.target.value)}
                    className="table-filter-input"
                    aria-label="Filter records"
                  />
                  {tableFilterQuery && (
                    <button type="button" onClick={() => setTableFilterQuery('')} className="clear-btn" aria-label="Clear table filter">×</button>
                  )}
                </div>
                <button
                  type="button"
                  className={`secondary-button diff-toggle-btn ${diffViewOpen ? 'active' : ''}`}
                  onClick={() => setDiffViewOpen(!diffViewOpen)}
                >
                  <Split size={13} /> {diffViewOpen ? 'Record Cards' : 'Conflict Matrix'}
                </button>
                {engineState && <span className="state-id">{engineState.id}</span>}
              </div>
            </div>
            {engineState ? (
              diffViewOpen ? (
                <CandidateDiffMatrix
                  tables={TABLES}
                  selectedTable={table}
                  onSelectTable={name => setTable(name)}
                  currentData={engineState.data}
                  disputedFields={rankedRecommendations}
                  candidateCount={candidates.length}
                  onSeedEvidence={(tbl, rec, fld) => {
                    setTable(tbl);
                    setRecordId(String(rec));
                    setField(fld);
                    document.getElementById('evValue')?.focus();
                  }}
                />
              ) : (
                <div className="table-grid">
                  {TABLES.map(relation => {
                    const allRows = engineState.data?.[relation] ?? [];
                    const rows = tableFilterQuery.trim()
                      ? allRows.filter(r => Object.entries(r).some(([k, v]) => String(v).toLowerCase().includes(tableFilterQuery.toLowerCase()) || k.toLowerCase().includes(tableFilterQuery.toLowerCase())))
                      : allRows;
                    return (
                      <article className="relation-card" key={relation}>
                        <div className="relation-title">
                          <span>{relation}</span>
                          <div className="relation-title-right">
                            <span className="row-count-badge">{rows.length}{tableFilterQuery ? ` / ${allRows.length}` : ''} rows</span>
                            {rows.length > 0 && (
                              <div className="table-export-group">
                                <button
                                  type="button"
                                  className="table-export-btn"
                                  onClick={() => exportTableAsCSV(relation, rows)}
                                  title={`Export ${relation} records as CSV`}
                                >
                                  CSV
                                </button>
                                <button
                                  type="button"
                                  className="table-export-btn"
                                  onClick={() => exportTableAsJSON(relation, rows)}
                                  title={`Export ${relation} records as JSON`}
                                >
                                  JSON
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        {rows.length === 0 ? (
                          <p className="empty-relation">{allRows.length > 0 ? 'No matching rows found' : 'No observed rows'}</p>
                        ) : (
                          rows.map((row, index) => (
                            <div className="record-row" key={`${relation}-${String(row._recordId ?? index)}`}>
                              <span className="record-index">{String(row._recordId ?? index + 1).padStart(2, '0')}</span>
                              <code>
                                {Object.entries(row)
                                  .filter(([key]) => key !== '_recordId')
                                  .map(([key, item]) => `${key}: ${String(item)}`)
                                  .join(' · ') || 'No observed attributes'}
                              </code>
                            </div>
                          ))
                        )}
                      </article>
                    );
                  })}
                </div>
              )
            ) : <div className="empty-case-state"><Sparkles size={19} />Start with a new case or select an existing case file.</div>}
          </section>
        </section>
        </CaseViewErrorBoundary>

        <aside className="right-column">
          <section className="panel intel-panel">
            <div className="tab-bar"><button className={auditTab === 'guidance' ? 'active' : ''} onClick={() => setAuditTab('guidance')}><Sparkles size={14} /> Next evidence</button><button className={auditTab === 'ledger' ? 'active' : ''} onClick={() => setAuditTab('ledger')}><Fingerprint size={14} /> Provenance</button></div>
            <AnimatePresence mode="wait">
              {auditTab === 'guidance' ? <motion.div key="guidance" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="guidance-content">
                <div className="guidance-heading"><span className="panel-icon violet-icon"><Activity size={17} /></span><div><h2>Next useful observation</h2><p>Ranked by expected ambiguity reduction</p></div></div>
                {branchingDiag && (
                  <div className="branching-diagnostics-badge">
                    <span>DISPUTED ATTRIBUTES: <b>{branchingDiag.disputedAttributesCount}</b></span>
                    <span>PRIOR ENTROPY: <b>{branchingDiag.priorEntropyBits.toFixed(3)} bits</b></span>
                  </div>
                )}
                {recommendation ? <div className="recommendation-card"><div className="rec-topline"><span>NEXT OBSERVATION TO COLLECT</span><span className="gain-badge">+{recommendation.expectedInformationGain.toFixed(3)} bits</span></div><div className="rec-target"><span>{recommendation.table}</span><strong>Record {recommendation.recordId}</strong><em>{recommendation.field}</em></div>
                {recommendation.candidateValues && recommendation.candidateValues.length > 0 && (
                  <div className="candidate-values-preview">
                    <span className="preview-label">CANDIDATE VALUES:</span>
                    <div className="preview-chips">
                      {recommendation.candidateValues.map((cv, idx) => (
                        <span key={idx} className="preview-chip" title={`${cv.candidateCount} surviving interpretation(s)`}>
                          <code>{String(cv.value)}</code>
                          <small title="Normalized heuristic candidate weight—not a calibrated probability">{(cv.probability * 100).toFixed(0)}%*</small>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                <p>{recommendation.explanation || 'Collect an independent observation for this disputed field to distinguish surviving interpretations.'}</p><button className="secondary-button full-width" onClick={() => { setTable(recommendation.table); setRecordId(String(recommendation.recordId)); setField(recommendation.field); document.getElementById('evValue')?.focus(); }}><ArrowDownToLine size={15} /> Acquire this evidence</button></div> : <div className="guidance-empty"><Sparkles size={25} /><strong>Model is waiting for a useful query</strong><span>{engineState ? 'One surviving interpretation has no disputed field to query.' : 'Open a case and submit fragments to surface the next best evidence.'}</span></div>}
                {rankedRecommendations.length > 1 && (
                  <div className="ranked-probes">
                    <span className="ranked-probes-label">OTHER DISCRIMINATING OBSERVATIONS</span>
                    <div className="ranked-probes-list">
                      {rankedRecommendations.slice(1, 4).map((alt, idx) => (
                        <div key={idx} className="ranked-probe-item">
                          <div className="probe-info" title={alt.explanation}>
                            <b>{alt.table}[{alt.recordId}].{alt.field}</b>
                            <span>+{alt.expectedInformationGain.toFixed(3)} bits</span>
                          </div>
                          <button
                            type="button"
                            className="probe-select-btn"
                            onClick={() => {
                              setTable(alt.table);
                              setRecordId(String(alt.recordId));
                              setField(alt.field);
                              document.getElementById('evValue')?.focus();
                            }}
                          >
                            Target
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="metric-explainer"><ShieldCheck size={14} /><span>Information gain is derived from heuristic candidate penalty weights across bounded interpretations; it is not a calibrated Bayesian posterior probability.</span></div>
              </motion.div> : <motion.div key="ledger" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="ledger-content">
                <div className="ledger-heading"><div><span className="eyebrow">CHAIN OF CUSTODY</span><h2>Provenance ledger</h2></div><div className="ledger-heading-actions"><button className="secondary-button claim-toggle" type="button" aria-expanded={claimVerifierOpen} aria-controls="claim-verifier-panel" onClick={() => { setClaimVerifierOpen(open => !open); setClaimVerification(null); }}><ShieldCheck size={14} /> Verify disclosed claim</button><button className="secondary-button claim-toggle" type="button" onClick={() => void exportOfflineAuditBundle()} disabled={!caseId || bundleExporting}>{bundleExporting ? <Loader2 size={13} className="spin" /> : <ArrowDownToLine size={13} />}{bundleExporting ? ' Exporting…' : ' Offline bundle'}</button><button className="icon-button subtle-icon" aria-label="Export loaded public commitments" title="Export loaded commitment envelopes" onClick={exportAudit} disabled={!auditEntries.length}><ArrowDownToLine size={16} /></button></div></div>
                {claimVerifierOpen && <section className="claim-verifier" id="claim-verifier-panel" aria-label="Disclosed claim verifier">
                  <p>Paste the JSON returned by a case’s selective-claim endpoint. Verification runs locally in this browser.</p>
                  <label htmlFor="claim-verifier-json">Disclosure and envelope JSON</label>
                  <textarea id="claim-verifier-json" value={claimJson} maxLength={131072} spellCheck={false} onChange={event => { setClaimJson(event.target.value); setClaimVerification(null); }} placeholder={'{ "disclosure": { ... }, "envelope": { ... } }'} />
                  <button className="secondary-button full-width" type="button" onClick={() => void verifyClaimInput()} disabled={claimVerifying}>{claimVerifying ? <Loader2 size={14} className="spin" /> : <ShieldCheck size={14} />}{claimVerifying ? ' Verifying…' : ' Verify claim'}</button>
                  {claimVerification && <div className={`claim-verification-result claim-${claimVerification.kind}`} role="status" aria-live="polite">{claimVerification.message}</div>}
                </section>}
                <div className={`verification-banner ${auditValid === false ? 'verification-failed' : auditValid ? 'verification-passed' : ''}`}><span>{auditValid === false ? <CircleAlert size={15} /> : <ShieldCheck size={15} />}</span><div><strong>{auditValid === false ? 'Verification needs attention' : auditValid ? 'Chain verified' : 'Awaiting verification'}</strong><small>{auditValid ? `${auditTotal} events checked on server · page envelope checked in browser` : 'Select a case to inspect its evidence chain.'}</small></div></div>
                {auditHead && <div className="head-commitment"><span>PUBLIC ENVELOPE HEAD</span><code>{shortHash(auditHead)}</code><button onClick={() => void navigator.clipboard?.writeText(auditHead)} title="Copy public head hash"><ClipboardCheck size={13} /></button></div>}
                <div className="privacy-note bundle-warning">Offline bundles include up to 20 candidate snapshots with reconstructed field values. Store exported files as sensitive case data.</div>
                <TimelineScrubber entries={auditEntries} onInspectProof={seq => void exportInclusionProof(seq)} totalEvents={auditTotal} auditHead={auditHead} />
                {proofStatus && <div className={`claim-verification-result claim-${proofStatus.kind}`} role="status" aria-live="polite">{proofStatus.message}</div>}
                <div className="ledger-list custom-scrollbar">
                  {auditEntries.map(entry => <details className="ledger-entry" key={`${entry.sequence}-${entry.envelopeHash}`}><summary><span className={`event-mark ${entry.eventType === 'FUZZY_CORRECTION' ? 'event-fuzzy' : ''}`}>{entry.eventType === 'FUZZY_CORRECTION' ? '≈' : 'E'}</span><span className="ledger-event-copy"><strong>#{String(entry.sequence).padStart(5, '0')} · {entry.eventType === 'FUZZY_CORRECTION' ? 'Fuzzy correction' : 'Evidence accepted'}</strong><small>{new Date(entry.receivedAt).toLocaleString()}</small></span><ChevronDown size={14} className="entry-chevron" /></summary><div className="ledger-detail"><span>Payload commitment<code>{entry.payloadCommitment}</code></span><span>Envelope hash<code>{entry.envelopeHash}</code></span><span>Previous envelope<code>{entry.previousEnvelopeHash}</code></span><span>Actor commitment<code>{entry.actorCommitment}</code></span><button className="secondary-button proof-download" type="button" onClick={() => void exportInclusionProof(entry.sequence)} disabled={!caseId || loading}>Inspect path &amp; download verified proof</button>{proofInspection?.sequence === entry.sequence && (
                    <div className="proof-visualizer-wrapper">
                      <MerkleVisualizer proof={proofInspection} />
                      <section className="merkle-proof-inspector" aria-label={`Merkle proof path for event ${entry.sequence}`}>
                        <div className="proof-inspector-heading"><strong>Locally verified Merkle path</strong><span>{proofInspection.sequence} / {proofInspection.totalEvents} events</span></div>
                        <div className="proof-hash-row"><span>Leaf hash · LAZARUS-X:ENVELOPE-MERKLE:LEAF:V1</span><code>{proofInspection.leafHash}</code></div>
                        <ol className="merkle-path-list" aria-label={`Sibling hashes for event ${entry.sequence}`}>
                          {proofInspection.pathSteps.map(step => (
                            <li key={`${step.depth}-${step.siblingHash}`}>
                              <div><strong>Depth {step.depth}</strong><span>Sibling on the {step.siblingSide}{step.duplicateCurrentNode ? ' · duplicate-last node' : ''}</span></div>
                              <code>{step.siblingHash}</code>
                              <small>Combined node · {step.resultingNodeHash}</small>
                            </li>
                          ))}
                        </ol>
                        {proofInspection.pathSteps.length === 0 && <p className="privacy-note">This checkpoint contains one event, so the leaf is also the Merkle tree node.</p>}
                        <div className="proof-root-result">
                          <strong>Counted root · {proofInspection.checkpointVerified ? 'MATCH' : 'MISMATCH'}</strong>
                          <code>{proofInspection.countedRootHash}</code>
                          <span>Checkpoint root</span>
                          <code>{proofInspection.checkpointRootHash}</code>
                          <strong className="proof-manifest-match">Checkpoint manifest · {proofInspection.checkpointVerified ? 'VERIFIED' : 'UNVERIFIED'}</strong>
                          <span>Manifest digest</span>
                          <code>{proofInspection.checkpointDigest}</code>
                        </div>
                        <p className="privacy-note">The root binds the event count. This verifies inclusion against the supplied checkpoint; the checkpoint is not a signature or trusted timestamp.</p>
                      </section>
                    </div>
                  )}
                  <div className="privacy-note">Payload and direct actor/fragment identifiers are hidden behind event-scoped HMAC commitments. The envelope is not a zero-knowledge proof; an owner can disclose one event and its scoped salt for independent claim verification.</div></div></details>)}
                  {auditEntries.length === 0 && <div className="ledger-empty"><Fingerprint size={22} /><span>No ledger entries yet.</span></div>}
                </div>
                {auditNext !== null && <button className="secondary-button full-width load-more" onClick={() => void loadNextAuditPage()} disabled={loading}><ChevronDown size={15} /> Load next 50 events</button>}
                <p className="privacy-note ledger-note">Merkle proofs establish inclusion against the supplied checkpoint root. Retain the checkpoint digest separately to detect later rewrites; the digest is not a signature or external timestamp.</p>
                <p className="privacy-note ledger-note">{auditNote || 'Retain the public head outside the database for detection of later rewrites.'}</p>
              </motion.div>}
            </AnimatePresence>
          </section>

          <details className="collapsible-panel timeline-details">
            <summary><TimerReset size={15} /> Recent fragments <span>{timeline.length} from this session</span><ChevronDown size={15} /></summary>
            <section className="panel timeline-panel"><div className="panel-heading compact-heading"><div className="panel-title"><span className="panel-icon teal-icon"><TimerReset size={16} /></span><div><h2>Recent fragments</h2><p>This session · latest 50</p></div></div><span className="timeline-count">{timeline.length}</span></div><div className="timeline-list custom-scrollbar">{timeline.map(item => <motion.div key={item.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="timeline-item"><span className="timeline-dot" /><div><div className="timeline-value"><b>{item.table}[{item.recordId}].{item.field}</b><span>{String(item.value)}</span></div><small>{new Date(item.at).toLocaleTimeString()}{item.sourceRef ? ` · Source: ${item.sourceRef}` : ''}{item.sourceSha256 ? ` · SHA-256: ${item.sourceSha256.slice(0, 12)}…` : ''}</small></div></motion.div>)}{timeline.length === 0 && <div className="timeline-empty">Accepted fragments from this session appear here.</div>}</div></section>
          </details>

          <div className="system-foot"><span className="status-light" /> BOUNDED SEARCH ACTIVE <span className="foot-separator">·</span> MAX 10K CANDIDATES</div>
        </aside>
      <SchemaStudio open={schemaStudioOpen} busy={loading} onClose={() => setSchemaStudioOpen(false)} onCreate={createCase} />
      <ForensicReportModal
        isOpen={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        caseId={caseId || ''}
        caseStatus={caseStatus}
        auditHead={auditHead}
        totalEvents={auditTotal}
        auditEntries={auditEntries}
        entropyBits={entropy.after}
        candidateCount={candidates.length}
        engineData={engineState?.data}
      />
      <AuditLogsModal
        isOpen={auditLogsModalOpen}
        onClose={() => setAuditLogsModalOpen(false)}
        currentUser={{ id: email, email, role }}
        apiBase={API_BASE}
        token={token}
      />
      </main>
    </div>
  );
}

export default App;
