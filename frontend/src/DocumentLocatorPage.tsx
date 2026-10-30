import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, Archive, BadgeCheck, Building2, CircleAlert, Clock3, FileText, Loader2, MapPin, PackageCheck, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
const STATUSES = ['IN_STORAGE', 'CHECKED_OUT', 'RESTRICTED', 'NOT_FOUND'] as const;
type LocationStatus = typeof STATUSES[number];
type SourceLocation = {
  id: string;
  departmentName: string;
  officeName: string;
  documentName: string;
  referenceCode: string | null;
  sourceReference: string | null;
  storageLocation: string;
  custodian: string | null;
  contact: string | null;
  accessNotes: string | null;
  status: LocationStatus;
  demoKey: string | null;
  lastVerifiedAt: string;
  updatedAt: string;
};
type FormValues = Omit<SourceLocation, 'id' | 'demoKey' | 'lastVerifiedAt' | 'updatedAt'>;

const emptyForm: FormValues = {
  departmentName: '', officeName: '', documentName: '', referenceCode: '', sourceReference: '',
  storageLocation: '', custodian: '', contact: '', accessNotes: '', status: 'IN_STORAGE',
};

async function api<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init?.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({})) as { error?: string } & T;
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

const statusLabel: Record<LocationStatus, string> = {
  IN_STORAGE: 'In storage', CHECKED_OUT: 'Checked out', RESTRICTED: 'Restricted access', NOT_FOUND: 'Not located',
};

export function DocumentLocatorPage() {
  const token = sessionStorage.getItem('lazarus-x-token');
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get('case');
  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [locations, setLocations] = useState<SourceLocation[]>([]);
  const [form, setForm] = useState<FormValues>({ ...emptyForm, sourceReference: initialQuery });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    try {
      const result = await api<{ locations: SourceLocation[] }>('/source-document-locations', token);
      setLocations(result.locations);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the document directory.');
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, [token]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return locations;
    return locations.filter(item => [item.departmentName, item.officeName, item.documentName, item.referenceCode, item.sourceReference, item.storageLocation, item.custodian, item.contact, item.accessNotes]
      .some(value => typeof value === 'string' && value.toLocaleLowerCase().includes(normalized)));
  }, [locations, query]);

  const saveLocation = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const result = await api<{ location: SourceLocation }>('/source-document-locations', token, { method: 'POST', body: JSON.stringify(form) });
      setLocations(current => [result.location, ...current]);
      setNotice('Document location saved to your directory.');
      setForm({ ...emptyForm, sourceReference: initialQuery });
      setShowForm(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this location.'); }
    finally { setSaving(false); }
  };

  const loadDemo = async () => {
    if (!token) return;
    setDemoLoading(true); setError(''); setNotice('');
    try {
      const result = await api<{ locations: SourceLocation[]; added: number }>('/source-document-locations/demo', token, { method: 'POST', body: '{}' });
      setLocations(result.locations);
      setNotice(result.added ? `Added ${result.added} labeled synthetic sample locations.` : 'Sample locations are already in your directory.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load sample locations.'); }
    finally { setDemoLoading(false); }
  };

  const updateStatus = async (item: SourceLocation, status: LocationStatus) => {
    if (!token) return;
    try {
      const result = await api<{ location: SourceLocation }>(`/source-document-locations/${encodeURIComponent(item.id)}`, token, { method: 'PATCH', body: JSON.stringify({ ...item, status }) });
      setLocations(current => current.map(location => location.id === item.id ? result.location : location));
      setNotice(`Status updated for ${item.documentName}.`);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the document status.'); }
  };

  const checkedOutCount = locations.filter(item => item.status === 'CHECKED_OUT').length;
  const restrictedCount = locations.filter(item => item.status === 'RESTRICTED').length;

  return <div className="document-locator-page">
    <header className="document-locator-header">
      <a className="secondary-button" href={caseId ? `/?case=${encodeURIComponent(caseId)}` : '/'}><ArrowLeft size={14}/> {caseId ? 'Back to case' : 'Project home'}</a>
      <div><span className="eyebrow">LAZARUS-X / RECORDS DIRECTORY</span><h1>Document Locator</h1><p>Find the department, office, and storage location for a source document.</p></div>
      <span className="document-locator-secure"><ShieldCheck size={13}/> PRIVATE DIRECTORY</span>
    </header>
    <main className="document-locator-main">
      {!token ? <section className="panel document-locator-empty"><LockIcon/><h2>Sign in to access the document directory</h2><p>Storage locations are private to your account. Sign in from the project home, then open Document Locator from the top bar.</p><a className="primary-button" href="/">Go to project home</a></section> : <>
        {caseId && <section className="document-locator-source-callout"><FileText size={17}/><div><span className="eyebrow">SOURCE FROM FINAL DATABASE</span><strong>{initialQuery || 'Selected source reference'}</strong><small>Search is prefilled from the evidence source selected in the final results.</small></div></section>}
        <section className="document-locator-hero panel">
          <div className="document-locator-hero-copy"><span className="eyebrow">RETRIEVAL DESK</span><h2>Where is the original record?</h2><p>Search by source reference, document title, department, office, or archive location.</p></div>
          <div className="document-locator-search"><Search size={17}/><input aria-label="Search document locations" placeholder="e.g. example:hospital-register or birth register" value={query} onChange={event => setQuery(event.target.value)}/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</div>
          <div className="document-locator-stats"><div><strong>{locations.length}</strong><span>registered locations</span></div><div><strong>{checkedOutCount}</strong><span>currently checked out</span></div><div><strong>{restrictedCount}</strong><span>restricted access</span></div></div>
        </section>
        <div className="document-locator-toolbar"><div><h2>Source document directory</h2><span>{visible.length} {visible.length === 1 ? 'match' : 'matches'}</span></div><div><button type="button" className="secondary-button" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/> Refresh</button><button type="button" className="secondary-button" onClick={() => void loadDemo()} disabled={demoLoading}>{demoLoading ? <Loader2 size={14} className="spin"/> : <PackageCheck size={14}/>} Load demo locations</button><button type="button" className="primary-button" onClick={() => setShowForm(open => !open)}><Plus size={15}/> Register a document</button></div></div>
        {notice && <div className="document-locator-notice" role="status"><BadgeCheck size={15}/>{notice}</div>}
        {error && <div className="document-locator-error" role="alert"><CircleAlert size={15}/>{error}</div>}
        {showForm && <form className="panel document-location-form" onSubmit={event => void saveLocation(event)}><div className="document-form-heading"><div><span className="eyebrow">ADD TO DIRECTORY</span><h2>Register a source document</h2></div><button type="button" className="icon-button" aria-label="Close registration form" onClick={() => setShowForm(false)}>×</button></div>
          <div className="document-form-grid">
            <label>Department<input required maxLength={120} value={form.departmentName} onChange={event => setForm({ ...form, departmentName: event.target.value })} placeholder="District Education Office"/></label>
            <label>Office<input required maxLength={120} value={form.officeName} onChange={event => setForm({ ...form, officeName: event.target.value })} placeholder="Kolar Records Section"/></label>
            <label>Document title<input required maxLength={180} value={form.documentName} onChange={event => setForm({ ...form, documentName: event.target.value })} placeholder="Admission register · 1998"/></label>
            <label>Physical storage location<input required maxLength={180} value={form.storageLocation} onChange={event => setForm({ ...form, storageLocation: event.target.value })} placeholder="Archive room · Rack · Shelf"/></label>
            <label>Source reference<input maxLength={180} value={form.sourceReference ?? ''} onChange={event => setForm({ ...form, sourceReference: event.target.value })} placeholder="Matches the reference in case evidence"/></label>
            <label>Volume / file reference<input maxLength={180} value={form.referenceCode ?? ''} onChange={event => setForm({ ...form, referenceCode: event.target.value })} placeholder="Register number or archive code"/></label>
            <label>Custodian<input maxLength={180} value={form.custodian ?? ''} onChange={event => setForm({ ...form, custodian: event.target.value })} placeholder="Records desk / role"/></label>
            <label>Contact / extension<input maxLength={180} value={form.contact ?? ''} onChange={event => setForm({ ...form, contact: event.target.value })} placeholder="Office contact"/></label>
            <label>Access status<select value={form.status} onChange={event => setForm({ ...form, status: event.target.value as LocationStatus })}>{STATUSES.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label>
            <label className="document-form-wide">Retrieval notes<textarea rows={2} maxLength={1000} value={form.accessNotes ?? ''} onChange={event => setForm({ ...form, accessNotes: event.target.value })} placeholder="Required request, notice period, or retrieval instructions"/></label>
          </div><div className="document-form-actions"><span>Only enter storage details your team is authorised to access.</span><button type="submit" className="primary-button" disabled={saving}>{saving ? <Loader2 size={14} className="spin"/> : <Archive size={14}/>} Save location</button></div>
        </form>}
        {loading ? <section className="panel document-locator-empty"><Loader2 className="spin" size={22}/><strong>Loading document locations…</strong></section> : visible.length ? <section className="document-location-list" aria-label="Document location results">{visible.map(item => <article className="panel document-location-card" key={item.id}>
          <div className="document-card-icon"><FileText size={19}/></div><div className="document-card-main"><div className="document-card-title"><div><span className="eyebrow">{item.departmentName}</span><h3>{item.documentName}</h3></div><span className={`document-status status-${item.status.toLowerCase()}`}>{statusLabel[item.status]}</span></div>
          <div className="document-card-details"><div><Building2 size={14}/><span><small>OFFICE</small><strong>{item.officeName}</strong></span></div><div><MapPin size={14}/><span><small>PHYSICAL LOCATION</small><strong>{item.storageLocation}</strong></span></div>{item.referenceCode && <div><Archive size={14}/><span><small>VOLUME / FILE CODE</small><strong>{item.referenceCode}</strong></span></div>}{item.custodian && <div><BadgeCheck size={14}/><span><small>CUSTODIAN</small><strong>{item.custodian}</strong></span></div>}{item.contact && <div><Clock3 size={14}/><span><small>CONTACT</small><strong>{item.contact}</strong></span></div>}</div>
          {item.sourceReference && <div className="document-source-reference"><span>CASE SOURCE REF</span><code>{item.sourceReference}</code></div>}{item.accessNotes && <p className="document-access-notes">{item.accessNotes}</p>}
          <div className="document-card-footer"><span>Location checked {new Date(item.lastVerifiedAt).toLocaleDateString()}</span><label>Update status<select aria-label={`Update status for ${item.documentName}`} value={item.status} onChange={event => void updateStatus(item, event.target.value as LocationStatus)}>{STATUSES.map(status => <option key={status} value={status}>{statusLabel[status]}</option>)}</select></label></div>
          {item.demoKey && <span className="document-demo-tag">SYNTHETIC CLASSROOM SAMPLE</span>}
        </div></article>)}</section> : <section className="panel document-locator-empty"><Archive size={25}/><h2>{query ? 'No registered source location matches' : 'No documents registered yet'}</h2><p>{query ? 'Check the source reference or register the document’s known department and office location.' : 'Register your first source document, or load the sample directory to explore the locator.'}</p><div><button type="button" className="primary-button" onClick={() => setShowForm(true)}><Plus size={14}/> Register a document</button><button type="button" className="secondary-button" onClick={() => void loadDemo()} disabled={demoLoading}>Load sample locations</button></div></section>}
        <footer className="document-locator-footer"><ShieldCheck size={14}/> Directory records are account-scoped and audit logged. The sample entries are synthetic and do not describe live government storage locations.</footer>
      </>}
    </main>
  </div>;
}

function LockIcon() { return <ShieldCheck size={24}/>; }
