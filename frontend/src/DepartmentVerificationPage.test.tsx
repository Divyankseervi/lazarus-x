import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { webcrypto } from 'node:crypto';
import { DepartmentVerificationPage } from './DepartmentVerificationPage';

const datasetDigest = '15b2fb220bca84b2283220b0e28e21ad37eaa391bc3e0cb2a03a7afea3678faa';
const checkResponse = {
  request: { table: 'Person', recordId: 1, field: 'dateOfBirth', departmentName: 'District Education Office', partnerField: 'birth_date', purpose: 'Resolve a source conflict' },
  existingValues: ['14-08-1998', '18-08-1998'],
  response: { departmentName: 'District Education Office', field: 'dateOfBirth', partnerField: 'birth_date', value: '14-08-1998', sourceReference: 'school-export.csv', sourceVersion: '2026-Q3', sourceMode: 'USER_SUPPLIED_PARTNER_EXTRACT', departmentAuthenticated: false, matchStatus: 'MATCHES_AN_EXISTING_READING' },
  receipt: { requestId: 'audit-1', requestedAt: '2026-10-28T12:00:00.000Z', caseProvenanceSequence: 5, responseDigest: 'e'.repeat(64), datasetDigest, auditLogged: true },
  committed: false,
};

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  sessionStorage.setItem('lazarus-x-token', 'a'.repeat(64));
  window.history.replaceState({}, '', '/department-verification?case=case-1');
  globalThis.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      name: 'Kolar synthetic case',
      schemaDefinition: { tableDefinitions: [{ name: 'Person', columns: [{ name: 'id', type: 'NUMBER' }, { name: 'dateOfBirth', type: 'TEXT' }] }] },
      bestState: { data: { Person: [{ _recordId: 1, dateOfBirth: '14-08-1998' }] }, fatalViolations: 0, resolvableViolations: 0 },
      recentEvidence: [
        { id: 'e0', table: 'Person', recordId: 1, field: 'id', value: 1, sourceRef: 'register' },
        { id: 'e1', table: 'Person', recordId: 1, field: 'dateOfBirth', value: '14-08-1998', sourceRef: 'civil-copy' },
        { id: 'e2', table: 'Person', recordId: 1, field: 'dateOfBirth', value: '18-08-1998', sourceRef: 'school-copy' },
      ],
    }) })
    .mockResolvedValueOnce({ ok: true, json: async () => checkResponse })
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      before: { bestState: { data: { Person: [{ _recordId: 1, dateOfBirth: '14-08-1998' }] }, fatalViolations: 0, resolvableViolations: 0 }, candidateCount: 2 },
      after: { bestState: { data: { Person: [{ _recordId: 1, dateOfBirth: '14-08-1998' }] }, fatalViolations: 0, resolvableViolations: 0 }, candidateCount: 1 },
      committed: false,
    }) });
});

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); });

describe('Interdepartmental verification page', () => {
  it('runs a labeled synthetic demo without requiring an external department file', async () => {
    render(<DepartmentVerificationPage />);
    await screen.findByRole('heading', { name: 'Kolar synthetic case' });
    expect(screen.getByRole('button', { name: /check this department record/i })).toBeDisabled();
    expect(screen.getByText(/check button activates after you load the synthetic demo/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /load synthetic demo/i }));
    await waitFor(() => expect(document.querySelector('.department-file-status')?.textContent).toMatch(/1 row loaded as synthetic demo/i));
    expect(screen.getByLabelText('Department name')).toHaveValue('District Registry (synthetic demo)');
    expect(screen.getByLabelText('Partner key column')).toHaveValue('case_key');
    expect(screen.getByLabelText('Partner column to check')).toHaveValue('verified_value');

    fireEvent.click(screen.getByRole('button', { name: /check this department record/i }));
    const result = await screen.findByRole('region', { name: 'Department verification result' });
    expect(within(result).getByText(/exact key matched one row/i)).toBeInTheDocument();
    const checkCall = vi.mocked(globalThis.fetch).mock.calls[1];
    const body = JSON.parse(String((checkCall?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({ value: '14-08-1998', partnerValue: 1, departmentName: 'District Registry (synthetic demo)', sourceReference: 'Synthetic classroom demo — not an official record' });
    expect(body).not.toHaveProperty('datasetRows');
  });

  it('matches arbitrary imported rows, sends only the selected key/value, and previews without committing', async () => {
    render(<DepartmentVerificationPage />);
    await screen.findByRole('heading', { name: 'Kolar synthetic case' });
    expect(screen.getByLabelText('Disputed field')).toHaveValue(JSON.stringify(['Person', 1, 'dateOfBirth']));
    fireEvent.change(screen.getByLabelText('Department name'), { target: { value: 'District Education Office' } });

    const file = new File(['person_no,birth_date,notes\n1,14-08-1998,full row stays local'], 'school-export.csv', { type: 'text/csv' });
    Object.defineProperty(file, 'text', { value: async () => 'person_no,birth_date,notes\n1,14-08-1998,full row stays local' });
    fireEvent.change(screen.getByLabelText('Partner source file'), { target: { files: [file] } });
    await screen.findByText(/1 row loaded locally/);
    fireEvent.click(screen.getByRole('button', { name: /check this department record/i }));

    const result = await screen.findByRole('region', { name: 'Department verification result' });
    expect(within(result).getByText('14-08-1998')).toBeInTheDocument();
    expect(within(result).getByText(/matches a source/i)).toBeInTheDocument();
    expect(within(result).getByText(/Request audit-1/)).toBeInTheDocument();
    fireEvent.click(within(result).getByRole('button', { name: /preview reconstruction impact/i }));

    const preview = await screen.findByRole('region', { name: 'Department response reconstruction preview' });
    expect(within(preview).getByText('2 → 1')).toBeInTheDocument();
    expect(within(preview).getByText(/nothing saved/i)).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(3));
    const checkCall = vi.mocked(globalThis.fetch).mock.calls[1];
    expect(String(checkCall?.[0])).toContain('/cases/case-1/department-verifications');
    const body = JSON.parse(String((checkCall?.[1] as RequestInit).body)) as Record<string, unknown>;
    expect(body).toMatchObject({ table: 'Person', recordId: 1, field: 'dateOfBirth', departmentName: 'District Education Office', partnerField: 'birth_date', value: '14-08-1998' });
    expect(body).toHaveProperty('datasetDigest', datasetDigest);
    expect(body).toHaveProperty('partnerValue', '1');
    expect(body).toHaveProperty('matchKey', { caseField: 'id', caseValue: 1, partnerKeyField: 'person_no' });
    expect(body).not.toHaveProperty('datasetRows');
    expect(JSON.stringify(body)).not.toContain('full row stays local');
  });
});
