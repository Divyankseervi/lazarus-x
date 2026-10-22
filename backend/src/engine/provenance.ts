import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { ProvenanceEntry } from './types';

/** A public genesis commitment for versioned evidence-ledger chains. */
export const PROVENANCE_GENESIS_HASH = createHash('sha256')
    .update('LAZARUS-X:EVIDENCE-PROVENANCE:V1:GENESIS', 'utf8')
    .digest('hex');

export const PUBLIC_ENVELOPE_GENESIS_HASH = createHash('sha256')
    .update('LAZARUS-X:PUBLIC-PROVENANCE-ENVELOPE:V2:GENESIS', 'utf8')
    .digest('hex');

export interface PublicProvenanceEnvelopeEntry {
    version: 2;
    sequence: number;
    eventType: ProvenanceEntry['eventType'];
    receivedAt: string;
    actorCommitment: string;
    fragmentCommitment: string;
    relatedFragmentCommitments: string[];
    payloadCommitment: string;
    previousEnvelopeHash: string;
    envelopeHash: string;
}

export interface ProvenanceDisclosure {
    version: 2;
    sequence: number;
    eventType: ProvenanceEntry['eventType'];
    receivedAt: string;
    actorId: string;
    fragmentId: string;
    relatedFragmentIds: string[];
    payload: string;
    /** Event-scoped key; disclosure permits checking only this event's commitments. */
    salt: string;
}

function digest(value: string): string {
    return createHash('sha256').update(value, 'utf8').digest('hex');
}

function keyedDigest(value: string, key: Uint8Array): string {
    return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

export function parseProvenanceMasterKey(value: string | undefined): Buffer {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
        throw new Error('PROVENANCE_ENCRYPTION_KEY must be set to 64 hexadecimal characters (32 random bytes).');
    }
    return Buffer.from(value, 'hex');
}

export function encryptCaseSalt(caseSalt: Uint8Array, masterKey: Uint8Array): string {
    if (caseSalt.byteLength !== 32 || masterKey.byteLength !== 32) throw new TypeError('Provenance keys must be 32 bytes.');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(caseSalt), cipher.final()]);
    return `v1.${iv.toString('hex')}.${cipher.getAuthTag().toString('hex')}.${ciphertext.toString('hex')}`;
}

export function decryptCaseSalt(ciphertext: string, masterKey: Uint8Array): Buffer {
    if (masterKey.byteLength !== 32) throw new TypeError('Provenance master key must be 32 bytes.');
    const [version, ivHex, tagHex, dataHex, extra] = ciphertext.split('.');
    if (version !== 'v1' || extra !== undefined || !/^[a-f0-9]{24}$/i.test(ivHex ?? '') ||
        !/^[a-f0-9]{32}$/i.test(tagHex ?? '') || !/^[a-f0-9]{64}$/i.test(dataHex ?? '')) {
        throw new Error('Malformed encrypted case provenance salt.');
    }
    const decipher = createDecipheriv('aes-256-gcm', masterKey, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const salt = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
    if (salt.length !== 32) throw new Error('Invalid decrypted case provenance salt.');
    return salt;
}

/** Derive an unlinkable event-scoped commitment key without revealing the per-case key. */
export function deriveEventCommitmentKey(caseSalt: Uint8Array, sequence: number): Buffer {
    if (caseSalt.byteLength !== 32 || !Number.isSafeInteger(sequence) || sequence < 1) {
        throw new TypeError('A 32-byte case salt and positive event sequence are required.');
    }
    return createHmac('sha256', caseSalt)
        .update(`LAZARUS-X:PUBLIC-PROVENANCE:EVENT-KEY:V2:${sequence}`, 'utf8')
        .digest();
}

/**
 * Build a privacy-preserving public envelope over already verified ledger rows.
 * It commits to payloads without disclosing them; it is not a zero-knowledge proof.
 */
export function appendPublicProvenanceEnvelope(
    entry: ProvenanceEntry,
    previousEnvelopeHash: string,
    eventKey: Uint8Array,
): PublicProvenanceEnvelopeEntry {
    const commitment = {
        version: 2 as const,
        sequence: entry.sequence,
        eventType: entry.eventType,
        receivedAt: entry.receivedAt,
        actorCommitment: keyedDigest(entry.actorId, eventKey),
        fragmentCommitment: keyedDigest(entry.fragmentId, eventKey),
        relatedFragmentCommitments: entry.relatedFragmentIds.map(value => keyedDigest(value, eventKey)).sort(),
        payloadCommitment: keyedDigest(entry.payload, eventKey),
        previousEnvelopeHash,
    };
    return { ...commitment, envelopeHash: digest(canonicalJson(commitment)) };
}

export function createProvenanceDisclosure(entry: ProvenanceEntry, eventKey: Uint8Array): ProvenanceDisclosure {
    if (eventKey.byteLength !== 32) throw new TypeError('Event commitment key must be 32 bytes.');
    return {
        version: 2,
        sequence: entry.sequence,
        eventType: entry.eventType,
        receivedAt: entry.receivedAt,
        actorId: entry.actorId,
        fragmentId: entry.fragmentId,
        relatedFragmentIds: [...entry.relatedFragmentIds],
        payload: entry.payload,
        salt: Buffer.from(eventKey).toString('base64'),
    };
}

/** Verify one deliberately disclosed event against the corresponding public envelope row. */
export function verifyProvenanceDisclosure(
    disclosure: ProvenanceDisclosure,
    envelope: PublicProvenanceEnvelopeEntry,
): boolean {
    try {
        if (!disclosure || disclosure.version !== 2 || disclosure.sequence !== envelope.sequence ||
            disclosure.eventType !== envelope.eventType || disclosure.receivedAt !== envelope.receivedAt ||
            !Array.isArray(disclosure.relatedFragmentIds) ||
            disclosure.relatedFragmentIds.some(value => typeof value !== 'string') ||
            typeof disclosure.actorId !== 'string' || typeof disclosure.fragmentId !== 'string' ||
            typeof disclosure.payload !== 'string' || typeof disclosure.salt !== 'string') return false;
        const key = Buffer.from(disclosure.salt, 'base64');
        if (key.length !== 32 || key.toString('base64') !== disclosure.salt) return false;
        const related = disclosure.relatedFragmentIds.map(value => keyedDigest(value, key)).sort();
        const matchingCommitments = keyedDigest(disclosure.actorId, key) === envelope.actorCommitment &&
            keyedDigest(disclosure.fragmentId, key) === envelope.fragmentCommitment &&
            canonicalJson(related) === canonicalJson(envelope.relatedFragmentCommitments) &&
            keyedDigest(disclosure.payload, key) === envelope.payloadCommitment;
        if (!matchingCommitments) return false;
        if (envelope.envelopeHash) {
            const { envelopeHash, ...commitment } = envelope;
            if (digest(canonicalJson(commitment)) !== envelopeHash) return false;
        }
        return true;
    } catch {
        return false;
    }
}

export function verifyPublicProvenanceEnvelope(
    entries: readonly PublicProvenanceEnvelopeEntry[],
    expectedHead?: string,
    startSequence = 0,
    startHash = PUBLIC_ENVELOPE_GENESIS_HASH,
): { valid: boolean; checkedSequence: number; headHash: string } {
    if (!Number.isSafeInteger(startSequence) || startSequence < 0 || !/^[a-f0-9]{64}$/.test(startHash)) {
        return { valid: false, checkedSequence: 0, headHash: startHash };
    }
    let headHash = startHash;
    let checkedSequence = startSequence;
    for (const entry of entries) {
        if (!entry) return { valid: false, checkedSequence, headHash };
        const commitments = [entry.actorCommitment, entry.fragmentCommitment, entry.payloadCommitment,
            entry.previousEnvelopeHash, entry.envelopeHash];
        if (entry.version !== 2 || !Number.isSafeInteger(entry.sequence) ||
            (entry.eventType !== 'EVIDENCE_ACCEPTED' && entry.eventType !== 'FUZZY_CORRECTION') ||
            !Number.isFinite(new Date(entry.receivedAt).getTime()) ||
            !Array.isArray(entry.relatedFragmentCommitments) ||
            commitments.some(commitment => typeof commitment !== 'string' || !/^[a-f0-9]{64}$/.test(commitment)) ||
            entry.relatedFragmentCommitments.some(commitment => typeof commitment !== 'string' || !/^[a-f0-9]{64}$/.test(commitment)) ||
            entry.sequence !== checkedSequence + 1 || entry.previousEnvelopeHash !== headHash) {
            return { valid: false, checkedSequence, headHash };
        }
        const { envelopeHash, ...commitment } = entry;
        if (digest(canonicalJson(commitment)) !== envelopeHash) return { valid: false, checkedSequence, headHash };
        checkedSequence = entry.sequence;
        headHash = envelopeHash;
    }
    return { valid: expectedHead === undefined || headHash === expectedHead, checkedSequence, headHash };
}

export interface EnvelopeMerkleProof {
    version: 1;
    sequence: number;
    totalEvents: number;
    siblings: string[];
}

function merkleLeafHash(sequence: number, envelopeHash: string): string {
    return digest(`LAZARUS-X:ENVELOPE-MERKLE:LEAF:V1\n${sequence}\n${envelopeHash}`);
}

function merkleParentHash(left: string, right: string): string {
    return digest(`LAZARUS-X:ENVELOPE-MERKLE:NODE:V1\n${left}\n${right}`);
}

function merkleCountedRoot(nodeHash: string, totalEvents: number): string {
    return digest(`LAZARUS-X:ENVELOPE-MERKLE:ROOT:V1\n${totalEvents}\n${nodeHash}`);
}

function validateEnvelopeHashes(envelopes: readonly Pick<PublicProvenanceEnvelopeEntry, 'sequence' | 'envelopeHash'>[]): void {
    for (let index = 0; index < envelopes.length; index++) {
        const entry = envelopes[index];
        if (!entry || entry.sequence !== index + 1 || !/^[a-f0-9]{64}$/.test(entry.envelopeHash)) {
            throw new TypeError('Merkle input must contain consecutive, well-formed envelope hashes from sequence 1.');
        }
    }
}

export interface EnvelopeMerkleTree {
    totalEvents: number;
    rootHash: string;
    levels: string[][];
}

/** Build a pre-indexed duplicate-last binary Merkle tree over ordered public envelope hashes. */
export function buildEnvelopeMerkleTree(
    envelopes: readonly Pick<PublicProvenanceEnvelopeEntry, 'sequence' | 'envelopeHash'>[],
): EnvelopeMerkleTree {
    validateEnvelopeHashes(envelopes);
    if (envelopes.length === 0) {
        return {
            totalEvents: 0,
            rootHash: merkleCountedRoot(digest('LAZARUS-X:ENVELOPE-MERKLE:EMPTY:V1'), 0),
            levels: [],
        };
    }
    const levels: string[][] = [];
    let currentLevel = envelopes.map(entry => merkleLeafHash(entry.sequence, entry.envelopeHash));
    levels.push(currentLevel);
    while (currentLevel.length > 1) {
        const parents: string[] = [];
        for (let offset = 0; offset < currentLevel.length; offset += 2) {
            parents.push(merkleParentHash(currentLevel[offset]!, currentLevel[offset + 1] ?? currentLevel[offset]!));
        }
        currentLevel = parents;
        levels.push(currentLevel);
    }
    const rootHash = merkleCountedRoot(currentLevel[0]!, envelopes.length);
    return {
        totalEvents: envelopes.length,
        rootHash,
        levels,
    };
}

/** Generate an inclusion proof in O(log N) operations from a pre-built Merkle tree. */
export function generateProofFromMerkleTree(
    tree: EnvelopeMerkleTree,
    sequence: number,
): EnvelopeMerkleProof {
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > tree.totalEvents) {
        throw new RangeError('Merkle proof sequence must be between 1 and the total events in the tree.');
    }
    const siblings: string[] = [];
    let index = sequence - 1;
    for (let levelIndex = 0; levelIndex < tree.levels.length - 1; levelIndex++) {
        const currentLevel = tree.levels[levelIndex]!;
        const siblingIndex = index ^ 1;
        siblings.push(currentLevel[siblingIndex] ?? currentLevel[index]!);
        index = Math.floor(index / 2);
    }
    return { version: 1, sequence, totalEvents: tree.totalEvents, siblings };
}

/** Build a duplicate-last binary Merkle tree over the ordered public envelope hashes. */
export function computeEnvelopeMerkleRoot(
    envelopes: readonly Pick<PublicProvenanceEnvelopeEntry, 'sequence' | 'envelopeHash'>[],
): string {
    return buildEnvelopeMerkleTree(envelopes).rootHash;
}

/** Generate an inclusion proof. The proof is O(log N); builds tree if not pre-computed. */
export function generateEnvelopeInclusionProof(
    sequence: number,
    totalEvents: number,
    envelopes: readonly Pick<PublicProvenanceEnvelopeEntry, 'sequence' | 'envelopeHash'>[],
): EnvelopeMerkleProof {
    if (!Number.isSafeInteger(totalEvents) || totalEvents !== envelopes.length) {
        throw new RangeError('Merkle proof sequence and event count must match the supplied envelope set.');
    }
    const tree = buildEnvelopeMerkleTree(envelopes);
    return generateProofFromMerkleTree(tree, sequence);
}

/** Verify one event in O(log N) time against a separately retained Merkle root. */
export function verifyEnvelopeInclusionProof(
    proof: EnvelopeMerkleProof,
    envelopeHash: string,
    rootHash: string,
): boolean {
    try {
        if (!proof || proof.version !== 1 || !Number.isSafeInteger(proof.sequence) ||
            !Number.isSafeInteger(proof.totalEvents) || proof.totalEvents < 1 ||
            proof.sequence < 1 || proof.sequence > proof.totalEvents ||
            !Array.isArray(proof.siblings) || proof.siblings.some(hash => typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) ||
            !/^[a-f0-9]{64}$/.test(envelopeHash) || !/^[a-f0-9]{64}$/.test(rootHash)) return false;
        let expectedDepth = 0;
        for (let width = proof.totalEvents; width > 1; width = Math.ceil(width / 2)) expectedDepth++;
        if (proof.siblings.length !== expectedDepth) return false;
        let current = merkleLeafHash(proof.sequence, envelopeHash);
        let index = proof.sequence - 1;
        let width = proof.totalEvents;
        for (const sibling of proof.siblings) {
            const siblingIndex = index ^ 1;
            if (siblingIndex >= width && sibling !== current) return false;
            current = (index & 1) === 0 ? merkleParentHash(current, sibling) : merkleParentHash(sibling, current);
            index = Math.floor(index / 2);
            width = Math.ceil(width / 2);
        }
        return merkleCountedRoot(current, proof.totalEvents) === rootHash;
    } catch {
        return false;
    }
}

type EventInput = Omit<ProvenanceEntry, 'sequence' | 'previousHash' | 'hash'>;

/** Stable JSON encoding used for payloads and hash preimages. */
export function canonicalJson(value: unknown): string {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new TypeError('Provenance payload numbers must be finite.');
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (typeof value === 'object') {
        const record = value as Record<string, unknown>;
        const keys = Object.keys(record).sort();
        return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
    }
    throw new TypeError('Provenance payload must contain only JSON values.');
}

function hashEvent(sequence: number, previousHash: string, input: EventInput): string {
    const preimage = canonicalJson({
        version: 1,
        sequence,
        eventType: input.eventType,
        fragmentId: input.fragmentId,
        relatedFragmentIds: input.relatedFragmentIds,
        actorId: input.actorId,
        receivedAt: input.receivedAt,
        payload: input.payload,
        previousHash,
    });
    return createHash('sha256').update(preimage, 'utf8').digest('hex');
}

export function appendProvenanceEntry(
    previous: ProvenanceEntry | undefined,
    input: EventInput
): ProvenanceEntry {
    const sequence = (previous?.sequence ?? 0) + 1;
    const previousHash = previous?.hash ?? PROVENANCE_GENESIS_HASH;
    return {
        ...input,
        relatedFragmentIds: [...input.relatedFragmentIds],
        sequence,
        previousHash,
        hash: hashEvent(sequence, previousHash, input),
    };
}

export interface ProvenanceVerification {
    valid: boolean;
    checkedEntries: number;
    headHash: string;
    error?: string;
}

/**
 * Checks ordering, payload serialization, and every link in the hash chain.
 * Keep the returned head hash outside the ledger (or sign it) for protection
 * against an attacker who can rewrite the entire database and recompute hashes.
 */
export function verifyProvenanceChain(
    entries: readonly ProvenanceEntry[],
    expectedHead?: string,
    expectedSequence?: number,
    startSequence = 0,
    startHash = PROVENANCE_GENESIS_HASH
): ProvenanceVerification {
    if (!Number.isSafeInteger(startSequence) || startSequence < 0 || !/^[a-f0-9]{64}$/.test(startHash)) {
        return { valid: false, checkedEntries: 0, headHash: startHash, error: 'Invalid chain starting checkpoint.' };
    }
    let previousHash = startHash;
    for (let index = 0; index < entries.length; index++) {
        const entry = entries[index];
        const expectedSequenceAtIndex = startSequence + index + 1;
        if (!entry || (entry.eventType !== 'EVIDENCE_ACCEPTED' && entry.eventType !== 'FUZZY_CORRECTION') ||
            typeof entry.fragmentId !== 'string' || typeof entry.actorId !== 'string' ||
            !Array.isArray(entry.relatedFragmentIds) || entry.relatedFragmentIds.some(id => typeof id !== 'string') ||
            typeof entry.receivedAt !== 'string' || typeof entry.payload !== 'string' ||
            !/^[a-f0-9]{64}$/.test(entry.hash) || !/^[a-f0-9]{64}$/.test(entry.previousHash)) {
            return { valid: false, checkedEntries: startSequence + index, headHash: previousHash, error: `Malformed ledger entry at index ${startSequence + index}.` };
        }
        if (entry.sequence !== expectedSequenceAtIndex) {
            return { valid: false, checkedEntries: startSequence + index, headHash: previousHash, error: `Unexpected sequence at entry ${startSequence + index}.` };
        }
        if (entry.previousHash !== previousHash) {
            return { valid: false, checkedEntries: startSequence + index, headHash: previousHash, error: `Previous hash mismatch at entry ${startSequence + index}.` };
        }
        let timestampIsCanonical = false;
        try { timestampIsCanonical = new Date(entry.receivedAt).toISOString() === entry.receivedAt; }
        catch { timestampIsCanonical = false; }
        if (!timestampIsCanonical) {
            return { valid: false, checkedEntries: startSequence + index, headHash: previousHash, error: `Invalid timestamp at entry ${startSequence + index}.` };
        }
        let parsedPayload: unknown;
        try {
            parsedPayload = JSON.parse(entry.payload);
            if (canonicalJson(parsedPayload) !== entry.payload) {
                return { valid: false, checkedEntries: startSequence + index, headHash: previousHash, error: `Non-canonical payload at entry ${startSequence + index}.` };
            }
        } catch {
            return { valid: false, checkedEntries: startSequence + index, headHash: previousHash, error: `Invalid payload at entry ${startSequence + index}.` };
        }
        const input: EventInput = {
            eventType: entry.eventType,
            fragmentId: entry.fragmentId,
            relatedFragmentIds: entry.relatedFragmentIds,
            actorId: entry.actorId,
            receivedAt: entry.receivedAt,
            payload: entry.payload,
        };
        const expectedHash = hashEvent(entry.sequence, previousHash, input);
        if (entry.hash !== expectedHash) {
            return { valid: false, checkedEntries: startSequence + index, headHash: previousHash, error: `Hash mismatch at entry ${startSequence + index}.` };
        }
        previousHash = entry.hash;
    }

    if (expectedSequence !== undefined && expectedSequence !== startSequence + entries.length) {
        return { valid: false, checkedEntries: startSequence + entries.length, headHash: previousHash, error: 'Stored sequence does not match ledger length.' };
    }
    if (expectedHead !== undefined && expectedHead !== previousHash) {
        return { valid: false, checkedEntries: startSequence + entries.length, headHash: previousHash, error: 'Stored head hash does not match ledger head.' };
    }
    return { valid: true, checkedEntries: startSequence + entries.length, headHash: previousHash };
}

export interface ProvenanceCheckpointManifest {
    version: 1;
    caseId: string;
    sequence: number;
    ledgerHead: string;
    publicEnvelopeHead: string;
    /** Optional v1 extension, covered by manifestDigest when present. */
    publicEnvelopeMerkleRoot?: string;
    timestamp: string;
    cumulativeEventCount: number;
    manifestDigest: string;
    note: string;
}

export function createProvenanceCheckpointManifest(params: {
    caseId: string;
    sequence: number;
    ledgerHead: string;
    publicEnvelopeHead: string;
    publicEnvelopeMerkleRoot?: string;
    cumulativeEventCount: number;
    timestamp?: string;
}): ProvenanceCheckpointManifest {
    const timestamp = params.timestamp ?? new Date().toISOString();
    const manifestCore = {
        version: 1 as const,
        caseId: params.caseId,
        sequence: params.sequence,
        ledgerHead: params.ledgerHead,
        publicEnvelopeHead: params.publicEnvelopeHead,
        ...(params.publicEnvelopeMerkleRoot ? { publicEnvelopeMerkleRoot: params.publicEnvelopeMerkleRoot } : {}),
        timestamp,
        cumulativeEventCount: params.cumulativeEventCount,
    };
    const manifestDigest = digest(canonicalJson(manifestCore));
    return {
        ...manifestCore,
        manifestDigest,
        note: 'Externally anchorable provenance checkpoint. Publish or retain manifestDigest to detect retroactive ledger or envelope rewrites.',
    };
}

export function verifyProvenanceCheckpointManifest(manifest: ProvenanceCheckpointManifest): boolean {
    try {
        if (!manifest || manifest.version !== 1 || typeof manifest.caseId !== 'string' || !manifest.caseId ||
            !Number.isSafeInteger(manifest.sequence) || manifest.sequence < 0 ||
            !Number.isSafeInteger(manifest.cumulativeEventCount) || manifest.cumulativeEventCount < 0 ||
            typeof manifest.ledgerHead !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.ledgerHead) ||
            typeof manifest.publicEnvelopeHead !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.publicEnvelopeHead) ||
            (manifest.publicEnvelopeMerkleRoot !== undefined &&
                (typeof manifest.publicEnvelopeMerkleRoot !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.publicEnvelopeMerkleRoot))) ||
            typeof manifest.manifestDigest !== 'string' || !/^[a-f0-9]{64}$/.test(manifest.manifestDigest) ||
            typeof manifest.timestamp !== 'string') {
            return false;
        }
        if (new Date(manifest.timestamp).toISOString() !== manifest.timestamp) return false;
        const manifestCore = {
            version: 1 as const,
            caseId: manifest.caseId,
            sequence: manifest.sequence,
            ledgerHead: manifest.ledgerHead,
            publicEnvelopeHead: manifest.publicEnvelopeHead,
            ...(manifest.publicEnvelopeMerkleRoot ? { publicEnvelopeMerkleRoot: manifest.publicEnvelopeMerkleRoot } : {}),
            timestamp: manifest.timestamp,
            cumulativeEventCount: manifest.cumulativeEventCount,
        };
        return digest(canonicalJson(manifestCore)) === manifest.manifestDigest;
    } catch {
        return false;
    }
}
