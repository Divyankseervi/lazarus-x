import { describe, expect, it } from 'vitest';
import { createPresetSchema, createWalkthroughEvidence, hasWalkthroughConflictTarget, validateCaseSchema } from './schemaTypes';

describe('case schema and synthetic reconstruction scenario', () => {
  it('ships an incident-response schema with explicit relations and foreign-key links', () => {
    const schema = createPresetSchema('incident-response');
    expect(schema.tables).toEqual(['Person', 'Device', 'Incident', 'Artifact', 'Observation']);
    expect(schema.constraints.filter(constraint => constraint.type === 'FOREIGN_KEY')).toHaveLength(5);
    expect(validateCaseSchema(schema)).toBeNull();
  });

  it('rejects duplicate relation names and dangling foreign keys', () => {
    const schema = createPresetSchema('workforce-orders');
    const duplicate = { ...schema, tableDefinitions: [...schema.tableDefinitions, { ...schema.tableDefinitions[0]! }] };
    expect(validateCaseSchema(duplicate)).toMatch(/unique/);
    const dangling = { ...schema, constraints: [...schema.constraints, { type: 'FOREIGN_KEY' as const, table: 'Employee', field: 'missing', targetTable: 'Department', targetField: 'id' }] };
    expect(validateCaseSchema(dangling)).toMatch(/source/);
  });

  it('generates linked synthetic fragments and at least one deliberate conflict', () => {
    const schema = createPresetSchema('incident-response');
    const fragments = createWalkthroughEvidence(schema);
    expect(fragments.length).toBeGreaterThan(10);
    expect(fragments.some(item => item.table === 'Device' && item.field === 'ownerId' && item.value === 1)).toBe(true);
    const names = fragments.filter(item => item.table === 'Person' && item.field === 'name').map(item => item.value);
    expect(names).toContain('Asha Rao');
    expect(names).toContain('A. Rao');
    const digest = fragments.find(item => item.table === 'Artifact' && item.field === 'sha256')?.value;
    expect(digest).toMatch(/^[a-f0-9]{64}$/); // placeholder format only; synthetic, not an artifact digest
    expect(fragments.every(item => schema.tables.includes(item.table))).toBe(true);
    const blank = createPresetSchema('blank');
    const blankFragments = createWalkthroughEvidence(blank);
    expect(blankFragments.filter(item => item.table === 'Record' && item.field === 'value')).toHaveLength(2);
    expect(blankFragments.every(item => item.sourceRef === 'synthetic-walkthrough')).toBe(true);
    const allUnique = { ...blank, tableDefinitions: [{ name: 'Record', columns: [{ name: 'id', type: 'NUMBER' as const, unique: true }] }], tables: ['Record'], constraints: [{ type: 'UNIQUE' as const, table: 'Record', field: 'id' }] };
    expect(hasWalkthroughConflictTarget(allUnique)).toBe(false);
  });
});
