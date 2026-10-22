declare var process: any;
/**
 * Diagnostic, deterministic exhaustive oracle for tiny Lazarus-X inputs.
 * Run from backend/: npx ts-node --files src/engine/oracle_test.ts
 *
 * This file deliberately does not call the engine's private constraint/scoring
 * methods. The private candidate pool is read only to diagnose pruning; all
 * expected candidates and constraint counts are built independently below.
 */
import { EvidenceValidationError, LazarusXEngine, SearchSpaceLimitError } from './lazarus';
import { CandidateState, Constraint, Evidence, Schema } from './types';

const schema: Schema = {
  tables: ['Parent', 'Child'],
  constraints: [
    { id: 'parent-id-unique', type: 'UNIQUE', table: 'Parent', field: 'id' },
    { id: 'parent-name-required', type: 'NOT_NULL', table: 'Parent', field: 'name' },
    { id: 'child-name-required', type: 'NOT_NULL', table: 'Child', field: 'name' },
    { id: 'child-parent-fk', type: 'FOREIGN_KEY', table: 'Child', field: 'parentId', targetTable: 'Parent', targetField: 'id' },
  ],
};

type PlainData = Record<string, Array<Record<string, any>>>;
type OracleCandidate = { data: PlainData; fatal: number; resolvable: number; sourceReliabilityPenalty: number; score: number };

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
function stable(value: unknown): string { return JSON.stringify(value); }
function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)); }

// Independent Cartesian enumeration: every distinct observed value for a field
// is a possible interpretation; records/fields absent from evidence stay absent.
function enumerateInterpretations(input: Evidence[], sch: Schema): OracleCandidate[] {
  const choices = new Map<string, { table: string; recordId: number; field: string; values: any[] }>();
  for (const ev of input) {
    const key = `${ev.table}\u0000${ev.recordId}\u0000${ev.field}`;
    if (!choices.has(key)) choices.set(key, { table: ev.table, recordId: ev.recordId, field: ev.field, values: [] });
    const c = choices.get(key)!;
    if (!c.values.some(v => stable(v) === stable(ev.value))) c.values.push(ev.value);
  }
  const ordered = [...choices.values()].sort((a, b) =>
    a.table.localeCompare(b.table) || a.recordId - b.recordId || a.field.localeCompare(b.field));
  let partial: PlainData[] = [sch.tables.reduce((acc, t) => { acc[t] = []; return acc; }, {} as any) as PlainData];
  for (const c of ordered) {
    const next: PlainData[] = [];
    for (const data of partial) for (const value of c.values) {
      const d = clone(data);
      let row = d[c.table].find(r => r._recordId === c.recordId);
      if (!row) { row = { _recordId: c.recordId }; d[c.table].push(row); }
      row[c.field] = value;
      next.push(d);
    }
    partial = next;
  }
  return partial.map(data => {
    let fatal = 0, resolvable = 0;
    for (const c of sch.constraints) {
      const rows = data[c.table] || [];
      if (c.type === 'NOT_NULL') {
        for (const row of rows) if (row[c.field] === null || row[c.field] === undefined) fatal++;
      } else if (c.type === 'UNIQUE') {
        const seen = new Set<any>();
        for (const row of rows) {
          const v = row[c.field];
          if (v !== undefined && v !== null) { if (seen.has(v)) fatal++; seen.add(v); }
        }
      } else if (c.type === 'FOREIGN_KEY') {
        const targets = data[c.targetTable!] || [];
        for (const row of rows) {
          const v = row[c.field];
          if (v !== undefined && v !== null && !targets.some(t => t[c.targetField!] === v)) resolvable++;
        }
      }
    }
    let sourceReliabilityPenalty = 0;
    for (const choice of ordered) {
      const observations = input.filter(ev => ev.table === choice.table && ev.recordId === choice.recordId && ev.field === choice.field);
      const totalConfidence = observations.reduce((sum, ev) => sum + (ev.confidence ?? 1), 0);
      const selectedValue = data[choice.table]!.find(row => row._recordId === choice.recordId)?.[choice.field];
      const selectedConfidence = observations
        .filter(ev => stable(ev.value) === stable(selectedValue))
        .reduce((sum, ev) => sum + (ev.confidence ?? 1), 0);
      if (totalConfidence > 0) sourceReliabilityPenalty += Math.max(0, totalConfidence - selectedConfidence) / totalConfidence;
    }
    return {
      data,
      fatal,
      resolvable,
      sourceReliabilityPenalty,
      score: 1 / (1 + fatal * 100 + resolvable + sourceReliabilityPenalty),
    };
  });
}

function engineStates(engine: LazarusXEngine): CandidateState[] {
  // Diagnostic-only inspection: the production class has no public candidate-list API.
  return ((engine as unknown as { states: CandidateState[] }).states || []).map(s => clone(s));
}
function violationTuple(c: { fatal?: number; resolvable?: number; fatalViolations?: number; resolvableViolations?: number }): string {
  const fatal = c.fatal ?? c.fatalViolations ?? 0;
  const resolvable = c.resolvable ?? c.resolvableViolations ?? 0;
  return `${fatal}/${resolvable}`;
}
function test(name: string, fn: () => void): void {
  try { fn(); console.log(`[PASS] ${name}`); }
  catch (e) { console.error(`[FAIL] ${name}: ${(e as Error).message}`); process.exitCode = 1; }
}
function ev(id: string, table: string, recordId: number, field: string, value: any): Evidence {
  return { id, table, recordId, field, value };
}
function compareBestToOracle(input: Evidence[], label: string): void {
  const engine = new LazarusXEngine(schema, 1000);
  engine.processEvidence(input);
  const actual = engine.getBestState();
  const oracle = enumerateInterpretations(input, schema).sort((a, b) => b.score - a.score);
  assert(actual, `${label}: engine returned no candidate`);
  assert(oracle.length > 0, `${label}: oracle returned no interpretation`);
  assert(violationTuple(actual) === violationTuple(oracle[0]),
    `${label}: best violation counts differ; engine=${violationTuple(actual)}, oracle=${violationTuple(oracle[0])}`);
  assert(Math.abs(actual.probabilityScore - oracle[0].score) < 1e-12,
    `${label}: heuristic score differs; engine=${actual.probabilityScore}, oracle=${oracle[0].score}`);
}

const parent = ev('e-parent', 'Parent', 1, 'id', 10);
const child = ev('e-child', 'Child', 7, 'parentId', 10);
const childName = ev('e-child-name', 'Child', 7, 'name', 'Ada');
const parentName = ev('e-parent-name', 'Parent', 1, 'name', 'P');

test('unambiguous evidence matches independent constraint oracle', () => {
  compareBestToOracle([parent, parentName, child, childName], 'unambiguous');
});
test('conflicting values enumerate both interpretations deterministically', () => {
  const input = [ev('e1', 'Child', 7, 'name', 'Ada'), ev('e2', 'Child', 7, 'name', 'Bea')];
  const oracle = enumerateInterpretations(input, schema);
  assert(oracle.length === 2, `expected 2 interpretations, got ${oracle.length}`);
  compareBestToOracle(input, 'conflicting field');
});
test('child-before-parent FK violation resolves when parent arrives', () => {
  const engine = new LazarusXEngine(schema, 1000);
  engine.processEvidence([child, childName]);
  assert(engine.getBestState().resolvableViolations === 1, 'expected one unresolved FK before parent');
  engine.processEvidence([parent, parentName]);
  assert(engine.getBestState().resolvableViolations === 0, 'expected FK to resolve after parent arrives');
  compareBestToOracle([child, childName, parent, parentName], 'out-of-order FK');
});
test('UNIQUE collision is counted independently as fatal', () => {
  const input = [ev('u1', 'Parent', 1, 'id', 44), ev('u2', 'Parent', 2, 'id', 44),
    ev('n1', 'Parent', 1, 'name', 'A'), ev('n2', 'Parent', 2, 'name', 'B')];
  const oracle = enumerateInterpretations(input, schema);
  assert(oracle.every(c => c.fatal >= 1), 'oracle failed to flag duplicate unique values');
  compareBestToOracle(input, 'unique collision');
});
test('best-state ordering follows the configured weighted penalty after an AC contradiction fallback', () => {
  const weightedSchema: Schema = {
    tables: ['Parent', 'Child'],
    constraints: [
        // This contradictory singleton pair forces the propagation fallback so
        // the test can still exercise weighted scoring of incompatible evidence.
        { id: 'parent-id-unique', type: 'UNIQUE', table: 'Parent', field: 'id' },
      { id: 'required-fk', type: 'NOT_NULL', table: 'Child', field: 'fk' },
      ...Array.from({ length: 101 }, (_, index) => ({
        id: `fk-${index}`,
        type: 'FOREIGN_KEY' as const,
        table: 'Child',
        field: 'fk',
        targetTable: 'Parent',
        targetField: 'id',
      })),
    ],
  };
  const engine = new LazarusXEngine(weightedSchema);
  engine.processEvidence([
    ev('null-fk', 'Child', 1, 'fk', null),
    ev('missing-fk', 'Child', 1, 'fk', 9),
    ev('duplicate-parent-a', 'Parent', 1, 'id', 1),
    ev('duplicate-parent-b', 'Parent', 2, 'id', 1),
  ]);
  const best = engine.getBestState();
  const other = engine.states.find(state => state.data.Child[0].fk === 9)!;
  assert(best.data.Child[0].fk === null, 'one additional fatal penalty should beat 101 additional resolvable penalties');
  assert(best.probabilityScore > other.probabilityScore, 'best state must have the highest configured score');
});
test('missing parent remains resolvable; later matching parent removes FK violation', () => {
  const engine = new LazarusXEngine(schema, 1000);
  engine.processEvidence([child, childName]);
  assert(engine.getBestState().resolvableViolations === 1, 'missing parent should be resolvable');
  engine.processEvidence([parent, parentName]);
  assert(engine.getBestState().resolvableViolations === 0, 'matching parent should resolve FK');
});
test('small evidence-order permutations preserve best constraint metrics', () => {
  const items = [parent, parentName, child, childName];
  const permutations: Evidence[][] = [items, [child, parent, childName, parentName], [parentName, childName, parent, child], [childName, parentName, child, parent]];
  const outcomes = permutations.map((p, i) => {
    const engine = new LazarusXEngine(schema, 1000); engine.processEvidence(p);
    const s = engine.getBestState();
    assert(s, `permutation ${i} returned no state`);
    return violationTuple(s);
  });
  assert(outcomes.every(v => v === outcomes[0]), `order-dependent best metrics: ${outcomes.join(', ')}`);
});
test('exact materialization retains every interpretation below its configured limit', () => {
  // Six disputed binary fields create 64 interpretations. topK is retained for
  // compatibility, but it no longer silently prunes exact candidate states.
  const input: Evidence[] = [];
  for (let i = 1; i <= 6; i++) {
    input.push(ev(`a${i}`, 'Child', 100 + i, 'name', `A${i}`));
    input.push(ev(`b${i}`, 'Child', 100 + i, 'name', `B${i}`));
  }
  const oracle = enumerateInterpretations(input, schema);
  const engine = new LazarusXEngine(schema, 1, 64); engine.processEvidence(input);
  const retained = engineStates(engine);
  const retainedKeys = new Set(retained.map(s => stable(s.data)));
  const lost = oracle.filter(c => !retainedKeys.has(stable(c.data))).length;
  assert(oracle.length === 64, `expected 64 oracle interpretations, got ${oracle.length}`);
  assert(retained.length === 64, `expected 64 retained candidates, got ${retained.length}`);
  assert(lost === 0, `expected all oracle interpretations to remain, lost ${lost}`);
});

test('over-limit evidence is rejected atomically instead of publishing a partial best state', () => {
  const input: Evidence[] = [];
  for (let i = 1; i <= 6; i++) {
    input.push(ev(`a${i}`, 'Child', 100 + i, 'name', `A${i}`));
    input.push(ev(`b${i}`, 'Child', 100 + i, 'name', `B${i}`));
  }
  const engine = new LazarusXEngine(schema, 1, 20);
  let thrown: unknown;
  try { engine.processEvidence(input); } catch (error) { thrown = error; }
  assert(thrown instanceof SearchSpaceLimitError, 'expected SearchSpaceLimitError for a 64-state space with a limit of 20');
  assert(engine.states.length === 1, 'failed batch should preserve the prior exact state');
  assert(engine.getBestState()!.data.Child.length === 0, 'failed batch should not partially commit evidence');

  engine.processEvidence([ev('after-reject', 'Child', 7, 'name', 'Ada')]);
  assert(engine.getBestState()!.data.Child[0].name === 'Ada', 'engine should accept a later within-limit batch');
});

test('oversized or non-scalar evidence batches are rejected before commit', () => {
  const engine = new LazarusXEngine(schema, 5, 100, 1_000, 1);
  let limitError: unknown;
  try {
    engine.processEvidence([
      ev('first', 'Child', 9, 'name', 'Ada'),
      ev('second', 'Child', 10, 'name', 'Bea')
    ]);
  } catch (error) { limitError = error; }
  assert(limitError instanceof SearchSpaceLimitError, 'expected oversized batch rejection');
  assert(engine.getBestState()!.data.Child.length === 0, 'oversized batch must not partially commit');

  let valueError: unknown;
  try { engine.processEvidence([ev('object', 'Child', 9, 'name', { nested: 'value' })]); } catch (error) { valueError = error; }
  assert(valueError instanceof EvidenceValidationError, 'expected non-scalar value rejection');
  assert(engine.getBestState()!.data.Child.length === 0, 'invalid value must not alter the current state');
});

test('prototype-like field names are safe and the internal locator is reserved', () => {
  const engine = new LazarusXEngine(schema, 5);
  engine.processEvidence([ev('proto', 'Child', 8, '__proto__', 'safe')]);
  const row = engine.getBestState()!.data.Child[0];
  assert(Object.prototype.hasOwnProperty.call(row, '__proto__'), '__proto__ evidence should become an own domain field');
  assert(row['__proto__'] === 'safe', 'prototype-like field value should be preserved');

  let thrown: unknown;
  try { engine.processEvidence([ev('locator', 'Child', 8, '_recordId', 99)]); } catch (error) { thrown = error; }
  assert(thrown instanceof EvidenceValidationError, 'internal locator field should be rejected');
  assert(engine.getBestState()!.data.Child[0]._recordId === 8, 'reserved locator must remain unchanged');
});


test('identity-collision prevention: domain id fields do not overwrite internal locators', () => {
  const inputOrder1 = [ev('id1', 'Parent', 1, 'id', 44), ev('name1', 'Parent', 1, 'name', 'A')];
  const inputOrder2 = [ev('name1', 'Parent', 1, 'name', 'A'), ev('id1', 'Parent', 1, 'id', 44)];
  
  const engine1 = new LazarusXEngine(schema, 1000);
  engine1.processEvidence(inputOrder1);
  const state1 = engine1.getBestState();
  assert(state1.data['Parent'].length === 1, 'Expected exactly 1 parent record in Order 1');
  assert(state1.data['Parent'][0].id === 44, 'Domain id should be 44 in Order 1');
  assert(state1.data['Parent'][0]._recordId === 1, 'Internal locator should be 1 in Order 1');

  const engine2 = new LazarusXEngine(schema, 1000);
  engine2.processEvidence(inputOrder2);
  const state2 = engine2.getBestState();
  assert(state2.data['Parent'].length === 1, 'Expected exactly 1 parent record in Order 2');
  assert(state2.data['Parent'][0].id === 44, 'Domain id should be 44 in Order 2');
  assert(state2.data['Parent'][0]._recordId === 1, 'Internal locator should be 1 in Order 2');
  
  compareBestToOracle(inputOrder1, 'locator collision order 1');
  compareBestToOracle(inputOrder2, 'locator collision order 2');
});

console.log('Oracle diagnostic complete. Scores are heuristic penalties, not calibrated probabilities.');
