import { describe, it, expect } from 'vitest';
import { divyank24BCE0793_EXAMPLE_SCENARIOS, type ExampleScenario } from './exampleScenarios';
import { createPresetSchema } from './schemaTypes';

describe('LAZARUS-X Example Scenarios Validation (Divyank Seervi · 24BCE0793)', () => {
  const divyank24BCE0793_testScenarios: ExampleScenario[] = divyank24BCE0793_EXAMPLE_SCENARIOS;

  it('contains all 9 required scenarios with valid metadata', () => {
    expect(divyank24BCE0793_testScenarios).toHaveLength(9);
    const ids = divyank24BCE0793_testScenarios.map(s => s.id);
    expect(ids).toEqual([
      'ir-clean',
      'ir-out-of-order',
      'ir-name-conflict',
      'ir-unique-clash',
      'wf-clean',
      'wf-missing-parent',
      'wf-amount-conflict',
      'ir-multi-incident-cascade',
      'wf-multi-dept-enterprise',
    ]);
  });

  it('ensures all fragments adhere to strict schema typing, confidence, and sourceRef constraints', () => {
    for (const scenario of divyank24BCE0793_testScenarios) {
      expect(['incident-response', 'workforce-orders']).toContain(scenario.preset);
      const schema = createPresetSchema(scenario.preset);
      expect(scenario.evidence.length).toBeGreaterThan(0);
      expect(scenario.evidence.length).toBeLessThanOrEqual(50); // Well under batch limits

      for (const fragment of scenario.evidence) {
        // Table exists in preset
        const tableDef = schema.tableDefinitions.find(t => t.name === fragment.table);
        expect(tableDef, `Table ${fragment.table} not found in preset ${scenario.preset}`).toBeDefined();

        // Column exists in table
        const columnDef = tableDef!.columns.find(c => c.name === fragment.field);
        expect(columnDef, `Column ${fragment.field} not found in ${fragment.table}`).toBeDefined();

        // Value matches declared type
        if (fragment.value !== null) {
          if (columnDef!.type === 'NUMBER') {
            expect(typeof fragment.value, `${fragment.table}.${fragment.field} must be number`).toBe('number');
            expect(Number.isFinite(fragment.value)).toBe(true);
          } else if (columnDef!.type === 'TEXT') {
            expect(typeof fragment.value, `${fragment.table}.${fragment.field} must be string`).toBe('string');
          } else if (columnDef!.type === 'BOOLEAN') {
            expect(typeof fragment.value, `${fragment.table}.${fragment.field} must be boolean`).toBe('boolean');
          }
        }

        // Confidence in (0, 1]
        if (fragment.confidence !== undefined) {
          expect(fragment.confidence).toBeGreaterThan(0);
          expect(fragment.confidence).toBeLessThanOrEqual(1);
        }

        // sourceRef formatting
        expect(fragment.sourceRef).toBeDefined();
        expect(fragment.sourceRef!.length).toBeLessThanOrEqual(256);
        expect(fragment.sourceRef!.startsWith('example:')).toBe(true);
        // Printable ASCII
        for (let i = 0; i < fragment.sourceRef!.length; i++) {
          const code = fragment.sourceRef!.charCodeAt(i);
          expect(code).toBeGreaterThanOrEqual(32);
          expect(code).toBeLessThanOrEqual(126);
        }
      }
    }
  });

  it('validates that clean scenarios (0 violations) provide all required fields for each record', () => {
    const cleanScenarios = divyank24BCE0793_testScenarios.filter(s => s.expected.note.includes('0 violations'));
    expect(cleanScenarios.length).toBeGreaterThanOrEqual(2); // ir-clean and wf-clean

    for (const scenario of cleanScenarios) {
      const schema = createPresetSchema(scenario.preset);
      // Group fragments by table and recordId
      const records = new Map<string, Set<string>>();
      for (const f of scenario.evidence) {
        const key = `${f.table}:${f.recordId}`;
        if (!records.has(key)) records.set(key, new Set());
        records.get(key)!.add(f.field);
      }

      for (const [key, presentFields] of records.entries()) {
        const [tableName] = key.split(':');
        const tableDef = schema.tableDefinitions.find(t => t.name === tableName)!;
        const requiredColumns = tableDef.columns.filter(c => c.required).map(c => c.name);

        for (const req of requiredColumns) {
          expect(
            presentFields.has(req),
            `Scenario ${scenario.id} claims 0 violations but record ${key} is missing required field ${req}`
          ).toBe(true);
        }
      }
    }
  });
});
