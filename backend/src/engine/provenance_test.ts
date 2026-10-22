import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    appendPublicProvenanceEnvelope,
    createProvenanceDisclosure,
    decryptCaseSalt,
    deriveEventCommitmentKey,
    encryptCaseSalt,
    parseProvenanceMasterKey,
    verifyProvenanceDisclosure,
    verifyPublicProvenanceEnvelope,
    PUBLIC_ENVELOPE_GENESIS_HASH,
    createProvenanceCheckpointManifest,
    verifyProvenanceCheckpointManifest,
    computeEnvelopeMerkleRoot,
    generateEnvelopeInclusionProof,
    verifyEnvelopeInclusionProof,
    buildEnvelopeMerkleTree,
    generateProofFromMerkleTree,
} from './provenance';
import { ProvenanceEntry } from './types';

const entry: ProvenanceEntry = {
    sequence: 1,
    eventType: 'EVIDENCE_ACCEPTED',
    fragmentId: 'fragment-1',
    relatedFragmentIds: [],
    actorId: 'user-1',
    receivedAt: '2026-10-11T12:00:00.000Z',
    payload: '{"field":"name","value":"Ada"}',
    previousHash: 'a'.repeat(64),
    hash: 'b'.repeat(64),
};

test('case salt is encrypted at rest and authenticated during decryption', () => {
    const masterKey = parseProvenanceMasterKey('ab'.repeat(32));
    const caseSalt = Buffer.alloc(32, 7);
    const first = encryptCaseSalt(caseSalt, masterKey);
    const second = encryptCaseSalt(caseSalt, masterKey);
    assert.notEqual(first, second, 'AES-GCM encryption should use a fresh nonce');
    assert.deepEqual(decryptCaseSalt(first, masterKey), caseSalt);
    assert.throws(() => decryptCaseSalt(first, Buffer.alloc(32, 8)), /Unsupported state|authenticate|unable to authenticate/i);
    assert.throws(() => parseProvenanceMasterKey('not-a-key'), /64 hexadecimal characters/);
});

test('event-scoped HMAC commitments hide dictionary-friendly fields and support selective disclosure', () => {
    const caseSalt = Buffer.alloc(32, 23);
    const eventKey = deriveEventCommitmentKey(caseSalt, entry.sequence);
    const otherEventKey = deriveEventCommitmentKey(caseSalt, entry.sequence + 1);
    assert.notDeepEqual(eventKey, otherEventKey, 'different event sequences must derive unlinkable keys');

    const envelope = appendPublicProvenanceEnvelope(entry, PUBLIC_ENVELOPE_GENESIS_HASH, eventKey);
    assert.equal('ledgerHash' in envelope, false, 'public commitment rows must not expose the unsalted ledger hash');
    assert.equal('ledgerPreviousHash' in envelope, false, 'public commitment rows must not expose the unsalted previous hash');
    assert.equal(verifyPublicProvenanceEnvelope([envelope], envelope.envelopeHash).valid, true);

    const disclosure = createProvenanceDisclosure(entry, eventKey);
    assert.equal(verifyProvenanceDisclosure(disclosure, envelope), true);
    assert.equal(verifyProvenanceDisclosure({ ...disclosure, payload: '{"value":"Grace"}' }, envelope), false);
    assert.equal(verifyProvenanceDisclosure(createProvenanceDisclosure(entry, otherEventKey), envelope), false);
});

test('verifyProvenanceDisclosure rejects tampered envelopeHash even if field HMACs match', () => {
    const caseSalt = Buffer.alloc(32, 42);
    const eventKey = deriveEventCommitmentKey(caseSalt, entry.sequence);
    const envelope = appendPublicProvenanceEnvelope(entry, PUBLIC_ENVELOPE_GENESIS_HASH, eventKey);
    const disclosure = createProvenanceDisclosure(entry, eventKey);

    assert.equal(verifyProvenanceDisclosure(disclosure, envelope), true);
    const tamperedEnvelope = { ...envelope, envelopeHash: '0'.repeat(64) };
    assert.equal(verifyProvenanceDisclosure(disclosure, tamperedEnvelope), false, 'envelope with mismatched envelopeHash must be rejected');
});

test('disclosure for one sequence cannot verify or reveal commitments for another sequence', () => {
    const caseSalt = Buffer.alloc(32, 99);
    const seq1Key = deriveEventCommitmentKey(caseSalt, 1);
    const seq2Key = deriveEventCommitmentKey(caseSalt, 2);

    const entry2: ProvenanceEntry = {
        ...entry,
        sequence: 2,
        fragmentId: 'fragment-2',
        previousHash: 'b'.repeat(64),
        hash: 'c'.repeat(64),
    };

    const envelope1 = appendPublicProvenanceEnvelope(entry, PUBLIC_ENVELOPE_GENESIS_HASH, seq1Key);
    const envelope2 = appendPublicProvenanceEnvelope(entry2, envelope1.envelopeHash, seq2Key);

    const disclosure1 = createProvenanceDisclosure(entry, seq1Key);
    const disclosure2 = createProvenanceDisclosure(entry2, seq2Key);

    assert.equal(verifyProvenanceDisclosure(disclosure1, envelope1), true);
    assert.equal(verifyProvenanceDisclosure(disclosure2, envelope2), true);

    // Cross-verification attempt: using disclosure1 on envelope2
    assert.equal(verifyProvenanceDisclosure(disclosure1, envelope2), false, 'seq 1 disclosure must fail against seq 2 envelope');
    // Using disclosure2 on envelope1
    assert.equal(verifyProvenanceDisclosure(disclosure2, envelope1), false, 'seq 2 disclosure must fail against seq 1 envelope');
    // Key mismatch: disclosure with seq 1 salt against seq 2 sequence
    assert.equal(verifyProvenanceDisclosure({ ...disclosure2, salt: disclosure1.salt }, envelope2), false, 'seq 1 salt must fail against seq 2 envelope commitments');
});

test('externally anchorable provenance checkpoint manifests verify and detect tampering', () => {
    const checkpoint = createProvenanceCheckpointManifest({
        caseId: 'case-test-123',
        sequence: 42,
        ledgerHead: 'a'.repeat(64),
        publicEnvelopeHead: 'b'.repeat(64),
        cumulativeEventCount: 42,
        timestamp: '2026-10-11T12:00:00.000Z',
    });

    assert.equal(checkpoint.version, 1);
    assert.equal(checkpoint.sequence, 42);
    assert.equal(verifyProvenanceCheckpointManifest(checkpoint), true, 'valid manifest must verify');

    // Mismatched digest
    assert.equal(
        verifyProvenanceCheckpointManifest({ ...checkpoint, manifestDigest: 'c'.repeat(64) }),
        false,
        'altered manifest digest must fail verification'
    );

    // Tampered sequence
    assert.equal(
        verifyProvenanceCheckpointManifest({ ...checkpoint, sequence: 43 }),
        false,
        'altered sequence without digest update must fail'
    );

    // Tampered ledger head
    assert.equal(
        verifyProvenanceCheckpointManifest({ ...checkpoint, ledgerHead: '0'.repeat(64) }),
        false,
        'altered ledger head must fail'
    );

    // Tampered public envelope head
    assert.equal(
        verifyProvenanceCheckpointManifest({ ...checkpoint, publicEnvelopeHead: '0'.repeat(64) }),
        false,
        'altered envelope head must fail'
    );

    // Tampered timestamp
    assert.equal(
        verifyProvenanceCheckpointManifest({ ...checkpoint, timestamp: '2026-10-11T12:00:01.000Z' }),
        false,
        'altered timestamp must fail'
    );

    // Malformed / invalid types
    assert.equal(verifyProvenanceCheckpointManifest({ ...checkpoint, version: 2 as any }), false);
    assert.equal(verifyProvenanceCheckpointManifest(null as any), false);
});

test('Merkle inclusion proofs verify every leaf across odd and even tree widths', () => {
    const caseSalt = Buffer.alloc(32, 91);
    const sizes = [1, 2, 3, 5, 17];
    for (const size of sizes) {
        let previousHash = PUBLIC_ENVELOPE_GENESIS_HASH;
        const envelopes = Array.from({ length: size }, (_, index) => {
            const event = { ...entry, sequence: index + 1, fragmentId: `fragment-${index + 1}` };
            const envelope = appendPublicProvenanceEnvelope(
                event,
                previousHash,
                deriveEventCommitmentKey(caseSalt, index + 1),
            );
            previousHash = envelope.envelopeHash;
            return envelope;
        });
        const root = computeEnvelopeMerkleRoot(envelopes);
        for (const envelope of envelopes) {
            const proof = generateEnvelopeInclusionProof(envelope.sequence, size, envelopes);
            assert.equal(verifyEnvelopeInclusionProof(proof, envelope.envelopeHash, root), true,
                `sequence ${envelope.sequence} should verify in a ${size}-event tree`);
            assert.equal(proof.siblings.length, Math.ceil(Math.log2(size)));
        }
        const checkpoint = createProvenanceCheckpointManifest({
            caseId: `case-${size}`,
            sequence: size,
            ledgerHead: 'a'.repeat(64),
            publicEnvelopeHead: previousHash,
            publicEnvelopeMerkleRoot: root,
            cumulativeEventCount: size,
            timestamp: '2026-10-11T12:00:00.000Z',
        });
        assert.equal(verifyProvenanceCheckpointManifest(checkpoint), true);
        assert.equal(verifyProvenanceCheckpointManifest({ ...checkpoint, publicEnvelopeMerkleRoot: '0'.repeat(64) }), false);
    }
});

test('Merkle proofs reject altered leaf, position, sibling, count, and root', () => {
    let previousHash = PUBLIC_ENVELOPE_GENESIS_HASH;
    const envelopes = Array.from({ length: 5 }, (_, index) => {
        const event = { ...entry, sequence: index + 1, fragmentId: `fragment-${index + 1}` };
        const envelope = appendPublicProvenanceEnvelope(event, previousHash, deriveEventCommitmentKey(Buffer.alloc(32, 3), index + 1));
        previousHash = envelope.envelopeHash;
        return envelope;
    });
    const root = computeEnvelopeMerkleRoot(envelopes);
    const proof = generateEnvelopeInclusionProof(5, 5, envelopes);
    assert.equal(verifyEnvelopeInclusionProof(proof, envelopes[4]!.envelopeHash, root), true);
    assert.equal(verifyEnvelopeInclusionProof(proof, envelopes[3]!.envelopeHash, root), false);
    assert.equal(verifyEnvelopeInclusionProof({ ...proof, sequence: 4 }, envelopes[4]!.envelopeHash, root), false);
    assert.equal(verifyEnvelopeInclusionProof({ ...proof, totalEvents: 6 }, envelopes[4]!.envelopeHash, root), false);
    assert.equal(verifyEnvelopeInclusionProof({ ...proof, siblings: ['0'.repeat(64), ...proof.siblings.slice(1)] }, envelopes[4]!.envelopeHash, root), false);
    assert.equal(verifyEnvelopeInclusionProof(proof, envelopes[4]!.envelopeHash, '0'.repeat(64)), false);
    assert.throws(() => generateEnvelopeInclusionProof(1, 4, envelopes), /event count/);
    assert.throws(() => computeEnvelopeMerkleRoot([{ sequence: 2, envelopeHash: 'a'.repeat(64) }]), /consecutive/);
});

test('pre-indexed EnvelopeMerkleTree compiles once and generates verified O(log N) proofs without rebuilding', () => {
    const caseSalt = Buffer.alloc(32, 77);
    const sizes = [1, 2, 4, 7, 16];
    for (const size of sizes) {
        let previousHash = PUBLIC_ENVELOPE_GENESIS_HASH;
        const envelopes = Array.from({ length: size }, (_, index) => {
            const event = { ...entry, sequence: index + 1, fragmentId: `fragment-${index + 1}` };
            const envelope = appendPublicProvenanceEnvelope(
                event,
                previousHash,
                deriveEventCommitmentKey(caseSalt, index + 1),
            );
            previousHash = envelope.envelopeHash;
            return envelope;
        });

        // 1. Compile tree once in O(N)
        const tree = buildEnvelopeMerkleTree(envelopes);
        assert.equal(tree.totalEvents, size);
        assert.equal(tree.rootHash, computeEnvelopeMerkleRoot(envelopes));
        assert.equal(tree.levels.length, size === 1 ? 1 : Math.ceil(Math.log2(size)) + 1);

        // 2. Generate and verify O(log N) proofs from the pre-indexed tree
        for (let seq = 1; seq <= size; seq++) {
            const proof = generateProofFromMerkleTree(tree, seq);
            const expected = generateEnvelopeInclusionProof(seq, size, envelopes);
            assert.deepEqual(proof, expected, `tree proof must match baseline at sequence ${seq}/${size}`);
            assert.equal(
                verifyEnvelopeInclusionProof(proof, envelopes[seq - 1]!.envelopeHash, tree.rootHash),
                true,
                `proof for sequence ${seq} must verify against tree root`
            );
        }

        // 3. Out of bounds boundary tests
        assert.throws(() => generateProofFromMerkleTree(tree, 0), /between 1 and the total events/);
        assert.throws(() => generateProofFromMerkleTree(tree, size + 1), /between 1 and the total events/);
    }
});
