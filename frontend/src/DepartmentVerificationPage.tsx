import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, CircleAlert, FileCheck2, FileUp, LockKeyhole, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { digestPartnerDataset, normalizeLinkKey, parsePartnerDataset, type PartnerRow, type PartnerScalar } from './departmentDataset';
import type { CaseSchema } from './schemaTypes';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

type Evidence = { id: string; table: string; recordId: number; field: string; value: unknown; sourceRef?: string; confidence?: number };
type CandidateState = { data: Record<string, Array<Record<string, unknown>>>; fatalViolations: number; resolvableViolations: number };
type ConflictField = { table: string; recordId: number; field: string; values: unknown[]; sources: string[] };
type CaseKeyOption = { field: string; value: PartnerScalar };
type CheckResult = {
  request: { table: string; recordId: number; field: string; departmentName: string; partnerField: string; purpose: string };
  existingValues: unknown[];
  response: { departmentName: string; field: string; partnerField: string; value: PartnerScalar; sourceReference: string; sourceVersion: string; sourceMode: 'USER_SUPPLIED_PARTNER_EXTRACT'; departmentAuthenticated: false; matchStatus: 'MATCHES_AN_EXISTING_READING' | 'NEW_READING' };
  receipt: { requestId: string; requestedAt: string; caseProvenanceSequence: number; responseDigest: string; datasetDigest: string; auditLogged: boolean };
  committed: false;
};
type Simulation = {
  before: { bestState: CandidateState; candidateCount: number };
  after: { bestState: CandidateState; candidateCount: number };
  committed: false;
};
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

function scalarKey(value: unknown): string {
  return JSON.stringify({ type: value === null ? 'null' : typeof value, value });
}

function conflictsFrom(evidence: Evidence[]): ConflictField[] {
  const groups = new Map<string, Evidence[]>();
  for (const item of evidence) {
    const key = JSON.stringify([item.table, item.recordId, item.field]);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].flatMap(items => {
    const first = items[0];
    if (!first) return [];
    const values = [...new Map(items.map(item => [scalarKey(item.value), item.value])).values()];
    if (values.length < 2) return [];
    return [{ table: first.table, recordId: first.recordId, field: first.field, values, sources: [...new Set(items.map(item => item.sourceRef).filter((source): source is string => !!source))] }];
  });
}

function caseKeyOptions(evidence: Evidence[], target: ConflictField | null): CaseKeyOption[] {
  if (!target) return [];
  const fields = new Map<string, unknown[]>();
  for (const item of evidence) {
    if (item.table !== target.table || item.recordId !== target.recordId || item.field === target.field) continue;
    fields.set(item.field, [...(fields.get(item.field) ?? []), item.value]);
  }
  return [...fields.entries()].flatMap(([field, values]) => {
    const distinct = [...new Map(values.map(value => [scalarKey(value), value])).values()];
    const value = distinct[0];
    return distinct.length === 1 && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      ? [{ field, value }]
      : [];
  });
}

function normalizeForSchema(value: PartnerScalar, schema: CaseSchema | undefined, table: string, field: string): PartnerScalar {
  const type = schema?.tableDefinitions.find(item => item.name === table)?.columns.find(item => item.name === field)?.type;
  if (value === null || type === 'TEXT' || type === 'ANY' || !type) return value;
  if (type === 'NUMBER') {
    const number = typeof value === 'number' ? value : Number(String(value).trim());
    if (!Number.isFinite(number)) throw new Error(`Partner value “${String(value)}” is not a valid number for ${table}.${field}.`);
    return number;
  }
  if (type === 'BOOLEAN') {
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
    throw new Error(`Partner value “${String(value)}” is not a valid boolean for ${table}.${field}.`);
  }
  return value;
}

export function DepartmentVerificationPage() {
  const caseId = new URLSearchParams(window.location.search).get('case');
  const workspaceHref = caseId ? `/?case=${encodeURIComponent(caseId)}` : '/';
  const token = sessionStorage.getItem('lazarus-x-token');
  const [caseName, setCaseName] = useState('');
  const [caseEvidence, setCaseEvidence] = useState<Evidence[]>([]);
  const [schema, setSchema] = useState<CaseSchema>();
  const [currentState, setCurrentState] = useState<CandidateState | null>(null);
  const [conflicts, setConflicts] = useState<ConflictField[]>([]);
  const [selectedConflictKey, setSelectedConflictKey] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [sourceReference, setSourceReference] = useState('');
  const [sourceVersion, setSourceVersion] = useState('');
  const [fileName, setFileName] = useState('');
  const [datasetMode, setDatasetMode] = useState<'demo' | 'file' | ''>('');
  const [datasetRows, setDatasetRows] = useState<PartnerRow[]>([]);
  const [datasetDigest, setDatasetDigest] = useState('');
  const [columns, setColumns] = useState<string[]>([]);
  const [caseKeyField, setCaseKeyField] = useState('');
  const [partnerKeyField, setPartnerKeyField] = useState('');
  const [partnerValueField, setPartnerValueField] = useState('');
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [simulation, setSimulation] = useState<Simulation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => !caseId || !token ? 'Open this page from a signed-in case workspace.' : '');
  const [loaded, setLoaded] = useState(false);

  const selectedConflict = useMemo(() => conflicts.find(item => JSON.stringify([item.table, item.recordId, item.field]) === selectedConflictKey) ?? null, [conflicts, selectedConflictKey]);
  const keyOptions = useMemo(() => caseKeyOptions(caseEvidence, selectedConflict), [caseEvidence, selectedConflict]);
  const selectedCaseKey = keyOptions.find(item => item.field === caseKeyField) ?? keyOptions[0];
  const importedPreview = datasetRows.slice(0, 5);

  useEffect(() => {
    if (!caseId || !token) return;
    let active = true;
    request<{ name: string; recentEvidence: Evidence[]; bestState: CandidateState; schemaDefinition: CaseSchema }>(`/cases/${encodeURIComponent(caseId)}`, token)
      .then(payload => {
        if (!active) return;
        const evidence = payload.recentEvidence ?? [];
        const found = conflictsFrom(evidence);
        setCaseName(payload.name || 'Selected case');
        setCaseEvidence(evidence);
        setSchema(payload.schemaDefinition);
        setCurrentState(payload.bestState ?? null);
        setConflicts(found);
        setSelectedConflictKey(found[0] ? JSON.stringify([found[0].table, found[0].recordId, found[0].field]) : '');
        setLoaded(true);
      })
      .catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Could not load this case.'); setLoaded(true); } });
    return () => { active = false; };
  }, [caseId, token]);

  useEffect(() => {
    setCaseKeyField(keyOptions[0]?.field ?? '');
  }, [selectedConflictKey, caseEvidence]);

  const importPartnerFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setCheck(null); setSimulation(null); setBusy(true);
    try {
      const text = await file.text();
      const parsed = parsePartnerDataset(text, file.name);
      const headers = [...new Set(parsed.flatMap(row => Object.keys(row)))];
      if (headers.length < 2) throw new Error('The partner extract needs a match-key column and a field to verify.');
      setDatasetRows(parsed); setColumns(headers); setFileName(file.name);
      setDatasetMode('file');
      setSourceReference(file.name); setDatasetDigest(await digestPartnerDataset(text));
      setPartnerKeyField(headers[0] ?? '');
      setPartnerValueField(headers.find(header => header === selectedConflict?.field) ?? headers[1] ?? '');
    } catch (cause) {
      setDatasetRows([]); setColumns([]); setFileName(''); setDatasetDigest(''); setDatasetMode('');
      setError(cause instanceof Error ? cause.message : 'Could not read the partner extract.');
    } finally { setBusy(false); event.target.value = ''; }
  };

  const loadDemoDataset = async () => {
    if (!selectedConflict || !selectedCaseKey) return;
    const keyColumn = 'case_key';
    const valueColumn = 'verified_value';
    const text = JSON.stringify([{ [keyColumn]: selectedCaseKey.value, [valueColumn]: selectedConflict.values[0] ?? null, demo_note: 'Synthetic classroom fixture; not an official department response' }]);
    try {
      const parsed = parsePartnerDataset(text, 'synthetic-department-demo.json');
      setBusy(true); setError(''); setCheck(null); setSimulation(null);
      setDatasetRows(parsed); setColumns(Object.keys(parsed[0] ?? {})); setFileName('Synthetic demo dataset'); setDatasetMode('demo');
      setPartnerKeyField(keyColumn); setPartnerValueField(valueColumn);
      setDepartmentName('District Registry (synthetic demo)');
      setSourceReference('Synthetic classroom demo — not an official record'); setSourceVersion('DEMO-01');
      setDatasetDigest(await digestPartnerDataset(text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not prepare the synthetic demo record.');
    } finally { setBusy(false); }
  };

  const runCheck = async () => {
    if (!caseId || !token || !selectedConflict || !selectedCaseKey || !datasetRows.length || !datasetDigest || !departmentName.trim() || !partnerKeyField || !partnerValueField) return;
    setBusy(true); setError(''); setCheck(null); setSimulation(null);
    try {
      const caseKey = normalizeLinkKey(selectedCaseKey.value);
      const matchedRows = datasetRows.filter(row => normalizeLinkKey(row[partnerKeyField]) === caseKey);
      if (matchedRows.length === 0) throw new Error('No partner row matched this case key. Check the key mapping or source extract.');
      if (matchedRows.length > 1) throw new Error(`The selected key matched ${matchedRows.length} partner rows. Choose a more specific key so the lookup identifies exactly one record.`);
      const partnerRow = matchedRows[0]!;
      if (!(partnerValueField in partnerRow)) throw new Error(`The matched row has no “${partnerValueField}” field.`);
      const typedValue = normalizeForSchema(partnerRow[partnerValueField] ?? null, schema, selectedConflict.table, selectedConflict.field);
      const response = await request<CheckResult>(`/cases/${encodeURIComponent(caseId)}/department-verifications`, token, {
        method: 'POST',
        body: JSON.stringify({
          table: selectedConflict.table,
          recordId: selectedConflict.recordId,
          field: selectedConflict.field,
          departmentName: departmentName.trim(),
          partnerField: partnerValueField,
          value: typedValue,
          sourceReference: sourceReference.trim() || fileName,
          sourceVersion: sourceVersion.trim() || undefined,
          datasetDigest,
          partnerValue: partnerRow[partnerKeyField],
          matchKey: { caseField: selectedCaseKey.field, caseValue: selectedCaseKey.value, partnerKeyField },
        }),
      });
      setCheck(response);
    } catch (cause) {
      const failure = cause as AppError;
      setError(failure.status === 404
        ? 'The case could not be found.'
        : failure.status === 409
          ? 'That field no longer has conflicting evidence. Reload this page to refresh the case.'
          : failure.message || 'The partner record could not be checked.');
    } finally { setBusy(false); }
  };

  const previewImpact = async () => {
    if (!caseId || !token || !selectedConflict || !check) return;
    setBusy(true); setError(''); setSimulation(null);
    try {
      const result = await request<Simulation>(`/cases/${encodeURIComponent(caseId)}/simulate`, token, {
        method: 'POST',
        body: JSON.stringify({ evidence: { table: selectedConflict.table, recordId: selectedConflict.recordId, field: selectedConflict.field, value: check.response.value, confidence: 0.9 } }),
      });
      setSimulation(result);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not preview this partner response.'); }
    finally { setBusy(false); }
  };

  const rowValue = (state: CandidateState | undefined, target: ConflictField | null) => {
    if (!state || !target) return '—';
    const row = (state.data[target.table] ?? []).find((item, index) => Number(item._recordId ?? index + 1) === target.recordId);
    const value = row?.[target.field];
    return value === undefined ? 'No selected value' : String(value ?? 'NULL');
  };

  return <div className="department-page">
    <header className="department-header">
      <a className="secondary-button" href={workspaceHref}><ArrowLeft size={14}/> Back to case workspace</a>
      <div><span className="eyebrow">LAZARUS-X / FEDERATED CHECK</span><h1>Interdepartmental Verification</h1><p>Match one disputed field against a department extract, without importing its full table.</p></div>
      <span className={`department-demo-badge ${datasetMode === 'demo' ? 'synthetic' : ''}`}><i/> {datasetMode === 'demo' ? 'SYNTHETIC DEMO' : 'SOURCE CHECK'}</span>
    </header>
    <main className="department-main">
      <section className="panel department-case-card"><div className="department-icon"><Building2 size={19}/></div><div><span className="eyebrow">ACTIVE CASE</span><h2>{caseName || (loaded ? 'Case unavailable' : 'Loading case…')}</h2><p>{conflicts.length ? `${conflicts.length} field conflict${conflicts.length === 1 ? '' : 's'} found in saved evidence.` : 'Waiting for conflict scan.'}</p></div><a className="secondary-button" href={`/final-data-summary?case=${encodeURIComponent(caseId ?? '')}`}>View results <ArrowRight size={14}/></a></section>
      <section className="panel department-request-panel">
        <div className="department-section-heading"><div className="department-icon blue"><ShieldCheck size={18}/></div><div><span className="eyebrow">STEP 1 · SELECT THE CLASH</span><h2>Choose the case field to verify</h2><p>Only fields with at least two different observed values can be checked.</p></div></div>
        {error && !check && <div className="department-error" role="alert"><CircleAlert size={15}/>{error}</div>}
        {loaded && !conflicts.length && !error && <div className="department-empty"><FileCheck2 size={20}/><strong>No conflicting fields found</strong><span>Add source evidence with competing values first. This page does not query an undisputed field.</span></div>}
        {conflicts.length > 0 && <>
          <label className="department-single-field">Disputed field<select value={selectedConflictKey} onChange={event => { setSelectedConflictKey(event.target.value); setCheck(null); setSimulation(null); }}>{conflicts.map(item => { const key = JSON.stringify([item.table, item.recordId, item.field]); return <option key={key} value={key}>{item.table}[{item.recordId}].{item.field} · {item.values.length} values</option>; })}</select></label>
          {selectedConflict && <div className="department-conflict-table-wrap"><table className="department-conflict-table"><thead><tr><th>Values from this case</th><th>Source references</th><th>Current reconstruction</th></tr></thead><tbody><tr><td><div className="department-values">{selectedConflict.values.map((value, index) => <span key={`${scalarKey(value)}-${index}`}>{String(value ?? 'NULL')}</span>)}</div></td><td>{selectedConflict.sources.length ? selectedConflict.sources.join(' · ') : 'Source not named'}</td><td>{rowValue(simulation?.before.bestState ?? currentState ?? undefined, selectedConflict)}</td></tr></tbody></table></div>}
        </>}
        <div className="department-privacy-note"><LockKeyhole size={15}/><span><strong>Minimal disclosure:</strong> the full CSV/JSON extract is parsed and searched in this browser tab. Only the matching key and requested field value are sent to this app for conflict validation and audit. The file is not uploaded or stored by this page.</span></div>
      </section>
      {conflicts.length > 0 && <section className="panel department-request-panel">
        <div className="department-section-heading"><div className="department-icon violet"><FileUp size={18}/></div><div><span className="eyebrow">STEP 2 · VERIFY THE OTHER RECORD</span><h2>Use a demo record or department extract</h2><p>Try the complete flow with built-in synthetic data, or load a CSV/JSON export with your own mapped columns.</p></div></div>
        <div className="department-demo-action"><div><strong><Sparkles size={15}/> Need a demo? Load a ready-made record</strong><span>Creates one synthetic partner row matching the selected case key. Clearly labeled demo data; it is not an official department source.</span></div><button type="button" className="secondary-button" onClick={() => void loadDemoDataset()} disabled={busy || !selectedCaseKey}><Sparkles size={14}/>{datasetMode === 'demo' ? 'Reload demo record' : 'Load synthetic demo'}</button></div>
        <div className="department-form-grid department-import-grid">
          <label>Department name<input value={departmentName} onChange={event => { setDepartmentName(event.target.value); setCheck(null); setSimulation(null); }} maxLength={100} placeholder="e.g. District Education Office"/></label>
          <label>Partner source file<input type="file" accept=".csv,.json,text/csv,application/json" onChange={event => void importPartnerFile(event)} aria-label="Partner source file"/></label>
          <label>Source version / date <span className="department-optional">OPTIONAL</span><input value={sourceVersion} onChange={event => setSourceVersion(event.target.value)} maxLength={100} placeholder="e.g. export 2026-10-28"/></label>
          <label>Case record match key<select value={caseKeyField} onChange={event => setCaseKeyField(event.target.value)} disabled={!keyOptions.length}>{keyOptions.map(option => <option key={option.field} value={option.field}>{selectedConflict?.table}.{option.field} = {String(option.value)}</option>)}</select></label>
          <label>Partner key column<select value={partnerKeyField} onChange={event => setPartnerKeyField(event.target.value)} disabled={!columns.length}>{columns.map(column => <option key={column} value={column}>{column}</option>)}</select></label>
          <label>Partner column to check<select value={partnerValueField} onChange={event => setPartnerValueField(event.target.value)} disabled={!columns.length}>{columns.map(column => <option key={column} value={column}>{column}</option>)}</select></label>
          <label className="department-source-reference">Source reference<input value={sourceReference} onChange={event => setSourceReference(event.target.value)} maxLength={160} placeholder={fileName || 'Document, register, or extract reference'}/></label>
          <button className="primary-button department-check-button" type="button" onClick={() => void runCheck()} disabled={busy || !selectedConflict || !selectedCaseKey || !datasetRows.length || !departmentName.trim() || !partnerKeyField || !partnerValueField || partnerKeyField === partnerValueField}><ShieldCheck size={15}/>{busy ? 'Matching and checking…' : 'Check this department record'}</button>
        </div>
        {!datasetRows.length && <p className="department-check-hint">The check button activates after you load the synthetic demo above or choose a CSV/JSON extract.</p>}
        {fileName && <div className={`department-file-status ${datasetMode === 'demo' ? 'demo' : ''}`}><FileCheck2 size={15}/><span><strong>{fileName}</strong> · {datasetRows.length.toLocaleString()} row{datasetRows.length === 1 ? '' : 's'} {datasetMode === 'demo' ? 'loaded as synthetic demo' : 'loaded locally'}</span><code title={datasetDigest}>Dataset SHA-256 · {datasetDigest.slice(0,16)}…</code></div>}
        {!!importedPreview.length && <div className="department-conflict-table-wrap department-import-preview"><table className="department-conflict-table"><thead><tr>{columns.map(column => <th key={column}>{column}</th>)}</tr></thead><tbody>{importedPreview.map((row,index) => <tr key={index}>{columns.map(column => <td key={column}>{String(row[column] ?? 'NULL')}</td>)}</tr>)}</tbody></table><p>Local preview · first {importedPreview.length} rows · no full extract uploaded</p></div>}
        {loaded && !keyOptions.length && <div className="department-error"><CircleAlert size={15}/>This record has no single-valued field to use as an exact match key. Add a stable identifier observation before checking another dataset.</div>}
      </section>}
      {check && selectedConflict && <section className="panel department-result-panel" aria-label="Department verification result">
        <div className="department-result-top"><div className="department-result-icon"><CheckCircle2 size={19}/></div><div><span className="eyebrow">MATCHED PARTNER EXTRACT · NOT DEPARTMENT-AUTHENTICATED</span><h2>{check.response.departmentName}</h2><p>The exact key matched one row. Only the requested field value was returned to the app.</p></div><span className={`department-match-tag ${check.response.matchStatus === 'MATCHES_AN_EXISTING_READING' ? 'matches' : 'new-reading'}`}>{check.response.matchStatus === 'MATCHES_AN_EXISTING_READING' ? 'MATCHES A SOURCE' : 'NEW READING'}</span></div>
        <div className="department-response-grid"><div><span>Case field</span><strong>{check.request.table}[{check.request.recordId}].{check.response.field}</strong></div><div><span>Partner value</span><strong>{String(check.response.value ?? 'NULL')}</strong></div><div><span>Partner column</span><strong>{check.response.partnerField}</strong></div><div><span>Source reference</span><strong>{check.response.sourceReference}</strong></div></div>
        <div className="department-receipt"><div><span className="eyebrow">AUDIT RECEIPT</span><strong>Request {check.receipt.requestId}</strong><small>{new Date(check.receipt.requestedAt).toLocaleString()} · case ledger sequence {check.receipt.caseProvenanceSequence} · audit logged {check.receipt.auditLogged ? 'yes' : 'no'}</small></div><code title={check.receipt.responseDigest}>Response digest · {check.receipt.responseDigest}</code></div>
        <div className="department-preview-row"><p>The imported value is not evidence yet. Preview its effect in an isolated engine run before deciding what to do next.</p><button className="primary-button" type="button" onClick={() => void previewImpact()} disabled={busy}><Zap size={15}/>{busy ? 'Previewing…' : 'Preview reconstruction impact'}</button></div>
      </section>}
      {error && check && <div className="department-error" role="alert"><CircleAlert size={15}/>{error}</div>}
      {simulation && selectedConflict && <section className="panel department-impact-panel" aria-label="Department response reconstruction preview"><div className="department-section-heading"><div className="department-icon violet"><Zap size={18}/></div><div><span className="eyebrow">ISOLATED PREVIEW · NOTHING SAVED</span><h2>What the returned value changes</h2><p>Previewed {selectedConflict.table}[{selectedConflict.recordId}].{selectedConflict.field} using the imported department value.</p></div></div><div className="department-impact-grid"><div><span>Surviving interpretations</span><strong>{simulation.before.candidateCount} → {simulation.after.candidateCount}</strong></div><div><span>Selected field before</span><strong>{rowValue(simulation.before.bestState, selectedConflict)}</strong></div><div><span>Selected field after</span><strong>{rowValue(simulation.after.bestState, selectedConflict)}</strong></div><div><span>Violations after</span><strong>{simulation.after.bestState.fatalViolations} fatal · {simulation.after.bestState.resolvableViolations} review</strong></div></div><p className="department-impact-disclaimer">This is a temporary preview. It does not certify the external record or update the saved case.</p></section>}
    </main>
  </div>;
}
