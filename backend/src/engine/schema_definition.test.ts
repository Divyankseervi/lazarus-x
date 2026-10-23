import assert from 'node:assert/strict';
import { INCIDENT_RESPONSE_SCHEMA, LEGACY_COMPAT_SCHEMA, normalizeSchemaDefinition } from './schema_definition';
import { LazarusXEngine, EvidenceValidationError } from './lazarus';

const schema = normalizeSchemaDefinition(INCIDENT_RESPONSE_SCHEMA);
assert.equal(schema.tables.length, 5);
assert.equal(schema.constraints.filter(constraint => constraint.type === 'FOREIGN_KEY').length, 5);

const engine = new LazarusXEngine(schema);
engine.processEvidence([{ id: 'valid-fragment', table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 0.8, sourceRef: 'manifest-01', sourceSha256: 'A'.repeat(64) }]);
assert.equal(engine.getBestState().data.Person?.[0]?.name, 'Asha Rao');
const acceptedPayload = JSON.parse(engine.getProvenanceEntries()[0]!.payload) as Record<string, unknown>;
assert.equal(acceptedPayload.sourceRef, 'manifest-01');
assert.equal(acceptedPayload.sourceSha256, 'a'.repeat(64));
assert.throws(() => new LazarusXEngine(schema).processEvidence([{ id: 'bad-source-hash', table: 'Person', recordId: 1, field: 'name', value: 'Asha', sourceSha256: 'not-a-sha256' }]), EvidenceValidationError);
assert.throws(() => new LazarusXEngine(schema).processEvidence([{ id: 'negative-record-id', table: 'Person', recordId: -1, field: 'name', value: 'Asha' }]), /non-negative/);
assert.throws(() => new LazarusXEngine(schema).processEvidence([{ id: 'bad-field', table: 'Person', recordId: 1, field: 'badge', value: '101' }]), EvidenceValidationError);
assert.throws(() => new LazarusXEngine(schema).processEvidence([{ id: 'bad-type', table: 'Person', recordId: 1, field: 'id', value: '1' }]), EvidenceValidationError);
assert.throws(() => normalizeSchemaDefinition({
    name: 'bad', preset: 'custom', tables: ['Record', 'Record'], tableDefinitions: [
        { name: 'Record', columns: [{ name: 'id', type: 'NUMBER' }] },
        { name: 'Record', columns: [{ name: 'id', type: 'NUMBER' }] },
    ], constraints: [],
}), /unique/i);
const mismatchedForeignKey = JSON.parse(JSON.stringify(INCIDENT_RESPONSE_SCHEMA)) as typeof INCIDENT_RESPONSE_SCHEMA;
mismatchedForeignKey.tableDefinitions![1]!.columns.find(column => column.name === 'ownerId')!.type = 'TEXT';
assert.throws(() => normalizeSchemaDefinition(mismatchedForeignKey), /type mismatch/i);
const nonUniqueTarget = JSON.parse(JSON.stringify(INCIDENT_RESPONSE_SCHEMA)) as typeof INCIDENT_RESPONSE_SCHEMA;
nonUniqueTarget.tableDefinitions![0]!.columns.find(column => column.name === 'id')!.unique = false;
nonUniqueTarget.tableDefinitions![0]!.columns.push({ name: 'personKey', type: 'TEXT', unique: true });
nonUniqueTarget.constraints = nonUniqueTarget.constraints.filter(constraint => !(constraint.type === 'UNIQUE' && constraint.table === 'Person' && constraint.field === 'id'));
assert.throws(() => normalizeSchemaDefinition(nonUniqueTarget), /must be marked unique/i);

// Existing cases without a saved schema remain replayable with their historical,
// permissive demo schema and do not suddenly reject legacy undeclared fields.
const legacyEngine = new LazarusXEngine(LEGACY_COMPAT_SCHEMA);
legacyEngine.processEvidence([{ id: 'legacy-fragment', table: 'Department', recordId: 1, field: 'legacyExtraField', value: 'kept' }]);
assert.equal(legacyEngine.getBestState().data.Department?.[0]?.legacyExtraField, 'kept');

console.log('PASS schema definitions: normalization, typed evidence, declared field enforcement, key/FK type validation, source metadata commitments, legacy replay compatibility');
