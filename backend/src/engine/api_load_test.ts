import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { PrismaClient } from '@prisma/client';
import { verifyProvenanceChain, verifyEnvelopeInclusionProof } from './provenance';

const backendDir = path.resolve(__dirname, '../..');
const tempRoot = path.resolve(os.tmpdir());
const prismaCli = path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js');
const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
const prismaMasterKey = Buffer.alloc(32, 0x42);

type HttpResult = { status: number; code?: string; data: Record<string, unknown>; elapsedMs: number };
type AppServer = { prisma: PrismaClient; server: Server; baseUrl: string };

function assertOwnedTempDirectory(directory: string): void {
    const resolved = path.resolve(directory);
    const relative = path.relative(tempRoot, resolved);
    if (path.basename(resolved).startsWith('lazarus-x-e2e-') === false ||
        relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error('Refusing to use or remove an API benchmark directory outside its dedicated OS-temp namespace.');
    }
}

async function listen(prisma: PrismaClient): Promise<AppServer> {
    const { createApp } = await import('../index');
    const app = createApp(prisma, prismaMasterKey, { trustProxy: false });
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Could not bind the local API benchmark server.');
    return { prisma, server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(instance: AppServer): Promise<void> {
    await new Promise<void>((resolve, reject) => {
        instance.server.close(error => error ? reject(error) : resolve());
    });
}

async function jsonRequest(url: string, init?: RequestInit): Promise<{ response: Response; data: Record<string, unknown> }> {
    const response = await fetch(url, init);
    const text = await response.text();
    let parsed: unknown = {};
    try { parsed = text.length > 0 ? JSON.parse(text) : {}; } catch { parsed = {}; }
    const data = parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    return { response, data };
}

async function createCase(baseUrl: string, token: string): Promise<string> {
    const { response, data } = await jsonRequest(`${baseUrl}/api/cases`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
    });
    assert.equal(response.status, 200, `case creation failed with HTTP ${response.status}`);
    assert.equal(typeof data.id, 'string');
    return data.id as string;
}

async function submitEvidence(baseUrl: string, token: string, caseId: string, evidence: Array<Record<string, unknown>>): Promise<HttpResult> {
    const startedAt = performance.now();
    const { response, data } = await jsonRequest(`${baseUrl}/api/cases/${encodeURIComponent(caseId)}/evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence }),
    });
    return {
        status: response.status,
        ...(typeof data.code === 'string' ? { code: data.code } : {}),
        data,
        elapsedMs: performance.now() - startedAt,
    };
}

function percentile(values: number[], fraction: number): number {
    const ordered = [...values].sort((left, right) => left - right);
    return ordered[Math.max(0, Math.ceil(ordered.length * fraction) - 1)] ?? 0;
}

function pushIsolatedSchema(databaseUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [
            prismaCli, 'db', 'push', '--schema', schemaPath, '--skip-generate',
        ], {
            cwd: backendDir,
            env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: 'info' },
            windowsHide: true,
            stdio: 'inherit',
        });
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill();
        }, 120_000);
        timeout.unref();
        child.once('error', error => {
            clearTimeout(timeout);
            reject(error);
        });
        child.once('exit', (code, signal) => {
            clearTimeout(timeout);
            if (code === 0) resolve();
            else reject(new Error(timedOut
                ? 'Prisma isolated schema setup exceeded its 120 second limit.'
                : `Prisma isolated schema setup exited with ${code ?? signal}.`));
        });
    });
}

async function verifyStoredLedger(instance: AppServer, token: string, caseId: string): Promise<number> {
    const [caseRow, rows] = await Promise.all([
        instance.prisma.reconstructionCase.findUnique({
            where: { id: caseId },
            select: { provenanceHead: true, provenanceSequence: true },
        }),
        instance.prisma.evidenceProvenanceEntry.findMany({
            where: { caseId }, orderBy: { sequence: 'asc' },
        }),
    ]);
    assert.ok(caseRow, 'case row should remain present after concurrent API writes');
    const entries = rows.map(row => ({
        sequence: row.sequence,
        eventType: row.eventType as 'EVIDENCE_ACCEPTED' | 'FUZZY_CORRECTION',
        fragmentId: row.fragmentId,
        relatedFragmentIds: JSON.parse(row.relatedFragmentIds) as string[],
        actorId: row.actorId,
        receivedAt: row.receivedAt.toISOString(),
        payload: row.payload,
        previousHash: row.previousHash,
        hash: row.hash,
    }));
    assert.deepEqual(entries.map(entry => entry.sequence), entries.map((_entry, index) => index + 1),
        'stored provenance sequence must be contiguous without gaps or duplicates');
    const verification = verifyProvenanceChain(entries, caseRow.provenanceHead, caseRow.provenanceSequence);
    assert.equal(verification.valid, true, verification.error ?? 'stored provenance chain should verify');
    assert.equal(rows.length, caseRow.provenanceSequence, 'case head sequence must equal persisted event count');

    const { response, data } = await jsonRequest(`${instance.baseUrl}/api/cases/${encodeURIComponent(caseId)}/provenance?view=commitments&limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.equal(data.valid, true, 'API ledger verifier should report the database-backed chain valid');
    assert.equal(data.checkedEntries, rows.length);
    return rows.length;
}

function installTransactionBarrier(clients: PrismaClient[]): () => void {
    let arrived = 0;
    let releaseBarrier!: () => void;
    let armed = true;
    const barrier = new Promise<void>(resolve => { releaseBarrier = resolve; });
    const originals: Array<{ client: PrismaClient; original: (...args: any[]) => Promise<any> }> = [];
    const timeout = setTimeout(() => {
        armed = false;
        releaseBarrier();
    }, 15_000);
    timeout.unref();

    for (const client of clients) {
        const mutable = client as any;
        const original = mutable.$transaction.bind(client) as (...args: any[]) => Promise<any>;
        originals.push({ client, original });
        mutable.$transaction = (...args: any[]) => {
            if (armed) {
                arrived += 1;
                if (arrived === clients.length) {
                    armed = false;
                    clearTimeout(timeout);
                    releaseBarrier();
                }
                return barrier.then(() => original(...args));
            }
            return original(...args);
        };
    }

    return () => {
        armed = false;
        clearTimeout(timeout);
        releaseBarrier();
        for (const { client, original } of originals) (client as any).$transaction = original;
    };
}

async function main(): Promise<void> {
    const tempDirectory = await mkdtemp(path.join(tempRoot, 'lazarus-x-e2e-'));
    assertOwnedTempDirectory(tempDirectory);
    const databaseUrl = `file:${path.join(tempDirectory, 'e2e.db').replace(/\\/g, '/')}`;
    const clients: PrismaClient[] = [];
    const servers: AppServer[] = [];

    try {
        await pushIsolatedSchema(databaseUrl);
        process.stdout.write('ISOLATED_SQLITE_SCHEMA=READY\n');

        const { PrismaClient } = await import('@prisma/client');
        const primaryClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
        const secondClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
        clients.push(primaryClient, secondClient);
        await Promise.all(clients.map(client => client.$connect()));
        const primaryServer = await listen(primaryClient);
        servers.push(primaryServer);
        const secondaryServer = await listen(secondClient);
        servers.push(secondaryServer);
        const primary = servers[0]!;
        const secondary = servers[1]!;

        const suffix = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const email = `api-load-${suffix}@example.test`;
        const password = cryptoRandomPassword();
        const register = await jsonRequest(`${primary.baseUrl}/api/auth/register`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });
        assert.equal(register.response.status, 201, 'temporary load investigator should register');
        const workerCount = Number.parseInt(process.env.LAZARUS_API_LOAD_WORKERS ?? '4', 10);
        const requestsPerWorker = Number.parseInt(process.env.LAZARUS_API_LOAD_REQUESTS_PER_WORKER ?? '6', 10);
        assert.ok(Number.isSafeInteger(workerCount) && workerCount >= 2 && workerCount <= 8, 'worker count must be 2–8');
        assert.ok(Number.isSafeInteger(requestsPerWorker) && requestsPerWorker >= 2 && requestsPerWorker <= 20, 'requests per worker must be 2–20');
        const totalRequests = workerCount * requestsPerWorker;
        assert.ok(totalRequests < 100, 'benchmark stays below the API write-rate limit');

        const workerTokens: string[] = [];
        for (let worker = 0; worker < workerCount; worker += 1) {
            const login = await jsonRequest(`${primary.baseUrl}/api/auth/login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            assert.equal(login.response.status, 200, `investigator worker session ${worker + 1} should authenticate`);
            assert.equal(typeof login.data.token, 'string');
            workerTokens.push(login.data.token as string);
        }
        const token = workerTokens[0]!;

        const serializedCaseId = await createCase(primary.baseUrl, token as string);
        const seed = await submitEvidence(primary.baseUrl, token as string, serializedCaseId, [
            { table: 'Employee', recordId: 1, field: 'name', value: 'Seed record' },
        ]);
        assert.equal(seed.status, 200, 'seed event should be accepted');

        const initialProofResponse = await jsonRequest(`${primary.baseUrl}/api/cases/${encodeURIComponent(serializedCaseId)}/provenance/proofs/1`, {
            headers: { Authorization: `Bearer ${token as string}` },
        });
        assert.equal(initialProofResponse.response.status, 200, 'initial proof should compile and populate accumulator cache');
        const initialProof = initialProofResponse.data;
        const initialCheckpoint = initialProof.checkpoint as Record<string, unknown>;
        const initialProofBody = initialProof.proof as Parameters<typeof verifyEnvelopeInclusionProof>[0];
        const initialEnvelope = initialProof.envelope as Record<string, unknown>;
        assert.equal(verifyEnvelopeInclusionProof(initialProofBody, String(initialEnvelope.envelopeHash), String(initialCheckpoint.publicEnvelopeMerkleRoot)), true);

        const serializedJobs = Array.from({ length: totalRequests }, (_unused, index) => {
            const worker = index % workerCount;
            const conflictsWithSeed = index % 2 === 0;
            return {
                table: 'Employee',
                recordId: conflictsWithSeed ? 1 : 100 + index,
                field: 'name',
                value: conflictsWithSeed ? `Conflicting observation ${index}` : `Independent record ${index}`,
                worker,
            };
        });
        const serializedStartedAt = performance.now();
        const serializedResults = await Promise.all(serializedJobs.map(job => submitEvidence(
            primary.baseUrl, workerTokens[job.worker]!, serializedCaseId, [{ table: job.table, recordId: job.recordId, field: job.field, value: job.value }],
        )));
        const serializedElapsedMs = performance.now() - serializedStartedAt;
        assert.ok(serializedResults.every(result => result.status === 200),
            `single-instance case lock should serialize all writes successfully; statuses=${serializedResults.map(item => item.status).join(',')}`);
        const serializedEventCount = await verifyStoredLedger(primary, token as string, serializedCaseId);
        assert.equal(serializedEventCount, totalRequests + 1, 'each successful request should append exactly one event');

        const afterBatchRebuildStartedAt = performance.now();
        const afterBatchRebuildResult = await jsonRequest(`${primary.baseUrl}/api/cases/${encodeURIComponent(serializedCaseId)}/provenance/proofs/1`, {
            headers: { Authorization: `Bearer ${token as string}` },
        });
        assert.equal(afterBatchRebuildResult.response.status, 200, 'proof after concurrent writes should rebuild the invalidated accumulator');
        const beforeInvalidationCheckpoint = afterBatchRebuildResult.data.checkpoint as Record<string, unknown>;
        const accumulatorRebuildMs = performance.now() - afterBatchRebuildStartedAt;
        assert.notEqual(beforeInvalidationCheckpoint.publicEnvelopeMerkleRoot, initialCheckpoint.publicEnvelopeMerkleRoot,
            'concurrent evidence intake should invalidate the seed-only accumulator');

        const hotProofSamples: number[] = [];
        for (let index = 0; index < 4; index++) {
            const startedAt = performance.now();
            const result = await jsonRequest(`${primary.baseUrl}/api/cases/${encodeURIComponent(serializedCaseId)}/provenance/proofs/1`, {
                headers: { Authorization: `Bearer ${token as string}` },
            });
            assert.equal(result.response.status, 200);
            assert.equal((result.data.checkpoint as Record<string, unknown>).publicEnvelopeMerkleRoot, beforeInvalidationCheckpoint.publicEnvelopeMerkleRoot,
                'unchanged case should reuse the same cached root');
            hotProofSamples.push(performance.now() - startedAt);
        }
        const invalidatingWrite = await submitEvidence(primary.baseUrl, token as string, serializedCaseId, [
            { table: 'Employee', recordId: 1, field: 'name', value: 'Post-cache conflicting observation' },
        ]);
        assert.equal(invalidatingWrite.status, 200, 'cache invalidation update should commit');
        const rebuiltProofResult = await jsonRequest(`${primary.baseUrl}/api/cases/${encodeURIComponent(serializedCaseId)}/provenance/proofs/${serializedEventCount + 1}`, {
            headers: { Authorization: `Bearer ${token as string}` },
        });
        assert.equal(rebuiltProofResult.response.status, 200, 'proof after a write should rebuild the accumulator');
        const rebuiltCheckpoint = rebuiltProofResult.data.checkpoint as Record<string, unknown>;
        const rebuiltProof = rebuiltProofResult.data.proof as Parameters<typeof verifyEnvelopeInclusionProof>[0];
        const rebuiltEnvelope = rebuiltProofResult.data.envelope as Record<string, unknown>;
        assert.notEqual(rebuiltCheckpoint.publicEnvelopeMerkleRoot, beforeInvalidationCheckpoint.publicEnvelopeMerkleRoot,
            'write must invalidate the prior cached Merkle root');
        assert.equal(verifyEnvelopeInclusionProof(rebuiltProof, String(rebuiltEnvelope.envelopeHash), String(rebuiltCheckpoint.publicEnvelopeMerkleRoot)), true,
            'rebuilt cache proof must verify under its new root');
        const finalSerializedCount = await verifyStoredLedger(primary, token as string, serializedCaseId);
        assert.equal(finalSerializedCount, serializedEventCount + 1);

        const contendedCaseId = await createCase(primary.baseUrl, token as string);
        const removeBarrier = installTransactionBarrier([primaryClient, secondClient]);
        let contentionResults: HttpResult[];
        try {
            contentionResults = await Promise.all([
                submitEvidence(primary.baseUrl, token as string, contendedCaseId, [
                    { table: 'Employee', recordId: 7, field: 'name', value: 'Concurrent source A' },
                ]),
                submitEvidence(secondary.baseUrl, token as string, contendedCaseId, [
                    { table: 'Employee', recordId: 7, field: 'name', value: 'Concurrent source B' },
                ]),
            ]);
        } finally {
            removeBarrier();
        }
        const successCount = contentionResults.filter(result => result.status === 200).length;
        const conflictCount = contentionResults.filter(result => result.status === 409 && result.code === 'CASE_CONFLICT').length;
        assert.equal(successCount, 1, `exactly one cross-instance writer should commit; statuses=${contentionResults.map(result => `${result.status}:${result.code ?? ''}`).join(',')}`);
        assert.equal(conflictCount, 1, `stale cross-instance writer should receive 409 CASE_CONFLICT; statuses=${contentionResults.map(result => `${result.status}:${result.code ?? ''}`).join(',')}`);
        const contendedEventCount = await verifyStoredLedger(primary, token as string, contendedCaseId);
        assert.equal(contendedEventCount, 1, 'losing transaction must roll back fragments and provenance without sequence gaps');

        const totalSuccessfulFragments = serializedResults.length + 2 + successCount;
        process.stdout.write(`${JSON.stringify({
            note: 'Concurrent HTTP/API benchmark against two in-process Express instances and an isolated temporary SQLite database. Measurements are observational, not a production SLA.',
            isolation: { databaseDirectoryPrefix: path.basename(tempDirectory), sharedDevDatabaseTouched: false },
            sameInstanceCaseLock: {
                workers: workerCount,
                distinctSessionTokens: workerTokens.length,
                sameInvestigatorAccount: true,
                requests: serializedResults.length,
                conflictingAndIndependentEvidenceMixed: true,
                acceptedRequests: serializedResults.filter(result => result.status === 200).length,
                elapsedMs: Number(serializedElapsedMs.toFixed(2)),
                requestsPerSecond: Number((serializedResults.length / (serializedElapsedMs / 1000)).toFixed(2)),
                fragmentsPerSecond: Number((serializedResults.length / (serializedElapsedMs / 1000)).toFixed(2)),
                p50RequestMs: Number(percentile(serializedResults.map(result => result.elapsedMs), 0.5).toFixed(2)),
                p95RequestMs: Number(percentile(serializedResults.map(result => result.elapsedMs), 0.95).toFixed(2)),
                contiguousEventsVerified: serializedEventCount,
            },
            crossInstanceOptimisticConflict: {
                requests: contentionResults.length,
                statuses: contentionResults.map(result => ({ status: result.status, code: result.code ?? null })),
                exactlyOneCommit: successCount === 1,
                losingRequestIs409CaseConflict: conflictCount === 1,
                ledgerEventsAfterRollback: contendedEventCount,
            },
            merkleAccumulatorCache: {
                hotRepeatedProofSamples: hotProofSamples.length,
                hotP50Ms: Number(percentile(hotProofSamples, 0.5).toFixed(2)),
                rebuildAfterConcurrentWritesMs: Number(accumulatorRebuildMs.toFixed(2)),
                rootChangedAfterEvidenceWrite: rebuiltCheckpoint.publicEnvelopeMerkleRoot !== beforeInvalidationCheckpoint.publicEnvelopeMerkleRoot,
                rebuiltProofVerified: true,
                finalSequenceAfterInvalidation: finalSerializedCount,
            },
            successfulEvidenceFragments: totalSuccessfulFragments,
        }, null, 2)}\n`);
    } finally {
        await Promise.all(servers.map(server => closeServer(server).catch(() => undefined)));
        await Promise.all(clients.map(client => client.$disconnect().catch(() => undefined)));
        assertOwnedTempDirectory(tempDirectory);
        await rm(tempDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
}

function cryptoRandomPassword(): string {
    return randomBytes(24).toString('base64url');
}

void main().catch(error => {
    const errorName = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : 'API load benchmark failed.';
    process.stderr.write(`API_LOAD_FAILED:${errorName}:${message}\n`);
    process.exitCode = 1;
});
