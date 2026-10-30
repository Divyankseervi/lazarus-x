import { divyank24BCE0793_EXAMPLE_SCENARIOS, type ExampleScenarioFragment } from './exampleScenarios';
import type { PresetId } from './schemaTypes';

export type CompleteCaseExperiment = {
  id: string;
  title: string;
  preset: PresetId;
  description: string;
  changedFact: string;
  baselineLabel: string;
  alternativeLabel: string;
  baselineEvidence: ExampleScenarioFragment[];
  alternativeEvidence: ExampleScenarioFragment[];
  confidenceSourceRef: string;
  baselineConfidence: number;
  alternativeConfidence: number;
};

const scenario = (id: string) => {
  const found = divyank24BCE0793_EXAMPLE_SCENARIOS.find(item => item.id === id);
  if (!found) throw new Error(`Missing demonstration scenario ${id}`);
  return found.evidence.map(item => ({ ...item }));
};

const birthRegisterRows = [
  ['Department', 1, 'id', 1], ['Department', 1, 'name', 'Municipal Administration'],
  ['GovernmentOffice', 1, 'id', 1], ['GovernmentOffice', 1, 'departmentId', 1], ['GovernmentOffice', 1, 'name', 'Kolar Municipal Registrar Office'], ['GovernmentOffice', 1, 'district', 'Kolar'], ['GovernmentOffice', 1, 'state', 'Karnataka'],
  ['Person', 1, 'id', 1], ['Person', 1, 'fullName', 'Anjali Kumari'], ['Person', 1, 'dateOfBirth', '14-08-1998'], ['Person', 1, 'village', 'Kolar'],
  ['BirthRecord', 1, 'id', 1], ['BirthRecord', 1, 'personId', 1], ['BirthRecord', 1, 'registrationNo', 'KLR-1998-00421'], ['BirthRecord', 1, 'registeredDate', '21-08-1998'],
  ['SourceDocument', 1, 'id', 1], ['SourceDocument', 1, 'documentType', 'Municipal birth register'], ['SourceDocument', 1, 'officeName', 'Kolar Municipal Registrar Office'], ['SourceDocument', 1, 'status', 'Water damaged, partially legible'],
  ['SourceObservation', 1, 'id', 1], ['SourceObservation', 1, 'sourceDocumentId', 1], ['SourceObservation', 1, 'personId', 1], ['SourceObservation', 1, 'fieldName', 'dateOfBirth'], ['SourceObservation', 1, 'observedValue', '14-08-1998'],
  ['ReviewDecision', 1, 'id', 1], ['ReviewDecision', 1, 'personId', 1], ['ReviewDecision', 1, 'status', 'Needs date review'], ['ReviewDecision', 1, 'reason', 'Compare original register against hospital copy'],
  ['CaseAssignment', 1, 'id', 1], ['CaseAssignment', 1, 'personId', 1], ['CaseAssignment', 1, 'officerName', 'Meera Rao'], ['CaseAssignment', 1, 'assignedDate', '2026-10-20'],
].map(([table, recordId, field, value]) => ({ table: String(table), recordId: Number(recordId), field: String(field), value: value as string | number, confidence: 0.9, sourceRef: `DEMO:${String(table).toUpperCase()}-REGISTER` }));

const primaryReadingSource = 'DEMO:PRIMARY-REGISTER-READING';
const secondaryReadingSource = 'DEMO:SECONDARY-SCHOOL-READING';
const birthRegister = birthRegisterRows.map(item =>
  item.table === 'Person' && item.field === 'dateOfBirth' || item.table === 'SourceObservation' && item.field === 'observedValue'
    ? { ...item, confidence: 0.9, sourceRef: primaryReadingSource }
    : { ...item },
);
const birthBaseline = [
  ...birthRegister,
  { table: 'Person', recordId: 1, field: 'dateOfBirth', value: '18-08-1998', confidence: 0.55, sourceRef: secondaryReadingSource },
];
const birthAlternative = [
  ...birthRegister.map(item =>
  item.table === 'Person' && item.field === 'dateOfBirth' || item.table === 'SourceObservation' && item.field === 'observedValue'
    ? { ...item, value: '18-08-1998' }
    : { ...item },
  ),
  { table: 'Person', recordId: 1, field: 'dateOfBirth', value: '14-08-1998', confidence: 0.55, sourceRef: secondaryReadingSource },
];

const incidentSource = 'DEMO:INCIDENT-PRIMARY-IDENTITY';
const incidentBaselineRows = scenario('ir-clean').map(item => item.table === 'Person' && item.recordId === 1 && item.field === 'name'
  ? { ...item, confidence: 0.9, sourceRef: incidentSource }
  : { ...item });
const incidentBaseline = [...incidentBaselineRows, { table: 'Person', recordId: 1, field: 'name', value: 'A. Rao', confidence: 0.55, sourceRef: 'DEMO:INCIDENT-SECONDARY-IDENTITY' }];
const incidentAlternative = [
  ...incidentBaselineRows.map(item => item.table === 'Person' && item.recordId === 1 && item.field === 'name' ? { ...item, value: 'A. Rao' } : { ...item }),
  { table: 'Person', recordId: 1, field: 'name', value: 'Asha Rao', confidence: 0.55, sourceRef: 'DEMO:INCIDENT-SECONDARY-IDENTITY' },
];
const workforceSource = 'DEMO:INVOICE-PRIMARY-AMOUNT';
const workforceBaselineRows = scenario('wf-clean').map(item => item.table === 'Order' && item.recordId === 1 && item.field === 'amount'
  ? { ...item, confidence: 0.9, sourceRef: workforceSource }
  : { ...item });
const workforceBaseline = [...workforceBaselineRows, { table: 'Order', recordId: 1, field: 'amount', value: 2750, confidence: 0.55, sourceRef: 'DEMO:RECEIPT-SECONDARY-AMOUNT' }];
const workforceAlternative = [
  ...workforceBaselineRows.map(item => item.table === 'Order' && item.recordId === 1 && item.field === 'amount' ? { ...item, value: 2750 } : { ...item }),
  { table: 'Order', recordId: 1, field: 'amount', value: 2500, confidence: 0.55, sourceRef: 'DEMO:RECEIPT-SECONDARY-AMOUNT' },
];

export const completeCaseExperiments: CompleteCaseExperiment[] = [
  {
    id: 'birth-date-dispute', title: 'Damaged birth-register recovery', preset: 'government-record-recovery',
    description: 'A complete synthetic municipal record chain: person, birth register, source scan, office, department, observation, review and assignment.',
    changedFact: 'The birth-date evidence conflicts: each dataset contains both dates, while the primary register reading and its confidence change between cases.',
    baselineLabel: 'Case A · primary register reads 14 August', alternativeLabel: 'Case B · primary register reads 18 August', baselineEvidence: birthBaseline, alternativeEvidence: birthAlternative,
    confidenceSourceRef: primaryReadingSource, baselineConfidence: 0.9, alternativeConfidence: 0.9,
  },
  {
    id: 'cyber-name-dispute', title: 'Incident-response identity check', preset: 'incident-response',
    description: 'A complete incident chain: analysts, devices, incident, artifact hash and observation.',
    changedFact: 'The two identity readings remain in each dataset; the primary analyst reading changes from “Asha Rao” to “A. Rao”. All device and incident links stay the same.',
    baselineLabel: 'Case A · analyst says Asha Rao', alternativeLabel: 'Case B · analyst says A. Rao', baselineEvidence: incidentBaseline, alternativeEvidence: incidentAlternative,
    confidenceSourceRef: incidentSource, baselineConfidence: 0.9, alternativeConfidence: 0.9,
  },
  {
    id: 'purchase-amount-dispute', title: 'Purchase-order amount check', preset: 'workforce-orders',
    description: 'A complete department, employee and order dataset with valid foreign-key links.',
    changedFact: 'The invoice and receipt amounts conflict in both datasets; the primary invoice reading changes from ₹2,500 to ₹2,750. Staff and ownership stay the same.',
    baselineLabel: 'Case A · invoice says ₹2,500', alternativeLabel: 'Case B · invoice says ₹2,750', baselineEvidence: workforceBaseline, alternativeEvidence: workforceAlternative,
    confidenceSourceRef: workforceSource, baselineConfidence: 0.9, alternativeConfidence: 0.9,
  },
];
