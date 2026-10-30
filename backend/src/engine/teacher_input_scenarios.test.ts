import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EvidenceValidationError, LazarusXEngine } from './lazarus';
import { normalizeSchemaDefinition } from './schema_definition';
import type { Schema } from './types';

const teacherSchema = normalizeSchemaDefinition({
    name: 'Teacher coursework register',
    preset: 'custom',
    tables: ['Learner', 'Module', 'Assessment'],
    tableDefinitions: [
        { name: 'Learner', columns: [
            { name: 'id', type: 'NUMBER', required: true, unique: true },
            { name: 'fullName', type: 'TEXT', required: true },
        ] },
        { name: 'Module', columns: [
            { name: 'id', type: 'NUMBER', required: true, unique: true },
            { name: 'title', type: 'TEXT', required: true },
        ] },
        { name: 'Assessment', columns: [
            { name: 'id', type: 'NUMBER', required: true, unique: true },
            { name: 'learnerId', type: 'NUMBER', required: true },
            { name: 'moduleId', type: 'NUMBER', required: true },
            { name: 'score', type: 'NUMBER' },
        ] },
    ],
    constraints: [
        { type: 'UNIQUE', table: 'Learner', field: 'id' },
        { type: 'UNIQUE', table: 'Module', field: 'id' },
        { type: 'UNIQUE', table: 'Assessment', field: 'id' },
        { type: 'NOT_NULL', table: 'Learner', field: 'fullName' },
        { type: 'NOT_NULL', table: 'Module', field: 'title' },
        { type: 'FOREIGN_KEY', table: 'Assessment', field: 'learnerId', targetTable: 'Learner', targetField: 'id' },
        { type: 'FOREIGN_KEY', table: 'Assessment', field: 'moduleId', targetTable: 'Module', targetField: 'id' },
    ],
} as Schema);

test('teacher-defined relations accept new fields and preserve disagreeing source values', () => {
    const engine = new LazarusXEngine(teacherSchema, 100);
    engine.processEvidence([
        { id: 'a-1', table: 'Assessment', recordId: 1, field: 'id', value: 1, sourceRef: 'mark-sheet' },
        { id: 'a-2', table: 'Assessment', recordId: 1, field: 'learnerId', value: 7, sourceRef: 'mark-sheet' },
        { id: 'a-3', table: 'Assessment', recordId: 1, field: 'moduleId', value: 4, sourceRef: 'mark-sheet' },
        { id: 'a-4', table: 'Assessment', recordId: 1, field: 'score', value: 93, confidence: 0.9, sourceRef: 'signed-copy' },
        { id: 'a-5', table: 'Assessment', recordId: 1, field: 'score', value: 88, confidence: 0.6, sourceRef: 'transcribed-copy' },
        { id: 'l-1', table: 'Learner', recordId: 7, field: 'id', value: 7, sourceRef: 'enrollment-register' },
        { id: 'l-2', table: 'Learner', recordId: 7, field: 'fullName', value: 'Mira Shah', sourceRef: 'enrollment-register' },
        { id: 'm-1', table: 'Module', recordId: 4, field: 'id', value: 4, sourceRef: 'module-register' },
        { id: 'm-2', table: 'Module', recordId: 4, field: 'title', value: 'Database Systems', sourceRef: 'module-register' },
    ]);

    const best = engine.getBestState();
    assert.equal(best.data.Learner?.[0]?.fullName, 'Mira Shah');
    assert.equal(best.data.Module?.[0]?.title, 'Database Systems');
    assert.ok([88, 93].includes(Number(best.data.Assessment?.[0]?.score)));
    assert.ok(engine.states.length >= 2, 'competing source values remain as competing reconstructions');
    assert.equal(engine.getProvenanceEntries().length, 9);
});

test('out-of-order teacher values can be resolved when the referenced row arrives', () => {
    const engine = new LazarusXEngine(teacherSchema, 100);
    engine.processEvidence([{ id: 'child-first', table: 'Assessment', recordId: 8, field: 'learnerId', value: 27 }]);
    const before = engine.getBestState();
    assert.equal(before.data.Assessment?.[0]?.learnerId, 27);
    engine.processEvidence([
        { id: 'parent-id', table: 'Learner', recordId: 27, field: 'id', value: 27 },
        { id: 'parent-name', table: 'Learner', recordId: 27, field: 'fullName', value: 'Sam Lee' },
    ]);
    const after = engine.getBestState();
    assert.equal(after.data.Learner?.[0]?.fullName, 'Sam Lee');
    assert.ok(engine.getProvenanceEntries().length === 3);
});

test('teacher input is rejected for undeclared fields and wrong scalar types', () => {
    assert.throws(() => new LazarusXEngine(teacherSchema).processEvidence([
        { id: 'unknown', table: 'Learner', recordId: 1, field: 'homeAddress', value: 'not declared' },
    ]), EvidenceValidationError);
    assert.throws(() => new LazarusXEngine(teacherSchema).processEvidence([
        { id: 'wrong-type', table: 'Assessment', recordId: 1, field: 'score', value: 'ninety-three' },
    ]), EvidenceValidationError);
});

test('invalid teacher foreign-key definitions fail before case creation', () => {
    assert.throws(() => normalizeSchemaDefinition({
        ...teacherSchema,
        constraints: [
            { type: 'FOREIGN_KEY', table: 'Assessment', field: 'moduleId', targetTable: 'MissingRelation', targetField: 'id' },
        ],
    }), /target table|foreign key/i);
});
