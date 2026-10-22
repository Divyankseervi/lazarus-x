import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
    appendPublicProvenanceEnvelope,
    createProvenanceCheckpointManifest,
    computeEnvelopeMerkleRoot,
    deriveEventCommitmentKey,
    PUBLIC_ENVELOPE_GENESIS_HASH,
} from './provenance';
import { createOfflineAuditBundle, OFFLINE_AUDIT_VERIFIER_SOURCE } from './audit_bundle';
import { ProvenanceEntry } from './types';

test('offline audit bundle verifier runs with Node built-ins and detects tampering', () => {
    const entry: ProvenanceEntry = {
        sequence: 1,
        eventType: 'EVIDENCE_ACCEPTED',
        fragmentId: 'fragment-a',
        relatedFragmentIds: [],
        actorId: 'investigator-a',
        receivedAt: '2026-10-11T12:00:00.000Z',
        payload: '{"field":"name","value":"Ada"}',
        previousHash: '0'.repeat(64),
        hash: '1'.repeat(64),
    };
    const envelope = appendPublicProvenanceEnvelope(
        entry,
        PUBLIC_ENVELOPE_GENESIS_HASH,
        deriveEventCommitmentKey(Buffer.alloc(32, 6), 1),
    );
    const root = computeEnvelopeMerkleRoot([envelope]);
    const checkpoint = createProvenanceCheckpointManifest({
        caseId: 'case-offline',
        sequence: 1,
        ledgerHead: '2'.repeat(64),
        publicEnvelopeHead: envelope.envelopeHash,
        publicEnvelopeMerkleRoot: root,
        cumulativeEventCount: 1,
        timestamp: '2026-10-11T12:01:00.000Z',
    });
    const bundle = createOfflineAuditBundle({
        caseId: 'case-offline',
        generatedAt: '2026-10-11T12:02:00.000Z',
        schema: { tables: ['Department'], constraints: [] },
        candidateSnapshot: {
            totalCandidates: 1,
            truncated: false,
            candidates: [{ rank: 1, id: 'S-0', data: { Department: [{ name: 'Ada' }] } }],
        },
        publicEnvelopes: [envelope],
        checkpoint,
    });

    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'lazarus-x-bundle-test-'));
    try {
        const bundlePath = path.join(tempDir, 'bundle.json');
        const verifierPath = path.join(tempDir, 'verify-audit-bundle.cjs');
        writeFileSync(bundlePath, JSON.stringify(bundle), 'utf8');
        writeFileSync(verifierPath, OFFLINE_AUDIT_VERIFIER_SOURCE, 'utf8');
        assert.equal(readFileSync(verifierPath, 'utf8'), bundle.verificationScript as string);
        const bundleDigest = bundle.bundleDigest as string;
        const valid = spawnSync(process.execPath, [verifierPath, bundlePath, bundleDigest], { encoding: 'utf8' });
        assert.equal(valid.status, 0, valid.stderr);
        const result = JSON.parse(valid.stdout) as { valid: boolean; externallyAnchored: boolean; verifiedEnvelopeCount: number };
        assert.equal(result.valid, true);
        assert.equal(result.externallyAnchored, true);
        assert.equal(result.verifiedEnvelopeCount, 1);

        const selfConsistentOnly = execFileSync(process.execPath, [verifierPath, bundlePath], { encoding: 'utf8' });
        assert.equal((JSON.parse(selfConsistentOnly) as { externallyAnchored: boolean }).externallyAnchored, false);
        const wrongAnchor = spawnSync(process.execPath, [verifierPath, bundlePath, 'f'.repeat(64)], { encoding: 'utf8' });
        assert.notEqual(wrongAnchor.status, 0);
        assert.match(wrongAnchor.stderr, /External bundle digest mismatch/);

        const tampered = structuredClone(bundle) as Record<string, any>;
        tampered.publicEnvelopes[0].envelopeHash = 'f'.repeat(64);
        writeFileSync(bundlePath, JSON.stringify(tampered), 'utf8');
        const invalid = spawnSync(process.execPath, [verifierPath, bundlePath], { encoding: 'utf8' });
        assert.notEqual(invalid.status, 0);
        assert.match(invalid.stderr, /Bundle digest mismatch/);
    } finally {
        rmSync(tempDir, { recursive: true, force: true });
    }
});
