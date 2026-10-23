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

    // Scenario H: Enterprise breach cascade (14 records, 5 relations)
    {
        name: 'Scenario H: Enterprise breach cascade (14 records, 5 relations)',
        run: () => {
            const engine = new LazarusXEngine(INCIDENT_RESPONSE_SCHEMA, 200);
            const fragments = [
                { id: '1', table: 'Person', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '2', table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '3', table: 'Person', recordId: 1, field: 'role', value: 'Lead Analyst', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '4', table: 'Person', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '5', table: 'Person', recordId: 2, field: 'name', value: 'Ravi Kumar', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '6', table: 'Person', recordId: 2, field: 'role', value: 'Domain Administrator', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '7', table: 'Person', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '8', table: 'Person', recordId: 3, field: 'name', value: 'Elena Rostova', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '9', table: 'Person', recordId: 3, field: 'role', value: 'Threat Intelligence', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '10', table: 'Person', recordId: 4, field: 'id', value: 4, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '11', table: 'Person', recordId: 4, field: 'name', value: 'Marcus Vance', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '12', table: 'Person', recordId: 4, field: 'role', value: 'CISO', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '13', table: 'Device', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '14', table: 'Device', recordId: 1, field: 'hostname', value: 'DC-01.CORP', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '15', table: 'Device', recordId: 1, field: 'ownerId', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '16', table: 'Device', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '17', table: 'Device', recordId: 2, field: 'hostname', value: 'SRV-PAYROLL.INTERNAL', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '18', table: 'Device', recordId: 2, field: 'ownerId', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '19', table: 'Device', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '20', table: 'Device', recordId: 3, field: 'hostname', value: 'WS-SEC-09.LOCAL', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '21', table: 'Device', recordId: 3, field: 'ownerId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '22', table: 'Incident', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '23', table: 'Incident', recordId: 1, field: 'title', value: 'Kerberoasting & Ticket Forgery', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '24', table: 'Incident', recordId: 1, field: 'severity', value: 'High', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '25', table: 'Incident', recordId: 1, field: 'reportedBy', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '26', table: 'Incident', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '27', table: 'Incident', recordId: 2, field: 'title', value: 'Ransomware Staging on Backup Server', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '28', table: 'Incident', recordId: 2, field: 'severity', value: 'Critical', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '29', table: 'Incident', recordId: 2, field: 'reportedBy', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '30', table: 'Artifact', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '31', table: 'Artifact', recordId: 1, field: 'sha256', value: 'c'.repeat(64), confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '32', table: 'Artifact', recordId: 1, field: 'incidentId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '33', table: 'Artifact', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '34', table: 'Artifact', recordId: 2, field: 'sha256', value: 'd'.repeat(64), confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '35', table: 'Artifact', recordId: 2, field: 'incidentId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '36', table: 'Artifact', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '37', table: 'Artifact', recordId: 3, field: 'sha256', value: 'e'.repeat(64), confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '38', table: 'Artifact', recordId: 3, field: 'incidentId', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '39', table: 'Observation', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '40', table: 'Observation', recordId: 1, field: 'artifactId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '41', table: 'Observation', recordId: 1, field: 'analystId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '42', table: 'Observation', recordId: 1, field: 'finding', value: 'Mimikatz ticket extraction detected in memory', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '43', table: 'Observation', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '44', table: 'Observation', recordId: 2, field: 'artifactId', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '45', table: 'Observation', recordId: 2, field: 'analystId', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '46', table: 'Observation', recordId: 2, field: 'finding', value: 'Cobalt Strike beacon traffic to 198.51.100.24', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '47', table: 'Observation', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '48', table: 'Observation', recordId: 3, field: 'artifactId', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '49', table: 'Observation', recordId: 3, field: 'analystId', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
                { id: '50', table: 'Observation', recordId: 3, field: 'finding', value: 'Volume Shadow Copies deleted via vssadmin', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
            ];
            engine.processEvidence(fragments);
            assert.equal(engine.states.length, 1, 'Should have exactly 1 candidate state');
            const best = engine.getBestState();
            assert.equal(best.fatalViolations, 0, 'Should have 0 fatal violations');
            assert.equal(best.resolvableViolations, 0, 'Should have 0 resolvable violations');
            assert.equal(best.probabilityScore, 1.0, 'Score should be 1.0');
            assert.equal(best.data['Person']?.length, 4, 'Should recover 4 Person records');
            assert.equal(best.data['Device']?.length, 3, 'Should recover 3 Device records');
            assert.equal(best.data['Incident']?.length, 2, 'Should recover 2 Incident records');
            assert.equal(best.data['Artifact']?.length, 3, 'Should recover 3 Artifact records');
            assert.equal(best.data['Observation']?.length, 3, 'Should recover 3 Observation records');
        },
    },

    // Scenario I: Enterprise supply chain & purchase orders (18 records, 3 relations)
    {
        name: 'Scenario I: Enterprise supply chain & purchase orders (18 records, 3 relations)',
        run: () => {
            const engine = new LazarusXEngine(LEGACY_DEMO_SCHEMA, 200);
            const fragments = [
                { id: '1', table: 'Department', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '2', table: 'Department', recordId: 1, field: 'name', value: 'Core Infrastructure', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '3', table: 'Department', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '4', table: 'Department', recordId: 2, field: 'name', value: 'Cyber Threat Operations', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '5', table: 'Department', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '6', table: 'Department', recordId: 3, field: 'name', value: 'Financial Audit & Compliance', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '7', table: 'Department', recordId: 4, field: 'id', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '8', table: 'Department', recordId: 4, field: 'name', value: 'Supply Chain & Procurement', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '9', table: 'Employee', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '10', table: 'Employee', recordId: 1, field: 'name', value: 'Kiran Patel', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '11', table: 'Employee', recordId: 1, field: 'departmentId', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '12', table: 'Employee', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '13', table: 'Employee', recordId: 2, field: 'name', value: 'Lata Sharma', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '14', table: 'Employee', recordId: 2, field: 'departmentId', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '15', table: 'Employee', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '16', table: 'Employee', recordId: 3, field: 'name', value: 'David Chen', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '17', table: 'Employee', recordId: 3, field: 'departmentId', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '18', table: 'Employee', recordId: 4, field: 'id', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '19', table: 'Employee', recordId: 4, field: 'name', value: 'Sarah Jenkins', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '20', table: 'Employee', recordId: 4, field: 'departmentId', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '21', table: 'Employee', recordId: 5, field: 'id', value: 5, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '22', table: 'Employee', recordId: 5, field: 'name', value: 'Tariq Al-Mansoor', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '23', table: 'Employee', recordId: 5, field: 'departmentId', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '24', table: 'Employee', recordId: 6, field: 'id', value: 6, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '25', table: 'Employee', recordId: 6, field: 'name', value: 'Ananya Gupta', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '26', table: 'Employee', recordId: 6, field: 'departmentId', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '27', table: 'Order', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '28', table: 'Order', recordId: 1, field: 'amount', value: 14500, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '29', table: 'Order', recordId: 1, field: 'employeeId', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '30', table: 'Order', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '31', table: 'Order', recordId: 2, field: 'amount', value: 8200, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '32', table: 'Order', recordId: 2, field: 'employeeId', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '33', table: 'Order', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '34', table: 'Order', recordId: 3, field: 'amount', value: 32000, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '35', table: 'Order', recordId: 3, field: 'employeeId', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '36', table: 'Order', recordId: 4, field: 'id', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '37', table: 'Order', recordId: 4, field: 'amount', value: 1200, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '38', table: 'Order', recordId: 4, field: 'employeeId', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '39', table: 'Order', recordId: 5, field: 'id', value: 5, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '40', table: 'Order', recordId: 5, field: 'amount', value: 55000, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '41', table: 'Order', recordId: 5, field: 'employeeId', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '42', table: 'Order', recordId: 6, field: 'id', value: 6, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '43', table: 'Order', recordId: 6, field: 'amount', value: 4300, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '44', table: 'Order', recordId: 6, field: 'employeeId', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '45', table: 'Order', recordId: 7, field: 'id', value: 7, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '46', table: 'Order', recordId: 7, field: 'amount', value: 19800, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '47', table: 'Order', recordId: 7, field: 'employeeId', value: 5, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '48', table: 'Order', recordId: 8, field: 'id', value: 8, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '49', table: 'Order', recordId: 8, field: 'amount', value: 7600, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
                { id: '50', table: 'Order', recordId: 8, field: 'employeeId', value: 6, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
            ];
            engine.processEvidence(fragments);
            assert.equal(engine.states.length, 1, 'Should have exactly 1 candidate state');
            const best = engine.getBestState();
            assert.equal(best.fatalViolations, 0, 'Should have 0 fatal violations');
            assert.equal(best.resolvableViolations, 0, 'Should have 0 resolvable violations');
            assert.equal(best.probabilityScore, 1.0, 'Score should be 1.0');
            assert.equal(best.data['Department']?.length, 4, 'Should recover 4 Department records');
            assert.equal(best.data['Employee']?.length, 6, 'Should recover 6 Employee records');
            assert.equal(best.data['Order']?.length, 8, 'Should recover 8 Order records');
        },
    },
];

for (const test of divyank24BCE0793_scenarioTests) {
    test.run();
    console.log(`[PASS] ${test.name}`);
}

console.log(`\nAll ${divyank24BCE0793_scenarioTests.length} example scenarios verified successfully against LazarusXEngine!`);
