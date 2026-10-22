import { createHash } from 'crypto';
import { canonicalJson, type ProvenanceCheckpointManifest, type PublicProvenanceEnvelopeEntry } from './provenance';

export const OFFLINE_AUDIT_BUNDLE_FORMAT = 'LAZARUS-X-OFFLINE-AUDIT-BUNDLE';
export const OFFLINE_AUDIT_BUNDLE_VERSION = 1;
export const OFFLINE_AUDIT_BUNDLE_MEDIA_TYPE = 'application/vnd.lazarus-x.audit-bundle.v1+json';

/**
 * Standalone verifier shipped inside each export. It intentionally uses only
 * Node's standard library and distinguishes self-consistency from an external
 * trust anchor. It does not establish that candidate data is factually true.
 */
export const OFFLINE_AUDIT_VERIFIER_SOURCE = String.raw`'use strict';
const fs = require('node:fs');
const crypto = require('node:crypto');

function fail(message) { throw new Error(message); }
function hash(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail('Non-finite JSON number.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ':' + canonical(value[key]);
    }).join(',') + '}';
  }
  fail('Unsupported JSON value.');
}
function isHash(value) { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
function sameKeys(value, keys) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify(keys.slice().sort());
}
function merkleRoot(envelopes) {
  function leaf(sequence, envelopeHash) {
    return hash('LAZARUS-X:ENVELOPE-MERKLE:LEAF:V1' + String.fromCharCode(10) + sequence + String.fromCharCode(10) + envelopeHash);
  }
  function parent(left, right) {
    return hash('LAZARUS-X:ENVELOPE-MERKLE:NODE:V1' + String.fromCharCode(10) + left + String.fromCharCode(10) + right);
  }
  function counted(node, count) {
    return hash('LAZARUS-X:ENVELOPE-MERKLE:ROOT:V1' + String.fromCharCode(10) + count + String.fromCharCode(10) + node);
  }
  if (envelopes.length === 0) return counted(hash('LAZARUS-X:ENVELOPE-MERKLE:EMPTY:V1'), 0);
  let level = envelopes.map(function (event) { return leaf(event.sequence, event.envelopeHash); });
  while (level.length > 1) {
    const next = [];
    for (let index = 0; index < level.length; index += 2) next.push(parent(level[index], level[index + 1] || level[index]));
    level = next;
  }
  return counted(level[0], envelopes.length);
}
function verify() {
  const bundlePath = process.argv[2];
  if (!bundlePath) fail('Usage: node verify-audit-bundle.cjs <bundle.json> [expected-bundle-sha256]');
  const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
  if (!bundle || bundle.format !== 'LAZARUS-X-OFFLINE-AUDIT-BUNDLE' || bundle.version !== 1) fail('Unsupported audit bundle format.');
  if (typeof bundle.verificationScript !== 'string' || !isHash(bundle.verificationScriptSha256)) fail('Verifier source metadata is malformed.');
  if (hash(fs.readFileSync(__filename, 'utf8')) !== bundle.verificationScriptSha256 ||
      hash(bundle.verificationScript) !== bundle.verificationScriptSha256) fail('Verifier source digest does not match the bundled digest.');
  const core = {};
  Object.keys(bundle).forEach(function (key) {
    if (key !== 'bundleDigest' && key !== 'verificationScript') core[key] = bundle[key];
  });
  if (!isHash(bundle.bundleDigest) || hash(canonical(core)) !== bundle.bundleDigest) fail('Bundle digest mismatch.');
  const externalDigest = process.argv[3];
  if (externalDigest !== undefined && (!isHash(externalDigest) || externalDigest !== bundle.bundleDigest)) fail('External bundle digest mismatch.');
  if (!Array.isArray(bundle.publicEnvelopes) || !bundle.checkpoint || !Array.isArray(bundle.candidateSnapshot && bundle.candidateSnapshot.candidates)) fail('Bundle contents are malformed.');

  const genesis = hash('LAZARUS-X:PUBLIC-PROVENANCE-ENVELOPE:V2:GENESIS');
  let head = genesis;
  const envelopeKeys = ['version', 'sequence', 'eventType', 'receivedAt', 'actorCommitment', 'fragmentCommitment', 'relatedFragmentCommitments', 'payloadCommitment', 'previousEnvelopeHash', 'envelopeHash'];
  for (let index = 0; index < bundle.publicEnvelopes.length; index += 1) {
    const event = bundle.publicEnvelopes[index];
    if (!sameKeys(event, envelopeKeys) || event.version !== 2 || event.sequence !== index + 1 ||
        (event.eventType !== 'EVIDENCE_ACCEPTED' && event.eventType !== 'FUZZY_CORRECTION') ||
        typeof event.receivedAt !== 'string' || new Date(event.receivedAt).toISOString() !== event.receivedAt ||
        !Array.isArray(event.relatedFragmentCommitments) || event.relatedFragmentCommitments.some(function (item) { return !isHash(item); }) ||
        event.relatedFragmentCommitments.slice().sort().some(function (item, itemIndex) { return item !== event.relatedFragmentCommitments[itemIndex]; }) ||
        ![event.actorCommitment, event.fragmentCommitment, event.payloadCommitment, event.previousEnvelopeHash, event.envelopeHash].every(isHash) ||
        event.previousEnvelopeHash !== head) fail('Envelope structure or chain link is invalid at sequence ' + (index + 1) + '.');
    const commitment = {
      version: event.version,
      sequence: event.sequence,
      eventType: event.eventType,
      receivedAt: event.receivedAt,
      actorCommitment: event.actorCommitment,
      fragmentCommitment: event.fragmentCommitment,
      relatedFragmentCommitments: event.relatedFragmentCommitments,
      payloadCommitment: event.payloadCommitment,
      previousEnvelopeHash: event.previousEnvelopeHash
    };
    if (hash(canonical(commitment)) !== event.envelopeHash) fail('Envelope digest mismatch at sequence ' + (index + 1) + '.');
    head = event.envelopeHash;
  }

  const checkpoint = bundle.checkpoint;
  if (!checkpoint || checkpoint.version !== 1 || checkpoint.caseId !== bundle.caseId ||
      checkpoint.sequence !== bundle.publicEnvelopes.length || checkpoint.cumulativeEventCount !== checkpoint.sequence ||
      checkpoint.publicEnvelopeHead !== head || !isHash(checkpoint.ledgerHead) || !isHash(checkpoint.publicEnvelopeMerkleRoot) ||
      checkpoint.publicEnvelopeMerkleRoot !== merkleRoot(bundle.publicEnvelopes) || !isHash(checkpoint.manifestDigest) ||
      !Number.isFinite(Date.parse(checkpoint.timestamp)) || new Date(checkpoint.timestamp).toISOString() !== checkpoint.timestamp) {
    fail('Checkpoint fields do not match the envelope chain.');
  }
  const checkpointCore = {
    version: checkpoint.version,
    caseId: checkpoint.caseId,
    sequence: checkpoint.sequence,
    ledgerHead: checkpoint.ledgerHead,
    publicEnvelopeHead: checkpoint.publicEnvelopeHead,
    publicEnvelopeMerkleRoot: checkpoint.publicEnvelopeMerkleRoot,
    timestamp: checkpoint.timestamp,
    cumulativeEventCount: checkpoint.cumulativeEventCount
  };
  if (hash(canonical(checkpointCore)) !== checkpoint.manifestDigest) fail('Checkpoint digest mismatch.');
  const snapshot = bundle.candidateSnapshot;
  if (typeof bundle.caseId !== 'string' || bundle.caseId.length === 0 ||
      !bundle.schema || !Array.isArray(bundle.schema.tables) || !Array.isArray(bundle.schema.constraints) ||
      !Number.isFinite(Date.parse(bundle.generatedAt)) || new Date(bundle.generatedAt).toISOString() !== bundle.generatedAt ||
      snapshot.candidates.length > 20 || !Number.isSafeInteger(snapshot.totalCandidates) || snapshot.totalCandidates < snapshot.candidates.length ||
      snapshot.truncated !== (snapshot.totalCandidates > snapshot.candidates.length)) fail('Candidate snapshot metadata is inconsistent.');

  process.stdout.write(JSON.stringify({
    valid: true,
    bundleDigest: bundle.bundleDigest,
    externallyAnchored: externalDigest !== undefined,
    verifiedEnvelopeCount: bundle.publicEnvelopes.length,
    verifiedPublicEnvelopeHead: head,
    verifiedMerkleRoot: checkpoint.publicEnvelopeMerkleRoot,
    candidateSnapshots: snapshot.candidates.length,
    limitations: ['Candidate values are included data and are not proven true by this verifier.', 'The private ledger head is committed by the checkpoint but cannot be recomputed from public envelopes.', 'Without the optional expected digest, this result proves package self-consistency, not who created it or when.']
  }, null, 2) + String.fromCharCode(10));
}
try { verify(); } catch (error) {
  process.stderr.write('Audit verification failed: ' + (error && error.message ? error.message : 'invalid bundle') + String.fromCharCode(10));
  process.exitCode = 1;
}
`;

export interface OfflineAuditBundleInput {
    caseId: string;
    generatedAt: string;
    schema: { tables: string[]; constraints: unknown[] };
    candidateSnapshot: {
        totalCandidates: number;
        truncated: boolean;
        candidates: Array<Record<string, unknown>>;
    };
    publicEnvelopes: PublicProvenanceEnvelopeEntry[];
    checkpoint: ProvenanceCheckpointManifest;
}

export function createOfflineAuditBundle(input: OfflineAuditBundleInput): Record<string, unknown> {
    const verificationScriptSha256 = createHash('sha256').update(OFFLINE_AUDIT_VERIFIER_SOURCE, 'utf8').digest('hex');
    const core = {
        format: OFFLINE_AUDIT_BUNDLE_FORMAT,
        version: OFFLINE_AUDIT_BUNDLE_VERSION,
        mediaType: OFFLINE_AUDIT_BUNDLE_MEDIA_TYPE,
        generatedAt: input.generatedAt,
        caseId: input.caseId,
        schema: input.schema,
        candidateSnapshot: input.candidateSnapshot,
        publicEnvelopes: input.publicEnvelopes,
        checkpoint: input.checkpoint,
        verificationScriptSha256,
    };
    const bundleDigest = createHash('sha256').update(canonicalJson(core), 'utf8').digest('hex');
    return {
        ...core,
        bundleDigest,
        verificationScript: OFFLINE_AUDIT_VERIFIER_SOURCE,
    };
}
