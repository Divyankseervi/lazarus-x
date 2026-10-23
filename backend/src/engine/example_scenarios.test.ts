import assert from 'node:assert/strict';
import { LazarusXEngine } from './lazarus';
import { INCIDENT_RESPONSE_SCHEMA, LEGACY_DEMO_SCHEMA } from './schema_definition';
import { Evidence } from './types';

/**
 * LAZARUS-X Example Scenarios Engine Verification Suite
 * Authored by: Divyank Seervi (24BCE0793)
 */

console.log('=== LAZARUS-X PRE-CONFIGURED EXAMPLE SCENARIOS VERIFICATION ===\n');

const divyank24BCE0793_scenarioTests = [
    // Scenario A: Clean incident
    {
        name: 'Scenario A: Clean incident (no conflicts)',
        run: () => {
            const engine = new LazarusXEngine(INCIDENT_RESPONSE_SCHEMA, 100);
            const evidence: Evidence[] = [
                { id: '1', table: 'Person', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '2', table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '3', table: 'Person', recordId: 1, field: 'role', value: 'Analyst', confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '4', table: 'Person', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '5', table: 'Person', recordId: 2, field: 'name', value: 'Ravi Kumar', confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '6', table: 'Person', recordId: 2, field: 'role', value: 'IT Admin', confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '7', table: 'Device', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '8', table: 'Device', recordId: 1, field: 'hostname', value: 'LAPTOP-07', confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '9', table: 'Device', recordId: 1, field: 'ownerId', value: 2, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '10', table: 'Incident', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '11', table: 'Incident', recordId: 1, field: 'title', value: 'Phishing email', confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '12', table: 'Incident', recordId: 1, field: 'severity', value: 'High', confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '13', table: 'Incident', recordId: 1, field: 'reportedBy', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '14', table: 'Artifact', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '15', table: 'Artifact', recordId: 1, field: 'sha256', value: 'a'.repeat(64), confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '16', table: 'Artifact', recordId: 1, field: 'incidentId', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '17', table: 'Observation', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '18', table: 'Observation', recordId: 1, field: 'artifactId', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '19', table: 'Observation', recordId: 1, field: 'analystId', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
                { id: '20', table: 'Observation', recordId: 1, field: 'finding', value: 'Malicious attachment found', confidence: 1, sourceRef: 'example:ir-clean' },
            ];
            engine.processEvidence(evidence);
            assert.equal(engine.states.length, 1, 'Should produce exactly 1 surviving interpretation');
            const best = engine.getBestState();
            assert.equal(best.fatalViolations, 0, 'Should have 0 fatal violations');
            assert.equal(best.resolvableViolations, 0, 'Should have 0 resolvable violations');
            assert.equal(best.probabilityScore, 1.0, 'Score should be 1.0');
        },
    },

    // Scenario B: Out-of-order evidence
    {
        name: 'Scenario B: Out-of-order evidence (parent arrives late)',
        run: () => {
            const engine = new LazarusXEngine(INCIDENT_RESPONSE_SCHEMA, 100);
            // 1. Observation 1 arrives first
            engine.processEvidence([
                { id: '1', table: 'Observation', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '2', table: 'Observation', recordId: 1, field: 'finding', value: 'Credential dump observed', confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '3', table: 'Observation', recordId: 1, field: 'artifactId', value: 5, confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '4', table: 'Observation', recordId: 1, field: 'analystId', value: 3, confidence: 1, sourceRef: 'example:ir-out-of-order' },
            ]);
            const step1State = engine.getBestState();
            assert.equal(step1State.fatalViolations, 0, 'Step 1 should have 0 fatal violations');
            assert.equal(step1State.resolvableViolations, 2, 'Step 1 should have 2 resolvable violations (missing artifact 5, analyst 3)');

            // 2. Artifact 5 arrives
            engine.processEvidence([
                { id: '5', table: 'Artifact', recordId: 5, field: 'id', value: 5, confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '6', table: 'Artifact', recordId: 5, field: 'sha256', value: 'b'.repeat(64), confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '7', table: 'Artifact', recordId: 5, field: 'incidentId', value: 9, confidence: 1, sourceRef: 'example:ir-out-of-order' },
            ]);

            // 3. Incident 9 arrives
            engine.processEvidence([
                { id: '8', table: 'Incident', recordId: 9, field: 'id', value: 9, confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '9', table: 'Incident', recordId: 9, field: 'title', value: 'Lateral movement', confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '10', table: 'Incident', recordId: 9, field: 'severity', value: 'Critical', confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '11', table: 'Incident', recordId: 9, field: 'reportedBy', value: 3, confidence: 1, sourceRef: 'example:ir-out-of-order' },
            ]);

            // 4. Person 3 arrives (completing the dependency chain)
            engine.processEvidence([
                { id: '12', table: 'Person', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '13', table: 'Person', recordId: 3, field: 'name', value: 'Meera Nair', confidence: 1, sourceRef: 'example:ir-out-of-order' },
                { id: '14', table: 'Person', recordId: 3, field: 'role', value: 'Responder', confidence: 1, sourceRef: 'example:ir-out-of-order' },
            ]);

            assert.equal(engine.states.length, 1, 'Should conclude with 1 surviving interpretation');
            const finalState = engine.getBestState();
            assert.equal(finalState.fatalViolations, 0, 'Should resolve all fatal violations');
            assert.equal(finalState.resolvableViolations, 0, 'Should resolve all resolvable violations');
            assert.equal(finalState.probabilityScore, 1.0, 'Final score should reach 1.0');
        },
    },

    // Scenario C: Conflicting name from weaker source
    {
        name: 'Scenario C: Conflicting name from a weaker source',
        run: () => {
            const engine = new LazarusXEngine(INCIDENT_RESPONSE_SCHEMA, 100);
            engine.processEvidence([
                { id: '1', table: 'Person', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-name-conflict' },
                { id: '2', table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 0.9, sourceRef: 'example:ir-name-conflict' },
                { id: '3', table: 'Person', recordId: 1, field: 'role', value: 'Analyst', confidence: 0.9, sourceRef: 'example:ir-name-conflict' },
                { id: '4', table: 'Person', recordId: 1, field: 'name', value: 'A. Rao', confidence: 0.4, sourceRef: 'example:ir-name-conflict:scan-2' },
                { id: '5', table: 'Device', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-name-conflict' },
                { id: '6', table: 'Device', recordId: 1, field: 'hostname', value: 'SRV-DB-01', confidence: 1, sourceRef: 'example:ir-name-conflict' },
                { id: '7', table: 'Device', recordId: 1, field: 'ownerId', value: 1, confidence: 1, sourceRef: 'example:ir-name-conflict' },
            ]);
            assert.equal(engine.states.length, 2, 'Should branch into 2 surviving interpretations');
            const topCandidate = engine.getBestState();
            const topPerson = topCandidate.data['Person']?.find(p => p._recordId === 1);
            assert.equal(topPerson?.['name'], 'Asha Rao', 'Top candidate should prefer higher-confidence Asha Rao');

            const recommendations = engine.rankNextEvidence(1);
            assert.equal(recommendations.length, 1);
            assert.equal(recommendations[0].table, 'Person');
            assert.equal(recommendations[0].recordId, 1);
            assert.equal(recommendations[0].field, 'name');
            assert.ok(recommendations[0].expectedInformationGain > 0.9, 'Should have ~0.99 bits of expected information gain');
        },
    },

    // Scenario D: Duplicate id (fatal violation)
    {
        name: 'Scenario D: Duplicate id (fatal violation)',
        run: () => {
            const engine = new LazarusXEngine(INCIDENT_RESPONSE_SCHEMA, 100);
            engine.processEvidence([
                { id: '1', table: 'Person', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-unique-clash' },
                { id: '2', table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 1, sourceRef: 'example:ir-unique-clash' },
                { id: '3', table: 'Person', recordId: 2, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-unique-clash' },
                { id: '4', table: 'Person', recordId: 2, field: 'name', value: 'Ravi Kumar', confidence: 1, sourceRef: 'example:ir-unique-clash' },
            ]);
            assert.equal(engine.states.length, 1, 'Should retain 1 state under contradiction fallback');
            const best = engine.getBestState();
            assert.equal(best.fatalViolations, 1, 'Should detect 1 fatal UNIQUE violation');
            assert.ok(best.probabilityScore < 0.05, `Score (${best.probabilityScore}) should be dramatically lower than 1.0`);
        },
    },

    // Scenario E: Workforce clean
    {
        name: 'Scenario E: Workforce and orders (clean)',
        run: () => {
            const engine = new LazarusXEngine(LEGACY_DEMO_SCHEMA, 100);
            engine.processEvidence([
                { id: '1', table: 'Department', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '2', table: 'Department', recordId: 1, field: 'name', value: 'Finance', confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '3', table: 'Department', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '4', table: 'Department', recordId: 2, field: 'name', value: 'Operations', confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '5', table: 'Employee', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '6', table: 'Employee', recordId: 1, field: 'name', value: 'Kiran', confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '7', table: 'Employee', recordId: 1, field: 'departmentId', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '8', table: 'Employee', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '9', table: 'Employee', recordId: 2, field: 'name', value: 'Lata', confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '10', table: 'Employee', recordId: 2, field: 'departmentId', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '11', table: 'Order', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '12', table: 'Order', recordId: 1, field: 'amount', value: 2500, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '13', table: 'Order', recordId: 1, field: 'employeeId', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '14', table: 'Order', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '15', table: 'Order', recordId: 2, field: 'amount', value: 1800, confidence: 1, sourceRef: 'example:wf-clean' },
                { id: '16', table: 'Order', recordId: 2, field: 'employeeId', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
            ]);
            assert.equal(engine.states.length, 1, 'Should have 1 state');
            const best = engine.getBestState();
            assert.equal(best.fatalViolations, 0, 'Should have 0 fatal violations');
            assert.equal(best.resolvableViolations, 0, 'Should have 0 resolvable violations');
            assert.equal(best.probabilityScore, 1.0, 'Score should be 1.0');
        },
    },

    // Scenario F: Missing parent
    {
        name: 'Scenario F: Order points to unknown employee',
        run: () => {
            const engine = new LazarusXEngine(LEGACY_DEMO_SCHEMA, 100);
            engine.processEvidence([
                { id: '1', table: 'Order', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-missing-parent' },
                { id: '2', table: 'Order', recordId: 1, field: 'amount', value: 900, confidence: 1, sourceRef: 'example:wf-missing-parent' },
                { id: '3', table: 'Order', recordId: 1, field: 'employeeId', value: 7, confidence: 1, sourceRef: 'example:wf-missing-parent' },
                { id: '4', table: 'Employee', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-missing-parent' },
                { id: '5', table: 'Employee', recordId: 1, field: 'name', value: 'Kiran', confidence: 1, sourceRef: 'example:wf-missing-parent' },
                { id: '6', table: 'Employee', recordId: 1, field: 'departmentId', value: 1, confidence: 1, sourceRef: 'example:wf-missing-parent' },
                { id: '7', table: 'Department', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-missing-parent' },
                { id: '8', table: 'Department', recordId: 1, field: 'name', value: 'Finance', confidence: 1, sourceRef: 'example:wf-missing-parent' },
            ]);
            assert.equal(engine.states.length, 1, 'Should have 1 candidate state');
            const best = engine.getBestState();
            assert.equal(best.fatalViolations, 0, 'Should have 0 fatal violations');
            assert.equal(best.resolvableViolations, 1, 'Should have 1 resolvable violation on missing parent Employee 7');
            assert.equal(best.probabilityScore, 0.5, 'Score should be 0.5 (1 / (1 + 1))');
        },
    },

    // Scenario G: Two amounts for one order
    {
        name: 'Scenario G: Two amounts for one order',
        run: () => {
            const engine = new LazarusXEngine(LEGACY_DEMO_SCHEMA, 100);
            engine.processEvidence([
                { id: '1', table: 'Order', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-amount-conflict' },
                { id: '2', table: 'Order', recordId: 1, field: 'employeeId', value: 1, confidence: 1, sourceRef: 'example:wf-amount-conflict' },
                { id: '3', table: 'Order', recordId: 1, field: 'amount', value: 2500, confidence: 0.9, sourceRef: 'example:wf-amount-conflict' },
                { id: '4', table: 'Order', recordId: 1, field: 'amount', value: 250, confidence: 0.5, sourceRef: 'example:wf-amount-conflict' },
                { id: '5', table: 'Employee', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-amount-conflict' },
                { id: '6', table: 'Employee', recordId: 1, field: 'name', value: 'Kiran', confidence: 1, sourceRef: 'example:wf-amount-conflict' },
            ]);
            assert.equal(engine.states.length, 2, 'Should branch into 2 candidate states');
            const recommendation = engine.recommendNextEvidence();
            assert.ok(recommendation !== null, 'Should provide next-evidence recommendation');
            assert.equal(recommendation!.table, 'Order');
            assert.equal(recommendation!.recordId, 1);
            assert.equal(recommendation!.field, 'amount');
        },
    },
];

for (const test of divyank24BCE0793_scenarioTests) {
    test.run();
    console.log(`[PASS] ${test.name}`);
}

console.log(`\nAll 7 example scenarios verified successfully against LazarusXEngine!`);
