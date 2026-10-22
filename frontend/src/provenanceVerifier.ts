export type PublicEnvelopeEntry = {
  version: 2;
  sequence: number;
  eventType: 'EVIDENCE_ACCEPTED' | 'FUZZY_CORRECTION';
  receivedAt: string;
  actorCommitment: string;
  fragmentCommitment: string;
  relatedFragmentCommitments: string[];
  payloadCommitment: string;
  previousEnvelopeHash: string;
  envelopeHash: string;
};

export type EnvelopeMerkleProof = {
  version: 1;
  sequence: number;
  totalEvents: number;
  siblings: string[];
};

export type EnvelopeMerklePathStep = {
  depth: number;
  siblingHash: string;
  siblingSide: 'left' | 'right';
  duplicateCurrentNode: boolean;
  resultingNodeHash: string;
};

export type EnvelopeMerkleProofDetails = {
  leafHash: string;
  pathSteps: EnvelopeMerklePathStep[];
  treeRootHash: string;
  countedRootHash: string;
};

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Invalid number in audit envelope.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
  }
  throw new TypeError('Invalid value in audit envelope.');
}

async function sha256(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function bytesToHex(value: ArrayBuffer): string {
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
}

/** Independently verify a v2 event disclosure with browser Web Crypto. */
export async function verifyDisclosedClaim(disclosureValue: unknown, envelopeValue: unknown): Promise<boolean> {
  if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable in this browser context.');
  if (!isObjectRecord(disclosureValue) || !isObjectRecord(envelopeValue)) return false;

  const disclosureKeys = ['version', 'sequence', 'eventType', 'receivedAt', 'actorId', 'fragmentId', 'relatedFragmentIds', 'payload', 'salt'];
  const envelopeKeys = ['version', 'sequence', 'eventType', 'receivedAt', 'actorCommitment', 'fragmentCommitment', 'relatedFragmentCommitments', 'payloadCommitment', 'previousEnvelopeHash', 'envelopeHash'];
  if (!hasExactKeys(disclosureValue, disclosureKeys) || !hasExactKeys(envelopeValue, envelopeKeys)) return false;

  const disclosure = disclosureValue;
  const envelope = envelopeValue;
  const isEventType = (value: unknown): value is PublicEnvelopeEntry['eventType'] =>
    value === 'EVIDENCE_ACCEPTED' || value === 'FUZZY_CORRECTION';
  const isHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

  if (disclosure.version !== 2 || envelope.version !== 2 ||
      !Number.isSafeInteger(disclosure.sequence) || (disclosure.sequence as number) < 1 ||
      disclosure.sequence !== envelope.sequence || !isEventType(disclosure.eventType) ||
      disclosure.eventType !== envelope.eventType || typeof disclosure.receivedAt !== 'string' ||
      disclosure.receivedAt !== envelope.receivedAt || !Number.isFinite(Date.parse(disclosure.receivedAt)) ||
      typeof disclosure.actorId !== 'string' || typeof disclosure.fragmentId !== 'string' ||
      typeof disclosure.payload !== 'string' || !Array.isArray(disclosure.relatedFragmentIds) ||
      disclosure.relatedFragmentIds.some(value => typeof value !== 'string') ||
      typeof disclosure.salt !== 'string' || !isHash(envelope.actorCommitment) ||
      !isHash(envelope.fragmentCommitment) || !isHash(envelope.payloadCommitment) ||
      !isHash(envelope.previousEnvelopeHash) || !isHash(envelope.envelopeHash) ||
      !Array.isArray(envelope.relatedFragmentCommitments) ||
      envelope.relatedFragmentCommitments.some(value => !isHash(value))) return false;

  try {
    const binaryKey = atob(disclosure.salt);
    if (btoa(binaryKey) !== disclosure.salt || binaryKey.length !== 32) return false;
    const keyBytes = Uint8Array.from(binaryKey, character => character.charCodeAt(0));
    const key = await globalThis.crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const keyedDigest = async (value: string): Promise<string> => bytesToHex(await globalThis.crypto.subtle.sign(
      'HMAC', key, new TextEncoder().encode(value),
    ));
    const relatedCommitments = await Promise.all((disclosure.relatedFragmentIds as string[]).map(keyedDigest));
    relatedCommitments.sort();

    if (await keyedDigest(disclosure.actorId as string) !== envelope.actorCommitment ||
        await keyedDigest(disclosure.fragmentId as string) !== envelope.fragmentCommitment ||
        canonicalJson(relatedCommitments) !== canonicalJson(envelope.relatedFragmentCommitments) ||
        await keyedDigest(disclosure.payload as string) !== envelope.payloadCommitment) return false;

    const { envelopeHash: _envelopeHash, ...commitment } = envelope as unknown as PublicEnvelopeEntry;
    return await sha256(canonicalJson(commitment)) === envelope.envelopeHash;
  } catch {
    return false;
  }
}

function merkleLeafHash(sequence: number, envelopeHash: string): Promise<string> {
  return sha256(`LAZARUS-X:ENVELOPE-MERKLE:LEAF:V1\n${sequence}\n${envelopeHash}`);
}

function merkleParentHash(left: string, right: string): Promise<string> {
  return sha256(`LAZARUS-X:ENVELOPE-MERKLE:NODE:V1\n${left}\n${right}`);
}

/** Rebuild the visible sibling path and counted root in O(log N) with Web Crypto. */
export async function deriveEnvelopeMerkleProofDetails(
  envelopeValue: unknown,
  proofValue: unknown,
): Promise<EnvelopeMerkleProofDetails | null> {
  try {
    if (!globalThis.crypto?.subtle || !isObjectRecord(envelopeValue) || !isObjectRecord(proofValue)) return null;
    const isHash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
    const envelopeKeys = ['version', 'sequence', 'eventType', 'receivedAt', 'actorCommitment', 'fragmentCommitment', 'relatedFragmentCommitments', 'payloadCommitment', 'previousEnvelopeHash', 'envelopeHash'];
    if (!hasExactKeys(envelopeValue, envelopeKeys) || envelopeValue.version !== 2 ||
        !Number.isSafeInteger(envelopeValue.sequence) || (envelopeValue.sequence as number) < 1 ||
        (envelopeValue.eventType !== 'EVIDENCE_ACCEPTED' && envelopeValue.eventType !== 'FUZZY_CORRECTION') ||
        typeof envelopeValue.receivedAt !== 'string' || !Number.isFinite(Date.parse(envelopeValue.receivedAt)) ||
        !isHash(envelopeValue.actorCommitment) || !isHash(envelopeValue.fragmentCommitment) ||
        !isHash(envelopeValue.payloadCommitment) || !isHash(envelopeValue.previousEnvelopeHash) ||
        !isHash(envelopeValue.envelopeHash) || !Array.isArray(envelopeValue.relatedFragmentCommitments) ||
        envelopeValue.relatedFragmentCommitments.some(item => !isHash(item))) return null;
    const { envelopeHash: suppliedEnvelopeHash, ...commitment } = envelopeValue;
    if (await sha256(canonicalJson(commitment)) !== suppliedEnvelopeHash) return null;
    const proof = proofValue;
    if (!hasExactKeys(proof, ['version', 'sequence', 'totalEvents', 'siblings']) || proof.version !== 1 ||
        proof.sequence !== envelopeValue.sequence || !Number.isSafeInteger(proof.totalEvents) ||
        (proof.totalEvents as number) < 1 || (proof.sequence as number) < 1 ||
        (proof.sequence as number) > (proof.totalEvents as number) || !Array.isArray(proof.siblings) ||
        proof.siblings.some(value => !isHash(value))) return null;

    let expectedDepth = 0;
    for (let width = proof.totalEvents as number; width > 1; width = Math.ceil(width / 2)) expectedDepth += 1;
    if (proof.siblings.length !== expectedDepth) return null;
    const leafHash = await merkleLeafHash(proof.sequence as number, envelopeValue.envelopeHash as string);
    let current = leafHash;
    let index = (proof.sequence as number) - 1;
    let width = proof.totalEvents as number;
    const pathSteps: EnvelopeMerklePathStep[] = [];
    for (let depth = 0; depth < (proof.siblings as string[]).length; depth += 1) {
      const sibling = (proof.siblings as string[])[depth]!;
      const siblingIndex = index ^ 1;
      if (siblingIndex >= width && sibling !== current) return null;
      current = (index & 1) === 0
        ? await merkleParentHash(current, sibling)
        : await merkleParentHash(sibling, current);
      pathSteps.push({
        depth,
        siblingHash: sibling,
        siblingSide: (index & 1) === 0 ? 'right' : 'left',
        duplicateCurrentNode: siblingIndex >= width,
        resultingNodeHash: current,
      });
      index = Math.floor(index / 2);
      width = Math.ceil(width / 2);
    }
    const countedRootHash = await sha256(`LAZARUS-X:ENVELOPE-MERKLE:ROOT:V1\n${proof.totalEvents}\n${current}`);
    return { leafHash, pathSteps, treeRootHash: current, countedRootHash };
  } catch {
    return null;
  }
}

/** Verify an envelope's Merkle path in O(log N) using browser Web Crypto. */
export async function verifyEnvelopeInclusionProof(
  envelopeValue: unknown,
  proofValue: unknown,
  rootHash: unknown,
): Promise<boolean> {
  try {
    if (typeof rootHash !== 'string' || !/^[a-f0-9]{64}$/.test(rootHash)) return false;
    const details = await deriveEnvelopeMerkleProofDetails(envelopeValue, proofValue);
    return details !== null && details.countedRootHash === rootHash;
  } catch {
    return false;
  }
}

/** Verify the self-digest of a checkpoint, including its optional Merkle root. */
export async function verifyProvenanceCheckpoint(value: unknown): Promise<boolean> {
  try {
    if (!globalThis.crypto?.subtle || !isObjectRecord(value)) return false;
    const required = ['version', 'caseId', 'sequence', 'ledgerHead', 'publicEnvelopeHead', 'timestamp', 'cumulativeEventCount', 'manifestDigest', 'note'];
    const actual = Object.keys(value).sort();
    const withRoot = [...required, 'publicEnvelopeMerkleRoot'].sort();
    const withoutRoot = required.slice().sort();
    if (JSON.stringify(actual) !== JSON.stringify(withRoot) && JSON.stringify(actual) !== JSON.stringify(withoutRoot)) return false;
    const isHash = (item: unknown): item is string => typeof item === 'string' && /^[a-f0-9]{64}$/.test(item);
    if (value.version !== 1 || typeof value.caseId !== 'string' || value.caseId.length === 0 ||
        !Number.isSafeInteger(value.sequence) || (value.sequence as number) < 0 ||
        !Number.isSafeInteger(value.cumulativeEventCount) || (value.cumulativeEventCount as number) < 0 ||
        !isHash(value.ledgerHead) || !isHash(value.publicEnvelopeHead) || !isHash(value.manifestDigest) ||
        (value.publicEnvelopeMerkleRoot !== undefined && !isHash(value.publicEnvelopeMerkleRoot)) ||
        typeof value.timestamp !== 'string' || !Number.isFinite(Date.parse(value.timestamp)) ||
        new Date(value.timestamp).toISOString() !== value.timestamp || typeof value.note !== 'string') return false;
    const core = {
      version: 1,
      caseId: value.caseId,
      sequence: value.sequence,
      ledgerHead: value.ledgerHead,
      publicEnvelopeHead: value.publicEnvelopeHead,
      ...(value.publicEnvelopeMerkleRoot === undefined ? {} : { publicEnvelopeMerkleRoot: value.publicEnvelopeMerkleRoot }),
      timestamp: value.timestamp,
      cumulativeEventCount: value.cumulativeEventCount,
    };
    return await sha256(canonicalJson(core)) === value.manifestDigest;
  } catch {
    return false;
  }
}
