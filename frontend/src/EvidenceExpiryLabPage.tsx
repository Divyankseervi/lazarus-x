import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, Archive, CircleAlert, Clock3, FileClock, RotateCcw, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import type { CaseSchema } from './schemaTypes';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

type Observation = { id: string; sequence: number; table: string; recordId: number; field: string; value: unknown; sourceRef?: string; confidence?: number; at: string };
type CandidateState = { data: Record<string, Array<Record<string, unknown>>>; fatalViolations: number; resolvableViolations: number };
type PreviewResult = {
  target: { sequence: number; receivedAt: string; table: string; recordId: number; field: string; value: unknown; sourceRef: string };
  action: 'EXPIRE' | 'REPLACE';
  baseline: { bestState: CandidateState; candidateCount: number; entropyBits: number };
  alternative: { bestState: CandidateState; candidateCount: number; entropyBits: number };
  replacement: { value: unknown; sourceRef: string } | null;
  committed: false;
  persistedEvidenceUnchanged: true;
  provenanceSequence: number;
};
type CasePayload = { id: string; name: string; schemaDefinition: CaseSchema; recentEvidence: Observation[]; ambiguity?: { candidateCount: number; entropyBits: number } };
type AppError = Error & { status?: number };

async function request<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status})`) as AppError;
    error.status = response.status;
    throw error;
  }
  return payload;
}

function scalarLabel(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeReplacement(value: string, schema: CaseSchema, table: string, field: string): string | number | boolean | null {
  const type = schema.tableDefinitions.find(item => item.name === table)?.columns.find(item => item.name === field)?.type;
  if (type === 'NUMBER') {
    const number = Number(value.trim());
    if (!Number.isFinite(number)) throw new Error(`Enter a valid number for ${table}.${field}.`);
    return number;
  }
  if (type === 'BOOLEAN') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    throw new Error(`Enter true/false, yes/no, or 1/0 for ${table}.${field}.`);
  }
  return value;
}

function fieldValue(state: CandidateState | undefined, observation: Observation | PreviewResult['target']): string {
  if (!state) return '—';
  const rows = state.data[observation.table] ?? [];
  const row = rows.find((item, index) => Number(item._recordId ?? index + 1) === observation.recordId);
  return row && observation.field in row ? scalarLabel(row[observation.field]) : 'No selected value';
}

export function EvidenceExpiryLabPage() {
  const caseId = new URLSearchParams(window.location.search).get('case');
  const workspaceHref = caseId ? `/?case=${encodeURIComponent(caseId)}` : '/';
  const token = sessionStorage.getItem('lazarus-x-token');
  const [payload, setPayload] = useState<CasePayload | null>(null);
  const [selectedSequence, setSelectedSequence] = useState('');
  const [action, setAction] = useState<'EXPIRE' | 'REPLACE'>('EXPIRE');
  const [replacementValue, setReplacementValue] = useState('');
  const [replacementSource, setReplacementSource] = useState('Corrected department record');
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState(() => !caseId || !token ? 'Open this lab from a signed-in case workspace.' : '');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!caseId || !token) return;
    let active = true;
    request<CasePayload>(`/cases/${encodeURIComponent(caseId)}`, token)
      .then(data => {
        if (!active) return;
        const observations = (data.recentEvidence ?? []).slice().sort((a, b) => a.sequence - b.sequence);
        const grouped = new Map<string, Set<string>>();
        for (const item of observations) {
          const key = JSON.stringify([item.table, item.recordId, item.field]);
          const values = grouped.get(key) ?? new Set<string>();
          values.add(JSON.stringify([typeof item.value, item.value]));
          grouped.set(key, values);
        }
        const firstClash = observations.find(item => (grouped.get(JSON.stringify([item.table, item.recordId, item.field]))?.size ?? 0) > 1);
        setPayload({ ...data, recentEvidence: observations });
        setSelectedSequence(String((firstClash ?? observations[observations.length - 1])?.sequence ?? ''));
        setLoaded(true);
      })
      .catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Could not load evidence history.'); setLoaded(true); } });
    return () => { active = false; };
  }, [caseId, token]);

  const selected = useMemo(() => payload?.recentEvidence.find(item => item.sequence === Number(selectedSequence)) ?? null, [payload, selectedSequence]);
  const clashSequences = useMemo(() => {
    if (!payload) return new Set<number>();
    const groups = new Map<string, Set<string>>();
    for (const item of payload.recentEvidence) {
      const key = JSON.stringify([item.table, item.recordId, item.field]);
      const values = groups.get(key) ?? new Set<string>();
      values.add(JSON.stringify([typeof item.value, item.value]));
      groups.set(key, values);
    }
    return new Set(payload.recentEvidence.filter(item => (groups.get(JSON.stringify([item.table, item.recordId, item.field]))?.size ?? 0) > 1).map(item => item.sequence));
  }, [payload]);

  const runPreview = async () => {
    if (!caseId || !token || !payload || !selected) return;
    setBusy(true); setError(''); setResult(null);
    try {
      const body: Record<string, unknown> = { targetSequence: selected.sequence, action };
      if (action === 'REPLACE') {
        if (!replacementValue.trim()) throw new Error('Enter the replacement value before running the preview.');
        body.replacementValue = normalizeReplacement(replacementValue, payload.schemaDefinition, selected.table, selected.field);
        body.replacementSource = replacementSource.trim() || 'Replacement source not named';
      }
      const preview = await request<PreviewResult>(`/cases/${encodeURIComponent(caseId)}/simulate-evidence-lifecycle`, token, {
        method: 'POST', body: JSON.stringify(body),
      });
      setResult(preview);
    } catch (cause) {
      const failure = cause as AppError;
      setError(failure.status === 404 ? 'The selected evidence is no longer in the case. Reload this page.' : failure.message || 'The lifecycle preview failed.');
    } finally { setBusy(false); }
  };

  const deltaEntropy = result ? result.alternative.entropyBits - result.baseline.entropyBits : 0;
  const outcomeLabel = !result ? '' : deltaEntropy > 0.005 ? 'The case becomes more uncertain' : deltaEntropy < -0.005 ? 'The remaining evidence narrows uncertainty' : 'The overall ambiguity stays about the same';

  return <div className="evidence-lifecycle-page">
    <header className="evidence-lifecycle-header">
      <a className="secondary-button" href={workspaceHref}><ArrowLeft size={14}/> Back to case workspace</a>
      <div><span className="eyebrow">LAZARUS-X / EVIDENCE LIFECYCLE SIMULATOR</span><h1>The Record That Forgot</h1><p>Expire or replace one old observation, then see what the case can still support.</p></div>
      <span className="lifecycle-readonly"><i/> PREVIEW ONLY</span>
    </header>
    {!caseId || !token || error && !payload ? <main className="evidence-lifecycle-main"><section className="panel lifecycle-error"><CircleAlert size={20}/><strong>{error || 'Open a case to run this simulation.'}</strong><a href={workspaceHref}>Return to the case</a></section></main> : !payload ? <main className="evidence-lifecycle-main"><section className="panel lifecycle-empty"><Clock3 size={20}/><strong>{loaded ? 'No case loaded' : 'Loading verified evidence…'}</strong></section></main> : <main className="evidence-lifecycle-main">
      <section className="panel lifecycle-case-card"><div className="lifecycle-icon"><FileClock size={19}/></div><div><span className="eyebrow">ACTIVE CASE</span><h2>{payload.name}</h2><p>{payload.recentEvidence.length} verified observations · {clashSequences.size ? `${clashSequences.size} observations belong to disputed fields` : 'no repeated field values currently disagree'}</p></div><span className="lifecycle-ledger-tag"><ShieldCheck size={13}/> LEDGER VERIFIED</span></section>

      <section className="panel lifecycle-control-card">
        <div className="lifecycle-title"><div className="lifecycle-icon purple"><Sparkles size={18}/></div><div><span className="eyebrow">RUN A SAFE LIFECYCLE REHEARSAL</span><h2>What if this record expired tomorrow?</h2><p>Choose an accepted observation. The live case remains unchanged while a temporary reconstruction tests the change.</p></div></div>
        {!payload.recentEvidence.length ? <div className="lifecycle-empty"><Archive size={20}/><strong>This case has no accepted observations to expire or replace yet.</strong></div> : <>
          <label className="lifecycle-source-select">Observation to change<select aria-label="Observation to change" value={selectedSequence} onChange={event => { setSelectedSequence(event.target.value); setResult(null); }}>
            {payload.recentEvidence.map(item => <option key={`${item.sequence}-${item.id}`} value={item.sequence}>#{item.sequence} · {item.table}[{item.recordId}].{item.field} = {scalarLabel(item.value)} · {item.sourceRef || 'unnamed source'}{clashSequences.has(item.sequence) ? ' · DISPUTED' : ''}</option>)}
          </select></label>
          {selected && <div className="lifecycle-observation"><div><span>OLD OBSERVATION</span><strong>{selected.table}[{selected.recordId}].{selected.field}</strong><b>{scalarLabel(selected.value)}</b><small>Source: {selected.sourceRef || 'Not named'} · accepted {new Date(selected.at).toLocaleString()}</small></div><div className="lifecycle-arrow"><ArrowRightLeft size={17}/></div><div><span>SCENARIO</span><strong>{action === 'EXPIRE' ? 'Expires / removed from future reconstruction' : 'Replaced by corrected observation'}</strong><small>Ledger history is preserved. This action is only simulated.</small></div></div>}
          <div className="lifecycle-mode" role="group" aria-label="Lifecycle action"><button type="button" className={action === 'EXPIRE' ? 'selected' : ''} onClick={() => { setAction('EXPIRE'); setResult(null); }}><Clock3 size={15}/> Simulate expiry</button><button type="button" className={action === 'REPLACE' ? 'selected' : ''} onClick={() => { setAction('REPLACE'); setResult(null); }}><RotateCcw size={15}/> Simulate replacement</button></div>
          {action === 'REPLACE' && selected && <div className="lifecycle-replacement-fields"><label>Corrected value<input aria-label="Corrected value" value={replacementValue} onChange={event => setReplacementValue(event.target.value)} placeholder={`New ${selected.field} value`} /></label><label>New record source<input aria-label="New record source" value={replacementSource} onChange={event => setReplacementSource(event.target.value)} maxLength={160} placeholder="e.g. revised municipal register"/></label></div>}
          <button className="primary-button lifecycle-run" type="button" disabled={busy || !selected || (action === 'REPLACE' && !replacementValue.trim())} onClick={() => void runPreview()}><Zap size={15}/>{busy ? 'Reconstructing both timelines…' : action === 'EXPIRE' ? 'Simulate expiry and compare' : 'Simulate replacement and compare'}</button>
        </>}
        {error && payload && <div className="lifecycle-error inline" role="alert"><CircleAlert size={15}/>{error}</div>}
      </section>

      {result && <section className="panel lifecycle-results" aria-label="Evidence lifecycle before and after comparison">
        <div className="lifecycle-result-heading"><div><span className="eyebrow">TEMPORAL RECONSTRUCTION · NOTHING SAVED</span><h2>{outcomeLabel}</h2><p>{result.action === 'EXPIRE' ? 'The selected observation is omitted from the temporary future record.' : `The old observation is superseded by “${scalarLabel(result.replacement?.value)}”.`}</p></div><span className="lifecycle-delta">{deltaEntropy > .005 ? '+' : ''}{deltaEntropy.toFixed(3)} heuristic bits</span></div>
        <div className="lifecycle-compare-grid">
          <article className="lifecycle-result-side before"><span className="eyebrow">BEFORE · CURRENT LEDGER</span><h3>What the record says now</h3><div className="lifecycle-stat-grid"><div><small>Surviving interpretations</small><strong>{result.baseline.candidateCount}</strong></div><div><small>Heuristic entropy</small><strong>{result.baseline.entropyBits.toFixed(3)} bits</strong></div></div><div className="lifecycle-field-result"><span>{result.target.table}[{result.target.recordId}].{result.target.field}</span><strong>{fieldValue(result.baseline.bestState, result.target)}</strong></div></article>
          <article className="lifecycle-result-side after"><span className="eyebrow">AFTER · SIMULATED LIFECYCLE CHANGE</span><h3>{result.action === 'EXPIRE' ? 'What remains after expiry' : 'What the corrected record supports'}</h3><div className="lifecycle-stat-grid"><div><small>Surviving interpretations</small><strong>{result.alternative.candidateCount}</strong></div><div><small>Heuristic entropy</small><strong>{result.alternative.entropyBits.toFixed(3)} bits</strong></div></div><div className="lifecycle-field-result"><span>{result.target.table}[{result.target.recordId}].{result.target.field}</span><strong>{fieldValue(result.alternative.bestState, result.target)}</strong></div><small className="lifecycle-violations">{result.alternative.bestState.fatalViolations} fatal · {result.alternative.bestState.resolvableViolations} review flags</small></article>
        </div>
        <div className="lifecycle-preservation-note"><ShieldCheck size={16}/><span><strong>History preserved.</strong> This rehearsal changed no saved evidence, case data, or provenance event. A real retention or disposal policy would need explicit approval and organization-specific rules.</span></div>
      </section>}
      <div className="lifecycle-footer-note"><Archive size={14}/> LAZARUS-X keeps reconstruction history distinct from a source record’s future validity.</div>
    </main>}
  </div>;
}
