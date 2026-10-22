const assert = require('assert');
import { LazarusXEngine } from './lazarus';
import { Schema } from './types';

const testSchema: Schema = {
    tables: ['Employee', 'Department'],
    constraints: [
        { type: 'FOREIGN_KEY', table: 'Employee', field: 'deptId', targetTable: 'Department', targetField: 'id', targetEvidenceComplete: true },
        { type: 'UNIQUE', table: 'Employee', field: 'badge' },
    ],
};

function runBranchingSuite() {
    console.log('=== PREDICTIVE FORENSIC BRANCHING & AUDIT TEST SUITE ===\n');

    // TEST 1: Ambiguous Evidence and Shannon Information Gain
    console.log('TEST 1: Ambiguous Evidence and Shannon Information Gain');
    {
        const engine = new LazarusXEngine(testSchema, 10);
        // Feed two conflicting badge values for employee 1
        engine.processEvidence([
            { id: 'ev1', table: 'Employee', recordId: 1, field: 'badge', value: 'B-100' },
            { id: 'ev2', table: 'Employee', recordId: 1, field: 'badge', value: 'B-200' },
        ]);

        assert.strictEqual(engine.states.length, 2, 'Should enumerate 2 candidate states');
        const recommendations = engine.rankNextEvidence(5);
        assert.ok(recommendations.length >= 1, 'Should produce at least one recommendation');

        const top = recommendations[0];
        assert.strictEqual(top.table, 'Employee');
        assert.strictEqual(top.recordId, 1);
        assert.strictEqual(top.field, 'badge');
        assert.strictEqual(top.expectedInformationGain, 1, 'Expected IG should be 1 bit for 50/50 dispute');
        assert.strictEqual(top.candidateValues.length, 2, 'Should predict two candidate values');
        assert.strictEqual(top.candidateValues[0].probability, 0.5);
        assert.strictEqual(top.candidateValues[1].probability, 0.5);
        console.log('  [PASS] Correctly isolated disputed badge with 1.0 bit Shannon gain and 50/50 value predictions.');
    }

    // TEST 2: Multi-Field Ranking and Deterministic Tie-Breaking
    console.log('TEST 2: Multi-Field Ranking and Deterministic Tie-Breaking');
    {
        const engine = new LazarusXEngine(testSchema, 10);
        // Employee 1 has disputed badge ('B-1', 'B-2') AND disputed name ('Alice', 'Bob')
        // Both have equal entropy reduction (1 bit)
        engine.processEvidence([
            { id: 'b1', table: 'Employee', recordId: 1, field: 'badge', value: 'B-1' },
            { id: 'b2', table: 'Employee', recordId: 1, field: 'badge', value: 'B-2' },
            { id: 'n1', table: 'Employee', recordId: 1, field: 'name', value: 'Alice' },
            { id: 'n2', table: 'Employee', recordId: 1, field: 'name', value: 'Bob' },
        ]);

        assert.strictEqual(engine.states.length, 4, 'Should enumerate 4 candidate states');
        const recommendations = engine.rankNextEvidence(10);
        assert.strictEqual(recommendations.length, 2, 'Should rank both disputed fields');

        // Deterministic tie-breaker: table asc, recordId asc, field asc ('badge' < 'name')
        assert.strictEqual(recommendations[0].field, 'badge', 'Badge should precede name alphabetically');
        assert.strictEqual(recommendations[1].field, 'name');
        assert.strictEqual(recommendations[0].expectedInformationGain, 1);
        assert.strictEqual(recommendations[1].expectedInformationGain, 1);
        console.log('  [PASS] Deterministic alphabetical tie-breaking strictly obeyed (badge before name).');
    }

    // TEST 3: Asymmetric / Incomplete Records Conserve Probability Sum
    console.log('TEST 3: Asymmetric / Incomplete Records Conserve Probability Sum');
    {
        const engine = new LazarusXEngine(testSchema, 10);
        // In candidate A, employee 1 has phone; in candidate B, phone is not provided
        engine.processEvidence([
            { id: 'e1', table: 'Employee', recordId: 1, field: 'badge', value: 'B-1' },
            { id: 'e2', table: 'Employee', recordId: 1, field: 'badge', value: 'B-2' },
            { id: 'p1', table: 'Employee', recordId: 2, field: 'role', value: 'Engineer' },
            { id: 'p2', table: 'Employee', recordId: 2, field: 'role', value: 'Manager' },
        ]);

        const recommendations = engine.rankNextEvidence(5);
        for (const rec of recommendations) {
            const probSum = rec.candidateValues.reduce((s, v) => s + v.probability, 0);
            assert.ok(Math.abs(probSum - 1.0) < 1e-9, 'Probability sum must equal 1.0 exactly across all outcomes');
        }
        console.log('  [PASS] Bounded candidate distributions conserve sum(P) = 1.0.');
    }

    // TEST 4: Exhausted Ambiguity (Single Candidate) Returns Empty / Null
    console.log('TEST 4: Exhausted Ambiguity');
    {
        const engine = new LazarusXEngine(testSchema, 10);
        engine.processEvidence([
            { id: 'single1', table: 'Employee', recordId: 1, field: 'badge', value: 'B-999' },
            { id: 'single2', table: 'Employee', recordId: 1, field: 'name', value: 'Charlie' },
        ]);

        assert.strictEqual(engine.states.length, 1, 'Single candidate state');
        const rec = engine.recommendNextEvidence();
        assert.strictEqual(rec, null, 'recommendNextEvidence should return null when ambiguity is exhausted');
        const ranked = engine.rankNextEvidence(5);
        assert.strictEqual(ranked.length, 0, 'rankNextEvidence should return empty array');

        const diag = engine.getBranchingDiagnostics();
        assert.strictEqual(diag.exhausted, true, 'Diagnostics should indicate exhausted search space');
        assert.strictEqual(diag.priorEntropyBits, 0);
        console.log('  [PASS] Exhausted ambiguity cleanly diagnosed with 0 bits entropy and null recommendation.');
    }

    // TEST 5: Contradiction Fallback Diagnostics
    console.log('TEST 5: Contradiction Fallback Diagnostics');
    {
        const engine = new LazarusXEngine(testSchema, 10);
        // Two employees with identical badge -> UNIQUE fatal collision
        engine.processEvidence([
            { id: 'c1', table: 'Employee', recordId: 1, field: 'badge', value: 'B-COLLIDE' },
            { id: 'c2', table: 'Employee', recordId: 2, field: 'badge', value: 'B-COLLIDE' },
        ]);

        const diag = engine.getBranchingDiagnostics();
        assert.ok(diag.totalCandidateStates >= 1);
        console.log('  [PASS] Contradiction fallback state handled without crash.');
    }

    // TEST 6: Source-confidence weighting flows through candidate entropy and query ranking
    console.log('TEST 6: Source Confidence in Predictive Branching');
    {
        const engine = new LazarusXEngine(testSchema, 10);
        engine.processEvidence([
            { id: 'badge-a', table: 'Employee', recordId: 1, field: 'badge', value: 'B-100', confidence: 0.5 },
            { id: 'badge-b', table: 'Employee', recordId: 1, field: 'badge', value: 'B-200', confidence: 0.5 },
            { id: 'name-high', table: 'Employee', recordId: 1, field: 'name', value: 'Alice', confidence: 0.9 },
            { id: 'name-low', table: 'Employee', recordId: 1, field: 'name', value: 'Beatrice', confidence: 0.1 },
        ]);
        const recommendations = engine.rankNextEvidence(5);
        assert.strictEqual(recommendations.length, 2, 'both disputed fields should remain queryable');
        assert.strictEqual(recommendations[0].field, 'badge', 'equally weighted conflict should have greater residual information gain');
        assert.ok(recommendations[0].expectedInformationGain > recommendations[1].expectedInformationGain,
            'high-confidence evidence should narrow the name distribution and reduce its expected information gain');
        const namePrediction = recommendations.find(recommendation => recommendation.field === 'name')!;
        assert.ok(namePrediction.candidateValues[0]!.probability > namePrediction.candidateValues[1]!.probability,
            'higher source confidence should raise its predicted candidate value weight');
        console.log('  [PASS] Confidence-weighted candidate scores adjust value probabilities and evidence-query ranking.');
    }

    console.log('\nAll predictive forensic branching tests passed successfully!\n');
}

runBranchingSuite();
