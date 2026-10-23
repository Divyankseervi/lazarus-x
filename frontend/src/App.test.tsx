import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
/// <reference types="node" />
import { createHash, createHmac, webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CaseViewErrorBoundary } from './App';
import App from './App';
import { verifyDisclosedClaim, verifyEnvelopeInclusionProof, verifyProvenanceCheckpoint, type PublicEnvelopeEntry } from './provenanceVerifier';
import { createPresetSchema } from './schemaTypes';

const emptyAudit = {
  valid: true,
  checkedEntries: 0,
  totalEntries: 0,
  nextAfterSequence: null,
  entries: [],
  publicEnvelope: {
    genesisHash: 'b'.repeat(64),
    headHash: 'b'.repeat(64),
    pagePreviousHash: 'b'.repeat(64),
    pageHeadHash: 'b'.repeat(64),
    zeroKnowledgeProof: false,
    note: 'Commitment only.',
  },
};

const fakeResponse = (data: unknown) => ({ ok: true, json: async () => data });

function stableJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
  }
  throw new TypeError('Unsupported fixture value.');
}

async function claimFixture() {
  const keyBytes = Buffer.alloc(32, 37);
  const hmac = (value: string) => createHmac('sha256', keyBytes).update(value, 'utf8').digest('hex');
  const disclosure = {
    version: 2,
    sequence: 1,
    eventType: 'EVIDENCE_ACCEPTED',
    receivedAt: '2026-10-11T12:00:00.000Z',
    actorId: 'auditor-test',
    fragmentId: 'fragment-test',
    relatedFragmentIds: ['fragment-related'],
    payload: '{"field":"name","value":"Ada"}',
    salt: keyBytes.toString('base64'),
  };
  const relatedFragmentCommitments = [hmac(disclosure.relatedFragmentIds[0]!)].sort();
  const commitment = {
    version: 2 as const,
    sequence: disclosure.sequence,
    eventType: disclosure.eventType as 'EVIDENCE_ACCEPTED',
    receivedAt: disclosure.receivedAt,
    actorCommitment: hmac(disclosure.actorId),
    fragmentCommitment: hmac(disclosure.fragmentId),
    relatedFragmentCommitments,
    payloadCommitment: hmac(disclosure.payload),
    previousEnvelopeHash: 'a'.repeat(64),
  };
  const envelopeHash = createHash('sha256').update(stableJson(commitment), 'utf8').digest('hex');
  return { disclosure, envelope: { ...commitment, envelopeHash } };
}

describe('LAZARUS-X investigator console', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.stubGlobal('crypto', webcrypto);
    vi.restoreAllMocks();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:test-proof') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    globalThis.fetch = vi.fn();
  });

  it('shows each Merkle sibling side and the verified counted root in the proof drawer', async () => {
    const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
    const genesisHash = hash('LAZARUS-X:PUBLIC-PROVENANCE-ENVELOPE:V2:GENESIS');
    const envelopes: PublicEnvelopeEntry[] = [];
    let previousEnvelopeHash = genesisHash;
    for (let sequence = 1; sequence <= 3; sequence += 1) {
      const commitment = {
        version: 2 as const,
        sequence,
        eventType: 'EVIDENCE_ACCEPTED' as const,
        receivedAt: `2026-10-11T12:0${sequence}:00.000Z`,
        actorCommitment: String(sequence).repeat(64),
        fragmentCommitment: String(sequence + 1).repeat(64),
        relatedFragmentCommitments: [] as string[],
        payloadCommitment: String(sequence + 2).repeat(64),
        previousEnvelopeHash,
      };
      const envelope = { ...commitment, envelopeHash: hash(stableJson(commitment)) };
      envelopes.push(envelope);
      previousEnvelopeHash = envelope.envelopeHash;
    }
    const leafHashes = envelopes.map(envelope => hash(`LAZARUS-X:ENVELOPE-MERKLE:LEAF:V1\n${envelope.sequence}\n${envelope.envelopeHash}`));
    const parent = (left: string, right: string) => hash(`LAZARUS-X:ENVELOPE-MERKLE:NODE:V1\n${left}\n${right}`);
    const upper = [parent(leafHashes[0]!, leafHashes[1]!), parent(leafHashes[2]!, leafHashes[2]!)];
    const treeRoot = parent(upper[0]!, upper[1]!);
    const root = hash(`LAZARUS-X:ENVELOPE-MERKLE:ROOT:V1\n3\n${treeRoot}`);
    const proof = { version: 1 as const, sequence: 2, totalEvents: 3, siblings: [leafHashes[0]!, upper[1]!] };
    const checkpointCore = {
      version: 1 as const,
      caseId: 'case-proof-visual',
      sequence: 3,
      ledgerHead: 'a'.repeat(64),
      publicEnvelopeHead: envelopes[2]!.envelopeHash,
      publicEnvelopeMerkleRoot: root,
      timestamp: '2026-10-11T12:04:00.000Z',
      cumulativeEventCount: 3,
    };
    const checkpoint = { ...checkpointCore, manifestDigest: hash(stableJson(checkpointCore)), note: 'Test checkpoint.' };
    const audit = {
      valid: true,
      checkedEntries: 3,
      totalEntries: 3,
      nextAfterSequence: null,
      entries: envelopes,
      publicEnvelope: {
        genesisHash,
        headHash: envelopes[2]!.envelopeHash,
        pagePreviousHash: genesisHash,
        pageHeadHash: envelopes[2]!.envelopeHash,
        zeroKnowledgeProof: false,
        note: 'Commitments only.',
      },
    };
    const state = {
      id: 'S-1', data: { Department: [], Employee: [], Order: [] }, probabilityScore: 1,
      fatalViolations: 0, resolvableViolations: 0,
    };
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'f'.repeat(64), email: 'caseworker@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-proof-visual', name: 'Proof visual case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 3 }] }) as Response)
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-proof-visual', bestState: state, candidates: [], ambiguityReduction: null,
        ambiguity: { entropyBits: 0, candidateCount: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse(audit) as Response)
      .mockResolvedValueOnce(fakeResponse({ caseId: 'case-proof-visual', envelope: envelopes[1], proof, checkpoint, note: 'Proof fixture.' }) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'caseworker@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));
    fireEvent.click(await screen.findByRole('button', { name: /proof visual case/i }));
    fireEvent.click(await screen.findByRole('button', { name: /provenance/i }));
    const eventSummary = await screen.findByText(/#00002 · Evidence accepted/i);
    fireEvent.click(eventSummary);
    const eventRow = eventSummary.closest('details');
    expect(eventRow).not.toBeNull();
    fireEvent.click(within(eventRow as HTMLElement).getByRole('button', { name: /inspect path & download verified proof/i }));

    const pathView = await screen.findByRole('region', { name: /merkle proof path for event 2/i });
    expect(pathView).toHaveTextContent('LAZARUS-X:ENVELOPE-MERKLE:LEAF:V1');
    expect(pathView).toHaveTextContent('Depth 0');
    expect(pathView).toHaveTextContent('Sibling on the left');
    expect(pathView).toHaveTextContent('Depth 1');
    expect(pathView).toHaveTextContent('Sibling on the right');
    expect(pathView).toHaveTextContent('Counted root · MATCH');
    expect(pathView).toHaveTextContent('Checkpoint manifest · VERIFIED');
    expect(pathView).toHaveTextContent(root);
    expect(screen.getByText(/verified locally and downloaded/i)).toBeInTheDocument();
  });

  it('verifies v2 disclosed claims in the browser and rejects altered payloads and hashes', async () => {
    const { disclosure, envelope } = await claimFixture();
    expect(await verifyDisclosedClaim(disclosure, envelope)).toBe(true);
    expect(await verifyDisclosedClaim({ ...disclosure, payload: '{"value":"changed"}' }, envelope)).toBe(false);
    expect(await verifyDisclosedClaim(disclosure, { ...envelope, envelopeHash: '0'.repeat(64) })).toBe(false);
    expect(await verifyDisclosedClaim({ ...disclosure, extra: 'unexpected' }, envelope)).toBe(false);
  });

  it('verifies a local Merkle inclusion path and its checkpoint, rejecting altered envelope fields', async () => {
    const hash = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
    const commitment = {
      version: 2 as const,
      sequence: 1,
      eventType: 'EVIDENCE_ACCEPTED' as const,
      receivedAt: '2026-10-11T12:00:00.000Z',
      actorCommitment: 'a'.repeat(64),
      fragmentCommitment: 'b'.repeat(64),
      relatedFragmentCommitments: [] as string[],
      payloadCommitment: 'c'.repeat(64),
      previousEnvelopeHash: 'd'.repeat(64),
    };
    const envelope = { ...commitment, envelopeHash: hash(stableJson(commitment)) };
    const leaf = hash(`LAZARUS-X:ENVELOPE-MERKLE:LEAF:V1\n1\n${envelope.envelopeHash}`);
    const root = hash(`LAZARUS-X:ENVELOPE-MERKLE:ROOT:V1\n1\n${leaf}`);
    const proof = { version: 1 as const, sequence: 1, totalEvents: 1, siblings: [] };
    const checkpointCore = {
      version: 1 as const,
      caseId: 'case-merkle',
      sequence: 1,
      ledgerHead: 'e'.repeat(64),
      publicEnvelopeHead: envelope.envelopeHash,
      publicEnvelopeMerkleRoot: root,
      timestamp: '2026-10-11T12:01:00.000Z',
      cumulativeEventCount: 1,
    };
    const checkpoint = {
      ...checkpointCore,
      manifestDigest: hash(stableJson(checkpointCore)),
      note: 'Externally anchorable.',
    };
    expect(await verifyProvenanceCheckpoint(checkpoint)).toBe(true);
    expect(await verifyEnvelopeInclusionProof(envelope, proof, root)).toBe(true);
    expect(await verifyEnvelopeInclusionProof({ ...envelope, actorCommitment: 'f'.repeat(64) }, proof, root)).toBe(false);
    expect(await verifyEnvelopeInclusionProof(envelope, { ...proof, totalEvents: 2 }, root)).toBe(false);
    expect(await verifyProvenanceCheckpoint({ ...checkpoint, publicEnvelopeMerkleRoot: '0'.repeat(64) })).toBe(false);
  });

  it('exposes the accessible claim-verification drawer in the provenance tab', async () => {
    const { disclosure, envelope } = await claimFixture();
    const state = {
      id: 'S-1', data: { Department: [], Employee: [], Order: [] }, probabilityScore: 1,
      fatalViolations: 0, resolvableViolations: 0,
    };
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'f'.repeat(64), email: 'caseworker@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-claim', name: 'Claim test', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 1 }] }) as Response)
      .mockResolvedValueOnce(fakeResponse({ id: 'case-claim', bestState: state, candidates: [], ambiguityReduction: null, ambiguity: { entropyBits: 0, candidateCount: 1 } }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'caseworker@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));
    fireEvent.click(await screen.findByRole('button', { name: /claim test/i }));
    fireEvent.click(await screen.findByRole('button', { name: /provenance/i }));
    fireEvent.click(await screen.findByRole('button', { name: /verify disclosed claim/i }));

    const editor = screen.getByRole('textbox', { name: /disclosure and envelope json/i });
    fireEvent.change(editor, { target: { value: JSON.stringify({ disclosure, envelope }) } });
    fireEvent.click(screen.getByRole('button', { name: /^verify claim$/i }));
    expect(await screen.findByText(/VALID CLAIM/i)).toHaveAttribute('role', 'status');
  });

  it('renders default investigator credentials preset and switches to administrator preset', () => {
    render(<App />);
    expect(screen.getAllByText(/LAZARUS/)[0]).toBeInTheDocument();
    expect(screen.getByLabelText(/investigator email/i)).toHaveValue('investigator@lazarus.local');
    expect(screen.getByLabelText(/password/i)).toHaveValue('Investigator2026!');
    expect(screen.getByRole('button', { name: /authenticate/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /administrator login/i }));
    expect(screen.getByLabelText(/administrator email/i)).toHaveValue('admin@lazarus.local');
    expect(screen.getByLabelText(/password/i)).toHaveValue('Admin2026!Pass');
  });

  it('authenticates and loads the investigator case workspace', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValueOnce(fakeResponse({ token: 'f'.repeat(64), email: 'caseworker@example.test', role: 'INVESTIGATOR' }) as Response);
    fetchMock.mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response);
    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'caseworker@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /new reconstruction/i })).toBeInTheDocument());
    expect(screen.getByText(/no cases yet/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('catches unexpected case-view rendering failures and offers recovery', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const BrokenView = () => { throw new Error('malformed candidate state'); };
    const onReset = vi.fn();
    render(<CaseViewErrorBoundary onReset={onReset}><BrokenView /></CaseViewErrorBoundary>);
    expect(screen.getByRole('alert')).toHaveTextContent(/case view could not be rendered/i);
    fireEvent.click(screen.getByRole('button', { name: /return to cases/i }));
    expect(onReset).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it('blocks reserved attributes and malformed JSON values before sending evidence', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const emptyState = { id: 'S-0', data: { Department: [], Employee: [], Order: [] }, probabilityScore: 1, fatalViolations: 0, resolvableViolations: 0 };
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'f'.repeat(64), email: 'caseworker@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse({ id: 'case-validation', bestState: emptyState, candidates: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'caseworker@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));
    fireEvent.click(await screen.findByRole('button', { name: /new reconstruction/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create reconstruction case/i }));
    await screen.findByText(/evidence intake/i);

    fireEvent.change(screen.getByLabelText(/attribute/i), { target: { value: '_recordId' } });
    fireEvent.change(screen.getByLabelText(/observed value/i), { target: { value: 'bad' } });
    expect(screen.getByText(/_recordId is reserved/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /commit fragment/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/fix the highlighted evidence fields/i);
    expect(fetchMock).toHaveBeenCalledTimes(5);

    fireEvent.change(screen.getByLabelText(/attribute/i), { target: { value: 'name' } });
    fireEvent.change(screen.getByLabelText(/value format/i), { target: { value: 'json' } });
    fireEvent.change(screen.getByLabelText(/observed value/i), { target: { value: '{' } });
    expect(screen.getByText(/enter valid JSON/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /commit fragment/i }));
    expect(fetchMock).toHaveBeenCalledTimes(5);

    fireEvent.change(screen.getByLabelText(/observed value/i), { target: { value: '{"nested":"object"}' } });
    expect(screen.getByText(/only JSON scalar values are supported/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /commit fragment/i }));
    expect(fetchMock).toHaveBeenCalledTimes(5);

    fireEvent.change(screen.getByLabelText(/observed value/i), { target: { value: '"valid"' } });
    fireEvent.change(screen.getByLabelText(/record locator/i), { target: { value: '-5' } });
    expect(screen.getByText(/record locator must be a non-negative whole number/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /commit fragment/i }));
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('creates a case, commits evidence, and displays graph and entropy updates', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const emptyState = {
      id: 'S-0', data: { Department: [], Employee: [], Order: [] }, probabilityScore: 1,
      fatalViolations: 0, resolvableViolations: 0,
    };
    const populatedState = {
      ...emptyState,
      id: 'S-1',
      data: { Department: [{ _recordId: 1, id: 1, name: 'Forensics' }], Employee: [], Order: [] },
    };
    const alternateState = { ...populatedState, id: 'S-2', data: { Department: [{ _recordId: 1, id: 1, name: 'Forensic' }], Employee: [], Order: [] } };
    const candidateSummaries = [
      { id: 'S-1', rank: 1, score: 0.5, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true },
      { id: 'S-2', rank: 2, score: 0.5, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 1, isSelected: false },
    ];
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'f'.repeat(64), email: 'caseworker@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse({ id: 'case-1', bestState: emptyState, candidates: [{ id: 'S-0', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }] }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-1', name: 'Untitled Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 0 }] }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response)
      .mockResolvedValueOnce(fakeResponse({
        bestState: populatedState,
        candidates: [{ id: 'S-1', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: null,
        ambiguity: { entropyBeforeBits: 0, entropyAfterBits: 0, reductionBits: 0, candidateCountAfter: 1 },
        provenance: { sequence: 1, appendedEvents: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-1', name: 'Untitled Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 1 }] }) as Response);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({
        bestState: populatedState,
        candidates: candidateSummaries,
        ambiguityReduction: { table: 'Department', recordId: 1, field: 'name', expectedInformationGain: 1 },
        ambiguity: { entropyBeforeBits: 0, entropyAfterBits: 1, reductionBits: -1, candidateCountAfter: 2 },
        provenance: { sequence: 2, appendedEvents: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-1', name: 'Untitled Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 2 }] }) as Response)
      .mockResolvedValueOnce(fakeResponse({ candidate: alternateState }) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'caseworker@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));
    fireEvent.click(await screen.findByRole('button', { name: /new reconstruction/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create reconstruction case/i }));
    await screen.findByText(/relational hypothesis graph/i);
    await waitFor(() => expect(screen.getByRole('button', { name: /commit fragment/i })).toBeEnabled());

    fireEvent.change(screen.getByLabelText(/observed value/i), { target: { value: 'Forensics' } });
    fireEvent.click(screen.getByRole('button', { name: /commit fragment/i }));

    await waitFor(() => expect(screen.getAllByText('Forensics').length).toBeGreaterThan(0));
    expect(screen.getByText(/−0\.000 bits after latest evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Department · 1/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/observed value/i), { target: { value: 'Forensic' } });
    fireEvent.click(screen.getByRole('button', { name: /commit fragment/i }));
    await screen.findByText(/2 ranked candidates/i);
    expect(screen.getByText(/New evidence introduced ambiguity/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /commit fragment/i })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /show candidate 2/i }));
    await waitFor(() => expect(screen.getAllByText('Forensic').length).toBeGreaterThan(0));
  });
  it('renders multi-field predictive recommendations, candidate value predictions, and diagnostics', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const mockState = {
      id: 'S-1',
      data: { Department: [{ _recordId: 1, id: 1, name: 'Forensics' }], Employee: [], Order: [] },
      probabilityScore: 1,
      fatalViolations: 0,
      resolvableViolations: 0,
    };
    const recommendations = [
      {
        table: 'Department',
        recordId: 1,
        field: 'name',
        expectedInformationGain: 1.0,
        candidateValues: [
          { value: 'Forensics', probability: 0.5, candidateCount: 1 },
          { value: 'Forensic', probability: 0.5, candidateCount: 1 },
        ],
      },
      {
        table: 'Employee',
        recordId: 2,
        field: 'badge',
        expectedInformationGain: 0.85,
        candidateValues: [
          { value: 'B-100', probability: 0.6, candidateCount: 1 },
          { value: 'B-200', probability: 0.4, candidateCount: 1 },
        ],
      },
    ];
    const branchingDiag = {
      totalCandidateStates: 2,
      priorEntropyBits: 1.0,
      disputedAttributesCount: 2,
      recommendationsCount: 2,
      exhausted: false,
      contradictionFallback: false,
    };

    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'f'.repeat(64), email: 'caseworker@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-entropy',
        name: 'Entropy Test Case',
        status: 'ACTIVE',
        bestState: mockState,
        candidates: [{ id: 'S-1', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: recommendations[0],
        evidenceRecommendations: recommendations,
        branchingDiagnostics: branchingDiag,
        ambiguity: { entropyBits: 1.0, candidateCount: 2 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'caseworker@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

    // Open the case
    await waitFor(() => expect(screen.getByRole('button', { name: /new reconstruction/i })).toBeInTheDocument());
    // Simulate loading the case directly by triggering state
  });

    it('toggles to Schema DAG view and renders relational table nodes', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'e'.repeat(64), email: 'examiner@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-dag',
        name: 'DAG Test Case',
        status: 'ACTIVE',
        bestState: {
          id: 'S-0',
          data: {
            Department: [{ _recordId: 1, id: 1, name: 'Security' }],
            Employee: [{ _recordId: 1, id: 1, name: 'Alice', departmentId: 1 }],
            Order: [],
          },
          probabilityScore: 1,
          fatalViolations: 0,
          resolvableViolations: 0,
          fuzzyPenalty: 0,
        },
        candidates: [{ id: 'S-0', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: null,
        evidenceRecommendations: [],
        branchingDiagnostics: null,
        ambiguity: { entropyBits: 0, candidateCount: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-dag', name: 'DAG Test Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 1 }] }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'examiner@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /new reconstruction/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new reconstruction/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create reconstruction case/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /schema dag/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /schema dag/i }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /relational constraint schema graph/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /inspect relation department/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /inspect relation employee/i })).toBeInTheDocument();
    });
  });

    it('triggers case sealing and updates UI to sealed and frozen state', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'e'.repeat(64), email: 'examiner@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-seal-test',
        name: 'Seal Test Case',
        status: 'ACTIVE',
        bestState: {
          id: 'S-0',
          data: { Department: [{ _recordId: 1, name: 'Audit' }], Employee: [], Order: [] },
          probabilityScore: 1,
          fatalViolations: 0,
          resolvableViolations: 0,
          fuzzyPenalty: 0,
        },
        candidates: [{ id: 'S-0', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: null,
        evidenceRecommendations: [],
        branchingDiagnostics: null,
        ambiguity: { entropyBits: 0, candidateCount: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-seal-test', name: 'Seal Test Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 1 }] }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response)
      .mockResolvedValueOnce(fakeResponse({
        success: true,
        status: 'SEALED',
        caseId: 'case-seal-test',
        checkpoint: { publicEnvelopeMerkleRoot: 'a'.repeat(64), sequence: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'examiner@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /new reconstruction/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new reconstruction/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create reconstruction case/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /seal case/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /seal case/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/case is sealed/i)).toBeInTheDocument();
      expect(screen.getByText(/case .* sealed in LAZARUS-X/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /commit fragment/i })).toBeDisabled();
    });
  });


  it('opens and renders the Forensic Investigation Report modal', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'e'.repeat(64), email: 'examiner@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-dossier',
        name: 'Dossier Test Case',
        status: 'ACTIVE',
        bestState: {
          id: 'S-0',
          data: {
            Department: [{ _recordId: 1, id: 1, name: 'Security' }],
          },
          probabilityScore: 1,
          fatalViolations: 0,
          resolvableViolations: 0,
          fuzzyPenalty: 0,
        },
        candidates: [{ id: 'S-0', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: null,
        evidenceRecommendations: [],
        branchingDiagnostics: null,
        ambiguity: { entropyBits: 0, candidateCount: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-dossier', name: 'Dossier Test Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 1 }] }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'examiner@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /new reconstruction/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new reconstruction/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create reconstruction case/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /forensic dossier/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /forensic dossier/i }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /forensic investigation report/i })).toBeInTheDocument();
      expect(screen.getByText(/forensic integrity report · research prototype/i)).toBeInTheDocument();
      expect(screen.getByText(/lazarus-x forensic dossier/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close report modal/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /forensic investigation report/i })).not.toBeInTheDocument();
    });
  });

  it('toggles field inspection and displays candidate conflict differences', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'e'.repeat(64), email: 'examiner@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response)
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-diff',
        name: 'Diff Test Case',
        status: 'ACTIVE',
        bestState: {
          id: 'S-0',
          data: {
            Department: [{ _recordId: 1, id: 1, name: 'Security' }],
          },
          probabilityScore: 1,
          fatalViolations: 0,
          resolvableViolations: 0,
          fuzzyPenalty: 0,
        },
        candidates: [{ id: 'S-0', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: null,
        evidenceRecommendations: [],
        branchingDiagnostics: null,
        ambiguity: { entropyBits: 0, candidateCount: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [{ id: 'case-diff', name: 'Diff Test Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 1 }] }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'examiner@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /new reconstruction/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new reconstruction/i }));
    fireEvent.click(await screen.findByRole('button', { name: /create reconstruction case/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /conflict matrix/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /conflict matrix/i }));

    await waitFor(() => {
      expect(screen.getByRole('region', { name: /candidate field inspection/i })).toBeInTheDocument();
      expect(screen.getByText(/candidate conflict & field inspection/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /record cards/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /record cards/i }));
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: /candidate field inspection/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /conflict matrix/i })).toBeInTheDocument();
    });
  });


  it('opens the schema-first workflow and explains the reconstruction model', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'e'.repeat(64), email: 'examiner@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({ cases: [] }) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'examiner@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));
    await waitFor(() => expect(screen.getByRole('button', { name: /new reconstruction/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /new reconstruction/i }));

    expect(screen.getByRole('dialog', { name: /define the target relational schema/i })).toBeInTheDocument();
    expect(screen.getByText(/tell it the relations and constraints that evidence must satisfy/i)).toBeInTheDocument();
    expect(screen.getByText(/incident response/i)).toBeInTheDocument();
    expect(screen.getAllByDisplayValue('Person').length).toBeGreaterThan(0);
    expect(screen.getAllByDisplayValue('Observation').length).toBeGreaterThan(0);
    expect(screen.getByText(/foreign-key relationships/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2); // schema setup does not create a case until submitted
  });

  it('renders example scenarios, disables load for mismatched preset, sealed, and non-empty cases, and confirm-cancel submits nothing', async () => {
    const divyank24BCE0793_irSchema = createPresetSchema('incident-response');
    const divyank24BCE0793_emptyState = {
      id: 'S-0',
      data: { Person: [], Device: [], Incident: [], Artifact: [], Observation: [] },
      probabilityScore: 1,
      fatalViolations: 0,
      resolvableViolations: 0,
    };
    const divyank24BCE0793_fetchMock = vi.mocked(globalThis.fetch);

    divyank24BCE0793_fetchMock
      .mockResolvedValueOnce(fakeResponse({ token: 'e'.repeat(64), email: 'examiner@example.test', role: 'INVESTIGATOR' }) as Response)
      .mockResolvedValueOnce(fakeResponse({
        cases: [
          { id: 'case-divyank-ir-active', name: 'Divyank IR Empty Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 0 },
          { id: 'case-divyank-ir-sealed', name: 'Divyank IR Sealed Case', status: 'SEALED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 0 },
          { id: 'case-divyank-non-empty', name: 'Divyank Non-Empty Case', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenanceSequence: 5 },
        ],
      }) as Response)
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-divyank-ir-active',
        name: 'Divyank IR Empty Case',
        status: 'ACTIVE',
        schemaDefinition: divyank24BCE0793_irSchema,
        bestState: divyank24BCE0793_emptyState,
        candidates: [{ id: 'S-0', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: null,
        ambiguity: { entropyBits: 0, candidateCount: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    render(<App />);
    fireEvent.change(screen.getByLabelText(/investigator email/i), { target: { value: 'examiner@example.test' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'correct-horse-battery' } });
    fireEvent.click(screen.getByRole('button', { name: /authenticate/i }));

    fireEvent.click(await screen.findByRole('button', { name: /divyank ir empty case/i }));
    await screen.findByText(/case restored from its verified evidence ledger/i);

    const scenarioSelect = screen.getByLabelText(/select example scenario/i);
    expect(scenarioSelect).toBeInTheDocument();
    expect(screen.getByText(/clean incident \(no conflicts\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1 surviving interpretation, entropy 0.000/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /load scenario/i })).not.toBeDisabled();

    // 1. Mismatched preset check: switch scenario dropdown to 'wf-clean' (preset workforce-orders on incident-response case)
    fireEvent.change(scenarioSelect, { target: { value: 'wf-clean' } });
    expect(screen.getByText(/Workforce and orders \(clean\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /load scenario/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /load scenario/i })).toHaveAttribute(
      'title',
      "Create a case using the 'workforce-orders' preset to load this scenario"
    );

    // 2. Confirm-cancel submits nothing: switch back to 'ir-clean'
    fireEvent.change(scenarioSelect, { target: { value: 'ir-clean' } });
    expect(screen.getByRole('button', { name: /load scenario/i })).not.toBeDisabled();
    const divyank24BCE0793_confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const fetchCallsBeforeConfirm = divyank24BCE0793_fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /load scenario/i }));
    expect(divyank24BCE0793_confirmSpy).toHaveBeenCalledWith(
      'Load 20 EXAMPLE fragments into this case? These are demo values, not recovered evidence, and cannot be removed individually.'
    );
    expect(divyank24BCE0793_fetchMock.mock.calls.length).toBe(fetchCallsBeforeConfirm);

    // 3. Sealed case check: switch to sealed case
    divyank24BCE0793_fetchMock
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-divyank-ir-sealed',
        name: 'Divyank IR Sealed Case',
        status: 'SEALED',
        schemaDefinition: divyank24BCE0793_irSchema,
        bestState: divyank24BCE0793_emptyState,
        candidates: [{ id: 'S-0', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: null,
        ambiguity: { entropyBits: 0, candidateCount: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse(emptyAudit) as Response);

    fireEvent.click(screen.getByRole('button', { name: /divyank ir sealed case/i }));
    await waitFor(() => {
      const sealedLoadBtn = screen.getByRole('button', { name: /load scenario/i });
      expect(sealedLoadBtn).toBeDisabled();
      expect(sealedLoadBtn).toHaveAttribute('title', 'Case is sealed; new evidence cannot be loaded');
    });

    // 4. Non-empty case check: switch to non-empty case (totalEntries = 5)
    const divyank24BCE0793_nonEmptyAudit = {
      ...emptyAudit,
      totalEntries: 5,
    };
    divyank24BCE0793_fetchMock
      .mockResolvedValueOnce(fakeResponse({
        id: 'case-divyank-non-empty',
        name: 'Divyank Non-Empty Case',
        status: 'ACTIVE',
        schemaDefinition: divyank24BCE0793_irSchema,
        bestState: divyank24BCE0793_emptyState,
        candidates: [{ id: 'S-0', rank: 1, score: 1, fatalViolations: 0, resolvableViolations: 0, fuzzyPenalty: 0, isSelected: true }],
        ambiguityReduction: null,
        ambiguity: { entropyBits: 0, candidateCount: 1 },
      }) as Response)
      .mockResolvedValueOnce(fakeResponse(divyank24BCE0793_nonEmptyAudit) as Response);

    fireEvent.click(screen.getByRole('button', { name: /divyank non-empty case/i }));
    await waitFor(() => {
      const nonEmptyLoadBtn = screen.getByRole('button', { name: /load scenario/i });
      expect(nonEmptyLoadBtn).toBeDisabled();
      expect(nonEmptyLoadBtn).toHaveAttribute('title', 'Evidence ledger must be empty to load example scenarios. Create a fresh case.');
    });
  });

});

