/**
 * LAZARUS-X Pre-Configured Example Scenarios
 * Educational and demonstration scenarios for empty cases.
 * 
 * Authored by: Divyank Seervi (24BCE0793)
 */

export type ExampleScenarioPreset = 'incident-response' | 'workforce-orders';

export interface ExampleScenarioFragment {
  table: string;
  recordId: number;
  field: string;
  value: string | number | boolean | null;
  confidence: number;
  sourceRef?: string;
  sourceSha256?: string;
}

export interface ExampleScenario {
  id: string;
  title: string;
  description: string;
  preset: ExampleScenarioPreset;
  learningGoal: string;
  expected: {
    survivingInterpretations: number;
    note: string;
  };
  evidence: ExampleScenarioFragment[];
}

export const divyank24BCE0793_EXAMPLE_SCENARIOS: ExampleScenario[] = [
  {
    id: 'ir-clean',
    title: 'Clean incident (no conflicts)',
    description: 'Complete, consistent incident response reconstruction with no conflicting observations.',
    preset: 'incident-response',
    learningGoal: 'See a complete, consistent reconstruction with single surviving interpretation.',
    expected: {
      survivingInterpretations: 1,
      note: '1 surviving interpretation, entropy 0.000, 0 violations.',
    },
    evidence: [
      { table: 'Person', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Person', recordId: 1, field: 'role', value: 'Analyst', confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Person', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Person', recordId: 2, field: 'name', value: 'Ravi Kumar', confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Person', recordId: 2, field: 'role', value: 'IT Admin', confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Device', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Device', recordId: 1, field: 'hostname', value: 'LAPTOP-07', confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Device', recordId: 1, field: 'ownerId', value: 2, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Incident', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Incident', recordId: 1, field: 'title', value: 'Phishing email', confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Incident', recordId: 1, field: 'severity', value: 'High', confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Incident', recordId: 1, field: 'reportedBy', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Artifact', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Artifact', recordId: 1, field: 'sha256', value: 'a'.repeat(64), confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Artifact', recordId: 1, field: 'incidentId', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Observation', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Observation', recordId: 1, field: 'artifactId', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Observation', recordId: 1, field: 'analystId', value: 1, confidence: 1, sourceRef: 'example:ir-clean' },
      { table: 'Observation', recordId: 1, field: 'finding', value: 'Malicious attachment found', confidence: 1, sourceRef: 'example:ir-clean' },
    ],
  },
  {
    id: 'ir-out-of-order',
    title: 'Out-of-order evidence (parent arrives late)',
    description: 'Child observations arrive before parent artifacts, incidents, and persons; foreign keys resolve monotonically.',
    preset: 'incident-response',
    learningGoal: 'Show unresolved foreign keys resolving later without premature pruning under open-world semantics.',
    expected: {
      survivingInterpretations: 1,
      note: 'After fragment 1 there are resolvable (not fatal) violations; after fragment 4 all links resolve; 1 surviving interpretation.',
    },
    evidence: [
      // 1. Observation 1
      { table: 'Observation', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Observation', recordId: 1, field: 'finding', value: 'Credential dump observed', confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Observation', recordId: 1, field: 'artifactId', value: 5, confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Observation', recordId: 1, field: 'analystId', value: 3, confidence: 1, sourceRef: 'example:ir-out-of-order' },
      // 2. Artifact 5
      { table: 'Artifact', recordId: 5, field: 'id', value: 5, confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Artifact', recordId: 5, field: 'sha256', value: 'b'.repeat(64), confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Artifact', recordId: 5, field: 'incidentId', value: 9, confidence: 1, sourceRef: 'example:ir-out-of-order' },
      // 3. Incident 9
      { table: 'Incident', recordId: 9, field: 'id', value: 9, confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Incident', recordId: 9, field: 'title', value: 'Lateral movement', confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Incident', recordId: 9, field: 'severity', value: 'Critical', confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Incident', recordId: 9, field: 'reportedBy', value: 3, confidence: 1, sourceRef: 'example:ir-out-of-order' },
      // 4. Person 3
      { table: 'Person', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Person', recordId: 3, field: 'name', value: 'Meera Nair', confidence: 1, sourceRef: 'example:ir-out-of-order' },
      { table: 'Person', recordId: 3, field: 'role', value: 'Responder', confidence: 1, sourceRef: 'example:ir-out-of-order' },
    ],
  },
  {
    id: 'ir-name-conflict',
    title: 'Conflicting name from a weaker source',
    description: 'Two competing name observations for Person 1 with differing source confidences (0.9 vs 0.4).',
    preset: 'incident-response',
    learningGoal: 'See competing hypotheses and the "next evidence" recommendation ranking.',
    expected: {
      survivingInterpretations: 2,
      note: '2 surviving interpretations, entropy > 0. Next-evidence tab recommends Person[1].name; top candidate keeps "Asha Rao".',
    },
    evidence: [
      { table: 'Person', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-name-conflict' },
      { table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 0.9, sourceRef: 'example:ir-name-conflict' },
      { table: 'Person', recordId: 1, field: 'role', value: 'Analyst', confidence: 0.9, sourceRef: 'example:ir-name-conflict' },
      { table: 'Person', recordId: 1, field: 'name', value: 'A. Rao', confidence: 0.4, sourceRef: 'example:ir-name-conflict:scan-2' },
      { table: 'Device', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-name-conflict' },
      { table: 'Device', recordId: 1, field: 'hostname', value: 'SRV-DB-01', confidence: 1, sourceRef: 'example:ir-name-conflict' },
      { table: 'Device', recordId: 1, field: 'ownerId', value: 1, confidence: 1, sourceRef: 'example:ir-name-conflict' },
    ],
  },
  {
    id: 'ir-unique-clash',
    title: 'Duplicate id (fatal violation)',
    description: 'Two distinct persons claiming the identical primary key ID, triggering a UNIQUE constraint penalty.',
    preset: 'incident-response',
    learningGoal: 'Show a UNIQUE violation lowering a candidate\'s probability score.',
    expected: {
      survivingInterpretations: 1,
      note: 'Engine reports 1 fatal violation for duplicate Person.id=1; score visibly lower than scenario A (0.01 vs 1.00).',
    },
    evidence: [
      { table: 'Person', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-unique-clash' },
      { table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 1, sourceRef: 'example:ir-unique-clash' },
      { table: 'Person', recordId: 2, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-unique-clash' },
      { table: 'Person', recordId: 2, field: 'name', value: 'Ravi Kumar', confidence: 1, sourceRef: 'example:ir-unique-clash' },
    ],
  },
  {
    id: 'wf-clean',
    title: 'Workforce and orders (clean)',
    description: 'Consistent enterprise organizational structure and purchase orders with matched foreign keys.',
    preset: 'workforce-orders',
    learningGoal: 'See a 3-table workforce schema resolve with 1 interpretation and zero violations.',
    expected: {
      survivingInterpretations: 1,
      note: '1 surviving interpretation, 0 violations, all foreign keys matched.',
    },
    evidence: [
      { table: 'Department', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Department', recordId: 1, field: 'name', value: 'Finance', confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Department', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Department', recordId: 2, field: 'name', value: 'Operations', confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Employee', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Employee', recordId: 1, field: 'name', value: 'Kiran', confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Employee', recordId: 1, field: 'departmentId', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Employee', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Employee', recordId: 2, field: 'name', value: 'Lata', confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Employee', recordId: 2, field: 'departmentId', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Order', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Order', recordId: 1, field: 'amount', value: 2500, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Order', recordId: 1, field: 'employeeId', value: 1, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Order', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Order', recordId: 2, field: 'amount', value: 1800, confidence: 1, sourceRef: 'example:wf-clean' },
      { table: 'Order', recordId: 2, field: 'employeeId', value: 2, confidence: 1, sourceRef: 'example:wf-clean' },
    ],
  },
  {
    id: 'wf-missing-parent',
    title: 'Order points to unknown employee',
    description: 'Order 1 references employee ID 7 which does not exist in the submitted employee evidence.',
    preset: 'workforce-orders',
    learningGoal: 'Understand open-world assumptions and resolvable foreign-key violations.',
    expected: {
      survivingInterpretations: 1,
      note: '1 surviving interpretation with 1 resolvable violation on Order.employeeId pointing to missing employee 7.',
    },
    evidence: [
      { table: 'Order', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-missing-parent' },
      { table: 'Order', recordId: 1, field: 'amount', value: 900, confidence: 1, sourceRef: 'example:wf-missing-parent' },
      { table: 'Order', recordId: 1, field: 'employeeId', value: 7, confidence: 1, sourceRef: 'example:wf-missing-parent' },
      { table: 'Employee', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-missing-parent' },
      { table: 'Employee', recordId: 1, field: 'name', value: 'Kiran', confidence: 1, sourceRef: 'example:wf-missing-parent' },
      { table: 'Employee', recordId: 1, field: 'departmentId', value: 1, confidence: 1, sourceRef: 'example:wf-missing-parent' },
      { table: 'Department', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-missing-parent' },
      { table: 'Department', recordId: 1, field: 'name', value: 'Finance', confidence: 1, sourceRef: 'example:wf-missing-parent' },
    ],
  },
  {
    id: 'wf-amount-conflict',
    title: 'Two amounts for one order',
    description: 'Conflicting values for Order 1 amount ($2500 vs $250) with asymmetrical confidence (0.9 vs 0.5).',
    preset: 'workforce-orders',
    learningGoal: 'Observe multi-candidate branching on numeric fields and recommendation targeting.',
    expected: {
      survivingInterpretations: 2,
      note: '2 surviving interpretations; recommendation targets Order[1].amount with higher confidence on 2500.',
    },
    evidence: [
      { table: 'Order', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-amount-conflict' },
      { table: 'Order', recordId: 1, field: 'employeeId', value: 1, confidence: 1, sourceRef: 'example:wf-amount-conflict' },
      { table: 'Order', recordId: 1, field: 'amount', value: 2500, confidence: 0.9, sourceRef: 'example:wf-amount-conflict' },
      { table: 'Order', recordId: 1, field: 'amount', value: 250, confidence: 0.5, sourceRef: 'example:wf-amount-conflict' },
      { table: 'Employee', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-amount-conflict' },
      { table: 'Employee', recordId: 1, field: 'name', value: 'Kiran', confidence: 1, sourceRef: 'example:wf-amount-conflict' },
    ],
  },
];

export const exampleScenarios = divyank24BCE0793_EXAMPLE_SCENARIOS;
