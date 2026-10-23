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
  {
    id: 'ir-multi-incident-cascade',
    title: 'Enterprise breach cascade (14 records, 5 relations)',
    description: 'Comprehensive enterprise APT breach: 4 personnel, 3 servers/workstations, 2 incidents, 3 forensic artifacts, and 3 analyst observations.',
    preset: 'incident-response',
    learningGoal: 'Demonstrate deep multi-table relational foreign-key resolution across 14 interconnected records with 0 violations.',
    expected: {
      survivingInterpretations: 1,
      note: '1 surviving interpretation, entropy 0.000, 0 violations across 14 records in 5 relations.',
    },
    evidence: [
      { table: 'Person', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 1, field: 'role', value: 'Lead Analyst', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 2, field: 'name', value: 'Ravi Kumar', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 2, field: 'role', value: 'Domain Administrator', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 3, field: 'name', value: 'Elena Rostova', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 3, field: 'role', value: 'Threat Intelligence', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 4, field: 'id', value: 4, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 4, field: 'name', value: 'Marcus Vance', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Person', recordId: 4, field: 'role', value: 'CISO', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 1, field: 'hostname', value: 'DC-01.CORP', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 1, field: 'ownerId', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 2, field: 'hostname', value: 'SRV-PAYROLL.INTERNAL', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 2, field: 'ownerId', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 3, field: 'hostname', value: 'WS-SEC-09.LOCAL', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Device', recordId: 3, field: 'ownerId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Incident', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Incident', recordId: 1, field: 'title', value: 'Kerberoasting & Ticket Forgery', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Incident', recordId: 1, field: 'severity', value: 'High', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Incident', recordId: 1, field: 'reportedBy', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Incident', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Incident', recordId: 2, field: 'title', value: 'Ransomware Staging on Backup Server', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Incident', recordId: 2, field: 'severity', value: 'Critical', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Incident', recordId: 2, field: 'reportedBy', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 1, field: 'sha256', value: 'c'.repeat(64), confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 1, field: 'incidentId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 2, field: 'sha256', value: 'd'.repeat(64), confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 2, field: 'incidentId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 3, field: 'sha256', value: 'e'.repeat(64), confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Artifact', recordId: 3, field: 'incidentId', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 1, field: 'artifactId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 1, field: 'analystId', value: 1, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 1, field: 'finding', value: 'Mimikatz ticket extraction detected in memory', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 2, field: 'artifactId', value: 2, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 2, field: 'analystId', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 2, field: 'finding', value: 'Cobalt Strike beacon traffic to 198.51.100.24', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 3, field: 'artifactId', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 3, field: 'analystId', value: 3, confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
      { table: 'Observation', recordId: 3, field: 'finding', value: 'Volume Shadow Copies deleted via vssadmin', confidence: 1, sourceRef: 'example:ir-multi-incident-cascade' },
    ],
  },
  {
    id: 'wf-multi-dept-enterprise',
    title: 'Enterprise supply chain & purchase orders (18 records, 3 relations)',
    description: 'Multi-department procurement hierarchy: 4 corporate departments, 6 staff members, and 8 purchase order transactions.',
    preset: 'workforce-orders',
    learningGoal: 'Demonstrate complex relational integrity, foreign-key fan-out, and multi-tier department hierarchy recovery.',
    expected: {
      survivingInterpretations: 1,
      note: '1 surviving interpretation, entropy 0.000, 0 violations across 18 records in 3 relations.',
    },
    evidence: [
      { table: 'Department', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Department', recordId: 1, field: 'name', value: 'Core Infrastructure', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Department', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Department', recordId: 2, field: 'name', value: 'Cyber Threat Operations', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Department', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Department', recordId: 3, field: 'name', value: 'Financial Audit & Compliance', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Department', recordId: 4, field: 'id', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Department', recordId: 4, field: 'name', value: 'Supply Chain & Procurement', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 1, field: 'name', value: 'Kiran Patel', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 1, field: 'departmentId', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 2, field: 'name', value: 'Lata Sharma', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 2, field: 'departmentId', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 3, field: 'name', value: 'David Chen', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 3, field: 'departmentId', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 4, field: 'id', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 4, field: 'name', value: 'Sarah Jenkins', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 4, field: 'departmentId', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 5, field: 'id', value: 5, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 5, field: 'name', value: 'Tariq Al-Mansoor', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 5, field: 'departmentId', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 6, field: 'id', value: 6, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 6, field: 'name', value: 'Ananya Gupta', confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Employee', recordId: 6, field: 'departmentId', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 1, field: 'id', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 1, field: 'amount', value: 14500, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 1, field: 'employeeId', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 2, field: 'id', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 2, field: 'amount', value: 8200, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 2, field: 'employeeId', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 3, field: 'id', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 3, field: 'amount', value: 32000, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 3, field: 'employeeId', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 4, field: 'id', value: 4, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 4, field: 'amount', value: 1200, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 4, field: 'employeeId', value: 1, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 5, field: 'id', value: 5, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 5, field: 'amount', value: 55000, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 5, field: 'employeeId', value: 3, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 6, field: 'id', value: 6, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 6, field: 'amount', value: 4300, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 6, field: 'employeeId', value: 2, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 7, field: 'id', value: 7, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 7, field: 'amount', value: 19800, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 7, field: 'employeeId', value: 5, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 8, field: 'id', value: 8, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 8, field: 'amount', value: 7600, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
      { table: 'Order', recordId: 8, field: 'employeeId', value: 6, confidence: 1, sourceRef: 'example:wf-multi-dept-enterprise' },
    ],
  },
];

export const exampleScenarios = divyank24BCE0793_EXAMPLE_SCENARIOS;
