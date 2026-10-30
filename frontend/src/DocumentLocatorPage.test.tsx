import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DocumentLocatorPage } from './DocumentLocatorPage';
import App from './App';

const sample = {
  id: 'location-1', departmentName: 'Kolar Taluk Hospital', officeName: 'Medical Records Office',
  documentName: 'Birth register · Volume 1998', referenceCode: 'KTH-BR-1998-017',
  sourceReference: 'example:hospital-register', storageLocation: 'Basement Archive · Cabinet B · Box 4',
  custodian: 'Medical Records Desk', contact: 'Extension 118', accessNotes: 'Request one day ahead.',
  status: 'IN_STORAGE', demoKey: 'kolar-hospital-register', lastVerifiedAt: '2026-10-28T00:00:00.000Z', updatedAt: '2026-10-28T00:00:00.000Z',
};

describe('DocumentLocatorPage', () => {
  beforeEach(() => {
    sessionStorage.setItem('lazarus-x-token', 'a'.repeat(64));
    window.history.replaceState({}, '', '/document-locator?q=example%3Ahospital-register&case=case-1');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ locations: [sample], total: 1 }) }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); sessionStorage.clear(); });

  it('opens as a standalone page and resolves a final report source reference to its office and shelf', async () => {
    render(<DocumentLocatorPage />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Document Locator' })).toBeInTheDocument();
    expect(screen.getAllByText('example:hospital-register')).toHaveLength(2);
    expect(screen.getByText('Kolar Taluk Hospital')).toBeInTheDocument();
    expect(screen.getByText('Medical Records Office')).toBeInTheDocument();
    expect(screen.getByText('Basement Archive · Cabinet B · Box 4')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to case/i })).toHaveAttribute('href', '/?case=case-1');
  });

  it('registers a physical source location from the top-level locator', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ locations: [] }) } as Response);
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ location: { ...sample, id: 'location-new', demoKey: null, documentName: 'Ward Register 2002' } }) } as Response);
    render(<DocumentLocatorPage />);
    await screen.findByRole('heading', { level: 1, name: 'Document Locator' });
    fireEvent.click(screen.getAllByRole('button', { name: /register a document/i })[0]!);
    fireEvent.change(screen.getByPlaceholderText('District Education Office'), { target: { value: 'District Archive' } });
    fireEvent.change(screen.getByPlaceholderText('Kolar Records Section'), { target: { value: 'Central Records Room' } });
    fireEvent.change(screen.getByPlaceholderText('Admission register · 1998'), { target: { value: 'Ward Register 2002' } });
    fireEvent.change(screen.getByPlaceholderText('Archive room · Rack · Shelf'), { target: { value: 'Room 4 · Rack B · Shelf 2' } });
    fireEvent.click(screen.getByRole('button', { name: /save location/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Ward Register 2002')).toBeInTheDocument();
    expect(screen.getByText('Document location saved to your directory.')).toBeInTheDocument();
  });

  it('is reachable directly at the top-level project route without a case parameter', async () => {
    window.history.replaceState({}, '', '/document-locator');
    render(<App />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Document Locator' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /project home/i })).toHaveAttribute('href', '/');
  });
});
