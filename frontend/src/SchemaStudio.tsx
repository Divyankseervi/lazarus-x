import { useMemo, useState } from 'react';
import { ArrowRight, Check, Plus, Table2, Trash2, X, Sparkles } from 'lucide-react';
import { createPresetSchema, schemaWithConstraints, validateCaseSchema, type CaseSchema, type ColumnType, type ForeignKeyDefinition, type PresetId, type TableDefinition } from './schemaTypes';
import { divyank24BCE0793_EXAMPLE_SCENARIOS } from './exampleScenarios';

interface SchemaStudioProps {
  open: boolean;
  busy?: boolean;
  onClose: () => void;
  onCreate: (caseName: string, schema: CaseSchema, autoScenarioId?: string) => Promise<void> | void;
}

export function SchemaStudio({ open, busy = false, onClose, onCreate }: SchemaStudioProps) {
  const [preset, setPreset] = useState<PresetId | 'custom'>('incident-response');
  const [caseName, setCaseName] = useState('Incident reconstruction 01');
  const [schemaName, setSchemaName] = useState('Incident response records');
  const [autoScenarioId, setAutoScenarioId] = useState<string>('none');
  const [tables, setTables] = useState<TableDefinition[]>(() => createPresetSchema('incident-response').tableDefinitions);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyDefinition[]>(() => createPresetSchema('incident-response').constraints.filter(c => c.type === 'FOREIGN_KEY') as ForeignKeyDefinition[]);
  const [validationError, setValidationError] = useState('');
  const allTableNames = useMemo(() => tables.map(table => table.name), [tables]);
  const schema = useMemo(() => schemaWithConstraints(schemaName.trim() || 'Custom reconstruction schema', preset, tables, foreignKeys), [schemaName, preset, tables, foreignKeys]);

  if (!open) return null;

  const switchPreset = (next: PresetId) => {
    const nextSchema = createPresetSchema(next);
    setPreset(next);
    setSchemaName(nextSchema.name);
    setTables(nextSchema.tableDefinitions);
    setForeignKeys(nextSchema.constraints.filter(c => c.type === 'FOREIGN_KEY') as ForeignKeyDefinition[]);
    setValidationError('');
  };

  const patchTable = (index: number, patch: Partial<TableDefinition>) => setTables(current => current.map((table, i) => i === index ? { ...table, ...patch } : table));
  const patchColumn = (tableIndex: number, columnIndex: number, patch: { name?: string; type?: ColumnType; required?: boolean; unique?: boolean }) => setTables(current => current.map((table, i) => i === tableIndex ? { ...table, columns: table.columns.map((column, j) => j === columnIndex ? { ...column, ...patch } : column) } : table));
  const addTable = () => {
    if (tables.length >= 20) return;
    const name = `Relation${tables.length + 1}`;
    setTables(current => [...current, { name, columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }] }]);
    setPreset('custom');
    setValidationError('');
  };
  const removeTable = (tableIndex: number) => {
    const removedName = tables[tableIndex]?.name;
    setTables(current => current.filter((_, i) => i !== tableIndex));
    setForeignKeys(current => current.filter(fk => fk.table !== removedName && fk.targetTable !== removedName));
    setPreset('custom');
  };
  const addColumn = (tableIndex: number) => setTables(current => current.map((table, i) => i === tableIndex && table.columns.length < 80 ? { ...table, columns: [...table.columns, { name: `field${table.columns.length + 1}`, type: 'TEXT' as const }] } : table));
  const removeColumn = (tableIndex: number, columnIndex: number) => {
    const tableName = tables[tableIndex]?.name;
    const columnName = tables[tableIndex]?.columns[columnIndex]?.name;
    setTables(current => current.map((table, i) => i === tableIndex ? { ...table, columns: table.columns.filter((_, j) => j !== columnIndex) } : table));
    setForeignKeys(current => current.filter(fk => !(fk.table === tableName && fk.field === columnName) && !(fk.targetTable === tableName && fk.targetField === columnName)));
    setPreset('custom');
  };
  const addForeignKey = () => {
    if (tables.length < 2) return;
    const source = tables[1] ?? tables[0]!;
    const target = tables[0]!;
    const sourceField = source.columns.find(column => /id$/i.test(column.name) && !column.unique)?.name ?? source.columns[0]!.name;
    const targetField = target.columns.find(column => column.unique)?.name ?? target.columns[0]!.name;
    setForeignKeys(current => [...current, { type: 'FOREIGN_KEY', table: source.name, field: sourceField, targetTable: target.name, targetField }]);
    setPreset('custom');
  };
  const patchForeignKey = (index: number, patch: Partial<ForeignKeyDefinition>) => setForeignKeys(current => current.map((fk, i) => i === index ? { ...fk, ...patch } : fk));
  const submit = async () => {
    const current = { ...schema, name: schemaName.trim() || 'Custom reconstruction schema' };
    const error = validateCaseSchema({ ...current, name: schemaName.trim() || 'Custom reconstruction schema' });
    if (!caseName.trim()) { setValidationError('Give this case a name.'); return; }
    if (caseName.trim().length > 100) { setValidationError('Case name must be 100 characters or fewer.'); return; }
    if (error) { setValidationError(error); return; }
    setValidationError('');
    await onCreate(caseName.trim(), current, autoScenarioId);
  };

  const optionsForField = (tableName: string) => tables.find(table => table.name === tableName)?.columns ?? [];
  return (
    <div className="schema-studio-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="schema-studio" role="dialog" aria-modal="true" aria-labelledby="schema-studio-title">
        <header className="schema-studio-header">
          <div className="schema-studio-mark"><Table2 size={20} /></div>
          <div><span className="eyebrow">RECONSTRUCTION SETUP</span><h2 id="schema-studio-title">Define the target relational schema</h2><p>LAZARUS-X does not guess your whole database format. Tell it the relations and constraints that evidence must satisfy.</p></div>
          <button type="button" className="icon-button" aria-label="Close schema studio" onClick={onClose} disabled={busy}><X size={18} /></button>
        </header>
        <div className="schema-studio-body custom-scrollbar">
          <div className="schema-studio-intro"><strong>Steps</strong><span>1. Choose record types</span><ArrowRight size={13}/><span>2. Add source records</span><ArrowRight size={13}/><span>3. Review possible answers</span><ArrowRight size={13}/><span>4. Check case history</span></div>
          <p className="schema-studio-boundary-note">Choose the kinds of records you want to compare. For a government case, use the ready-made government record recovery option; you do not need to design anything yourself.</p>
          <div className="schema-studio-fields">
            <label>Case name<input value={caseName} maxLength={100} onChange={event => setCaseName(event.target.value)} placeholder="e.g. Kolar birth record" /></label>
            <label>Record set name<input value={schemaName} maxLength={100} onChange={event => setSchemaName(event.target.value)} placeholder="e.g. Government birth records" /></label>
            <label>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sparkles size={13} style={{ color: '#3b82f6' }} /> Fill with a ready-made example
              </span>
              <select
                aria-label="Auto-populate with sample evidence"
                value={autoScenarioId}
                onChange={event => {
                  const val = event.target.value;
                  setAutoScenarioId(val);
                  if (val !== 'none') {
                    const scenario = divyank24BCE0793_EXAMPLE_SCENARIOS.find(s => s.id === val);
                    if (scenario) {
                      switchPreset(scenario.preset);
                      setCaseName(`${scenario.title} · Reconstruction`);
                    }
                  }
                }}
              >
                <option value="none">No example (start empty)</option>
                <optgroup label="Government Record Recovery">
                  <option value="gov-birth-register">A) Damaged birth register — Kolar</option>
                </optgroup>
                <optgroup label="Incident Response Scenarios">
                  <option value="ir-clean">B) Clean cyber case</option>
                  <option value="ir-out-of-order">C) Records arrive later</option>
                  <option value="ir-name-conflict">D) Two names for one person</option>
                  <option value="ir-unique-clash">E) Same record number used twice</option>
                  <option value="ir-multi-incident-cascade">H) Large cyber case</option>
                </optgroup>
                <optgroup label="Workforce & Orders Scenarios">
                  <option value="wf-clean">E) Clean staff and purchase case</option>
                  <option value="wf-missing-parent">F) Employee record is missing</option>
                  <option value="wf-amount-conflict">G) Two amounts for one purchase</option>
                  <option value="wf-multi-dept-enterprise">I) Large purchase case</option>
                </optgroup>
              </select>
            </label>
          </div>
          <fieldset className="schema-template-picker"><legend>Start from a template</legend>
            <label><input type="radio" name="schema-preset" checked={preset === 'government-record-recovery'} onChange={() => switchPreset('government-record-recovery')}/><span><strong>Government record recovery</strong><small>Best choice for damaged birth, identity, and office records.</small></span></label>
            <label><input type="radio" name="schema-preset" checked={preset === 'incident-response'} onChange={() => switchPreset('incident-response')}/><span><strong>Cyber records</strong><small>Incident response records for devices, incidents, files, and technical reports.</small></span></label>
            <label><input type="radio" name="schema-preset" checked={preset === 'workforce-orders'} onChange={() => switchPreset('workforce-orders')}/><span><strong>Work and purchase records</strong><small>For staff, departments, orders, and amounts.</small></span></label>
            <label><input type="radio" name="schema-preset" checked={preset === 'blank' || preset === 'custom'} onChange={() => switchPreset('blank')}/><span><strong>Make my own</strong><small>Start with one simple record type.</small></span></label>
          </fieldset>
          <div className="schema-studio-section-heading"><div><h3>Record types and fields</h3><p>These are the names and details that can be entered from source records.</p></div><button type="button" className="secondary-button" onClick={addTable} disabled={tables.length >= 20}><Plus size={14}/> Add record type</button></div>
          <div className="schema-definition-grid">
            {tables.map((table, tableIndex) => <article className="schema-definition-card" key={`${tableIndex}-${table.name}`}>
              <div className="schema-definition-card-head"><span className="schema-definition-index">{String(tableIndex + 1).padStart(2, '0')}</span><input aria-label={`Relation ${tableIndex + 1} name`} value={table.name} maxLength={63} onChange={event => { const previous = table.name; patchTable(tableIndex, { name: event.target.value }); if (previous !== event.target.value) setForeignKeys(current => current.map(fk => ({ ...fk, ...(fk.table === previous ? { table: event.target.value } : {}), ...(fk.targetTable === previous ? { targetTable: event.target.value } : {}) }))); setPreset('custom'); }} /><button type="button" className="icon-button schema-remove" title={`Remove ${table.name}`} aria-label={`Remove ${table.name}`} onClick={() => removeTable(tableIndex)} disabled={tables.length <= 1}><Trash2 size={14}/></button></div>
              <div className="schema-column-head"><span>Field</span><span>Type</span><span>Rules</span><span /></div>
              {table.columns.map((column, columnIndex) => <div className="schema-column-row" key={`${columnIndex}-${column.name}`}>
                <input aria-label={`${table.name} field ${columnIndex + 1} name`} value={column.name} maxLength={63} onChange={event => { const previous = column.name; const next = event.target.value; patchColumn(tableIndex, columnIndex, { name: next }); if (previous !== next) setForeignKeys(current => current.map(fk => ({ ...fk, ...(fk.table === table.name && fk.field === previous ? { field: next } : {}), ...(fk.targetTable === table.name && fk.targetField === previous ? { targetField: next } : {}) }))); setPreset('custom'); }} />
                <select aria-label={`${table.name}.${column.name} data type`} value={column.type} onChange={event => { patchColumn(tableIndex, columnIndex, { type: event.target.value as ColumnType }); setPreset('custom'); }}><option value="TEXT">Text</option><option value="NUMBER">Number</option><option value="BOOLEAN">Boolean</option><option value="ANY">Any scalar</option></select>
                <div className="schema-column-rules"><label title="The evidence engine records a NOT NULL constraint"><input type="checkbox" checked={!!column.required} onChange={event => { patchColumn(tableIndex, columnIndex, { required: event.target.checked }); setPreset('custom'); }}/> Required</label><label title="Marks this field as a candidate key; duplicate observed values create a uniqueness violation"><input type="checkbox" checked={!!column.unique} onChange={event => { patchColumn(tableIndex, columnIndex, { unique: event.target.checked }); setPreset('custom'); }}/> Unique</label></div>
                <button type="button" className="icon-button schema-remove-field" aria-label={`Remove field ${table.name}.${column.name}`} title="Remove field" onClick={() => removeColumn(tableIndex, columnIndex)} disabled={table.columns.length <= 1}><X size={13}/></button>
              </div>)}
              <button type="button" className="schema-add-field" onClick={() => addColumn(tableIndex)} disabled={table.columns.length >= 80}><Plus size={12}/> Add field</button>
            </article>)}
          </div>
          <div className="schema-studio-section-heading"><div><h3>Links between records <span className="legacy-term">(foreign-key relationships)</span></h3><p>These links help the app connect a person to a birth record, office, or source document.</p></div><button type="button" className="secondary-button" onClick={addForeignKey} disabled={tables.length < 2}><Plus size={14}/> Add link</button></div>
          <div className="foreign-key-list">
            {foreignKeys.map((fk, index) => <div className="foreign-key-row" key={`${index}-${fk.table}.${fk.field}`}>
              <select aria-label={`Relationship ${index + 1} source relation`} value={fk.table} onChange={event => { const targetTable = event.target.value; const field = optionsForField(targetTable)[0]?.name ?? ''; patchForeignKey(index, { table: targetTable, field }); setPreset('custom'); }}>
                {allTableNames.map(name => <option key={name}>{name}</option>)}
              </select>
              <select aria-label={`Relationship ${index + 1} source field`} value={fk.field} onChange={event => { patchForeignKey(index, { field: event.target.value }); setPreset('custom'); }}>
                {optionsForField(fk.table).map(column => <option key={column.name}>{column.name}</option>)}
              </select><ArrowRight size={15}/>
              <select aria-label={`Relationship ${index + 1} target relation`} value={fk.targetTable} onChange={event => { const targetTable = event.target.value; const targetField = optionsForField(targetTable)[0]?.name ?? ''; patchForeignKey(index, { targetTable, targetField }); setPreset('custom'); }}>
                {allTableNames.map(name => <option key={name}>{name}</option>)}
              </select>
              <select aria-label={`Relationship ${index + 1} target field`} value={fk.targetField} onChange={event => { patchForeignKey(index, { targetField: event.target.value }); setPreset('custom'); }}>
                {optionsForField(fk.targetTable).map(column => <option key={column.name}>{column.name}</option>)}
              </select>
              <button type="button" className="icon-button schema-remove" aria-label={`Remove relationship ${index + 1}`} onClick={() => setForeignKeys(current => current.filter((_, i) => i !== index))}><Trash2 size={14}/></button>
            </div>)}
            {foreignKeys.length === 0 && <p className="schema-empty-note">No foreign-key edges defined yet. Add one when a field references another relation.</p>}
          </div>
          {validationError && <p className="schema-validation-error" role="alert">{validationError}</p>}
          <div className="schema-studio-footer-note"><Check size={14}/> The case will store a version of this schema so the same constraints are used when it is reopened and the evidence ledger is replayed.</div>
        </div>
        <footer className="schema-studio-footer"><button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="primary-button" onClick={() => void submit()} disabled={busy}>{busy ? 'Creating case…' : 'Create reconstruction case'} <ArrowRight size={15}/></button></footer>
      </section>
    </div>
  );
}
