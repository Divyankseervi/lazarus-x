import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { EvidenceExpiryLabPage } from './EvidenceExpiryLabPage';

const beforeState = { data: { Person: [{ _recordId: 1, id: 1, dateOfBirth: '14-08-1998' }] }, fatalViolations: 0, resolvableViolations: 0 };
const afterState = { data: { Person: [{ _recordId: 1, id: 1, dateOfBirth: '18-08-1998' }] }, fatalViolations: 0, resolvableViolations: 0 };
const previewResponse = {
  target: { sequence: 3, receivedAt: '2026-10-28T12:00:00.000Z', table: 'Person', recordId: 1, field: 'dateOfBirth', value: '14-08-1998', sourceRef: 'old register' },
  action: 'EXPIRE', baseline: { bestState: beforeState, candidateCount: 2, entropyBits: 1 },
  alternative: { bestState: afterState, candidateCount: 1, entropyBits: 0 },
  replacement: null, committed: false, persistedEvidenceUnchanged: true, provenanceSequence: 4,
};

beforeEach(() => {
  sessionStorage.setItem('lazarus-x-token', 'a'.repeat(64));
  window.history.replaceState({}, '', '/evidence-lifecycle?case=case-1');
  globalThis.fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({
      id: 'case-1', name: 'Kolar birth case', schemaDefinition: { tableDefinitions: [{ name: 'Person', columns: [{ name: 'id', type: 'NUMBER' }, { name: 'dateOfBirth', type: 'TEXT' }] }] },
      recentEvidence: [
        { id: 'e1', sequence: 1, table: 'Person', recordId: 1, field: 'id', value: 1, sourceRef: 'register', at: '2026-10-27T12:00:00.000Z' },
        { id: 'e2', sequence: 2, table: 'Person', recordId: 1, field: 'dateOfBirth', value: '14-08-1998', sourceRef: 'old register', at: '2026-10-27T12:01:00.000Z' },
        { id: 'e3', sequence: 3, table: 'Person', recordId: 1, field: 'dateOfBirth', value: '18-08-1998', sourceRef: 'hospital copy', at: '2026-10-28T12:00:00.000Z' },
      ],
    }) })
    .mockResolvedValueOnce({ ok: true, json: async () => previewResponse });
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });

describe('Evidence expiry and replacement lab', () => {
  it('compares a simulated expiry and keeps the case untouched', async () => {
    render(<EvidenceExpiryLabPage />);
    await screen.findByRole('heading', { name: 'Kolar birth case' });
    expect(screen.getByLabelText('Observation to change')).toHaveValue('2');
    fireEvent.click(screen.getByRole('button', { name: /simulate expiry and compare/i }));

    const comparison = await screen.findByRole('region', { name: 'Evidence lifecycle before and after comparison' });
    expect(within(comparison).getByText('2')).toBeInTheDocument();
    expect(within(comparison).getByText('1')).toBeInTheDocument();
    expect(within(comparison).getByText(/history preserved/i)).toBeInTheDocument();
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledTimes(2));
    const call = vi.mocked(globalThis.fetch).mock.calls[1];
    expect(String(call?.[0])).toContain('/cases/case-1/simulate-evidence-lifecycle');
    expect(JSON.parse(String((call?.[1] as RequestInit).body))).toEqual({ targetSequence: 2, action: 'EXPIRE' });
  });
});
