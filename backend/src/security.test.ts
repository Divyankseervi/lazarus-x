import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { createApp } from './index';
import { provisionAdmin } from './provision_admin';
import { verifyPassword, hashPassword } from './security/password';
import { verifyProvenanceDisclosure, verifyPublicProvenanceEnvelope, PUBLIC_ENVELOPE_GENESIS_HASH, verifyProvenanceCheckpointManifest, verifyEnvelopeInclusionProof } from './engine/provenance';

interface TestUser {
    id: string;
    email: string;
    passwordHash: string;
    role: string;
}

interface TestSession {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
}

interface TestCase {
    id: string;
    currentState: string;
    ownerId: string;
    name: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    provenanceHead: string;
    provenanceSequence: number;
    provenanceSaltCiphertext?: string | null;
}

function createFakePrisma() {
    const state = {
        users: [] as TestUser[],
        sessions: [] as TestSession[],
        cases: [] as TestCase[],
        evidenceFragments: [] as any[],
        provenanceEntries: [] as any[],
        nextUserId: 1,
        nextCaseId: 1,
    };

    const fake: any = {
        $queryRaw: async () => [{ ready: 1 }],
        user: {
            findUnique: async ({ where }: any) => state.users.find(user => user.email === where.email) ?? null,
            create: async ({ data }: any) => {
                const user = { id: `user-${state.nextUserId++}`, ...data } as TestUser;
                state.users.push(user);
                return user;
            },
            update: async ({ where, data }: any) => {
                const user = state.users.find(candidate => candidate.email === where.email);
                if (!user) throw new Error('User not found');
                Object.assign(user, data);
                return user;
            },
        },
        session: {
            findUnique: async ({ where }: any) => {
                const session = state.sessions.find(candidate => candidate.token === where.token);
                const user = session && state.users.find(candidate => candidate.id === session.userId);
                return session && user ? { ...session, user } : null;
            },
            create: async ({ data }: any) => {
                const session = { id: `session-${state.sessions.length + 1}`, ...data } as TestSession;
                state.sessions.push(session);
                return session;
            },
            delete: async ({ where }: any) => {
                const index = state.sessions.findIndex(candidate => candidate.token === where.token);
                if (index < 0) throw new Error('Session not found');
                return state.sessions.splice(index, 1)[0];
            },
            deleteMany: async ({ where }: any) => {
                const before = state.sessions.length;
                state.sessions = state.sessions.filter(candidate => {
                    if (where.token !== undefined && candidate.token !== where.token) return true;
                    if (where.userId !== undefined && candidate.userId !== where.userId) return true;
                    if (where.expiresAt?.lte !== undefined && candidate.expiresAt > where.expiresAt.lte) return true;
                    return false;
                });
                return { count: before - state.sessions.length };
            },
        },
        auditLog: {
            create: async ({ data }: any) => ({ id: `audit-${Date.now()}`, ...data }),
            findMany: async () => [],
            count: async () => 0,
        },
        reconstructionCase: {
            create: async ({ data }: any) => {
                const now = new Date();
                const dbCase = {
                    id: `case-${state.nextCaseId++}`,
                    name: 'Untitled Case',
                    status: 'ACTIVE',
                    createdAt: now,
                    updatedAt: now,
                    ...data,
                } as TestCase;
                state.cases.push(dbCase);
                return dbCase;
            },
            findMany: async ({ where, take }: any) => state.cases
                .filter(dbCase => !where?.ownerId || dbCase.ownerId === where.ownerId)
                .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
                .slice(0, take),
            count: async ({ where }: any) => state.cases
                .filter(dbCase => !where?.ownerId || dbCase.ownerId === where.ownerId).length,
            findUnique: async ({ where }: any) => state.cases.find(dbCase => dbCase.id === where.id) ?? null,
            update: async ({ where, data }: any) => {
                const dbCase = state.cases.find(candidate => candidate.id === where.id);
                if (!dbCase) throw new Error('Case not found');
                Object.assign(dbCase, data);
                dbCase.updatedAt = new Date();
                return dbCase;
            },
            delete: async ({ where }: any) => {
                const index = state.cases.findIndex(candidate => candidate.id === where.id);
                if (index < 0) throw new Error('Case not found');
                return state.cases.splice(index, 1)[0];
            },
        },
        evidenceFragment: {
            create: async ({ data }: any) => {
                const evidence = { id: `evidence-${Date.now()}`, ...data };
                state.evidenceFragments.push(evidence);
                return evidence;
            },
            findUnique: async ({ where }: any) => state.evidenceFragments.find(entry => entry.id === where.id) ?? null,
            findMany: async ({ where }: any) => state.evidenceFragments
                .filter(entry => entry.caseId === where.caseId)
                .filter(entry => where.id?.in === undefined || where.id.in.includes(entry.id)),
            count: async ({ where }: any) => state.evidenceFragments.filter(entry => entry.caseId === where.caseId).length,
        },
        evidenceProvenanceEntry: {
            create: async ({ data }: any) => {
                const entry = { id: `provenance-${state.provenanceEntries.length + 1}`, ...data };
                state.provenanceEntries.push(entry);
                return entry;
            },
            findMany: async ({ where, orderBy }: any) => state.provenanceEntries
                .filter(entry => entry.caseId === where.caseId)
                .filter(entry => where.sequence?.gt === undefined || entry.sequence > where.sequence.gt)
            .filter(entry => where.sequence?.equals === undefined || entry.sequence === where.sequence.equals)
                .sort((a, b) => orderBy.sequence === 'asc' ? a.sequence - b.sequence : b.sequence - a.sequence),
        },
    };
    fake.$transaction = async (operation: (tx: any) => Promise<unknown>) => operation(fake);

    return { client: fake as unknown as PrismaClient, state };
}

test('production metrics endpoint is hidden unless an operator token is configured', async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousMetricsToken = process.env.METRICS_TOKEN;
    process.env.NODE_ENV = 'production';
    delete process.env.METRICS_TOKEN;
    try {
        await withServer(createFakePrisma().client, async api => {
            const hidden = await fetch(`${api}/metrics`);
            assert.equal(hidden.status, 404);
            const token = 'operator-metrics-token-'.padEnd(40, 'x');
            process.env.METRICS_TOKEN = token;
            const denied = await fetch(`${api}/metrics`);
            assert.equal(denied.status, 404);
            const allowed = await fetch(`${api}/metrics`, { headers: { Authorization: `Bearer ${token}` } });
            assert.equal(allowed.status, 200);
            assert.match(await allowed.text(), /lazarus_uptime_seconds/);
        });
    } finally {
        if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
        if (previousMetricsToken === undefined) delete process.env.METRICS_TOKEN; else process.env.METRICS_TOKEN = previousMetricsToken;
    }
});

test('readiness endpoint checks database connectivity separately from liveness', async () => {
    const healthy = createFakePrisma();
    await withServer(healthy.client, async api => {
        const live = await fetch(`${api}/api/health`);
        assert.equal(live.status, 200);
        assert.equal((await live.json() as { status: string }).status, 'UP');
        const ready = await fetch(`${api}/api/health/ready`);
        assert.equal(ready.status, 200);
        assert.equal((await ready.json() as { status: string; database: string }).status, 'READY');
    });

    const unavailable = createFakePrisma();
    (unavailable.client as any).$queryRaw = async () => { throw new Error('database unavailable'); };
    await withServer(unavailable.client, async api => {
        const ready = await fetch(`${api}/api/health/ready`);
        assert.equal(ready.status, 503);
        assert.equal((await ready.json() as { status: string }).status, 'NOT_READY');
    });
});

test('legacy fixed-salt scrypt password hashes remain verifiable', async () => {
    const legacyPassword = 'LegacyPassword123!';
    const legacyHash = crypto.scryptSync(legacyPassword, 'lazarus_salt_v1', 64).toString('hex');
    assert.equal(await verifyPassword(legacyPassword, legacyHash), true);
    assert.equal(await verifyPassword('incorrect password', legacyHash), false);
});

async function withServer(prisma: PrismaClient, callback: (api: string) => Promise<void>, options?: { trustProxy?: boolean | number | string }): Promise<void> {
    const server = createApp(prisma, Buffer.alloc(32, 0x42), options).listen(0);
    await new Promise<void>((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
    });

    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const api = `http://127.0.0.1:${address.port}`;
    try {
        await callback(api);
    } finally {
        await new Promise<void>((resolve, reject) => {
            server.close(error => error ? reject(error) : resolve());
        });
    }
}

test('public registration cannot grant ADMIN and cannot delete a case', async () => {
    const fake = createFakePrisma();

    await withServer(fake.client, async api => {
        const register = await fetch(`${api}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'attacker@example.test', password: 'Password123!', role: 'ADMIN' }),
        });
        assert.equal(register.status, 201);
        assert.equal(fake.state.users[0].role, 'INVESTIGATOR');
        assert.match(fake.state.users[0].passwordHash, /^\$2[aby]\$/);

        const login = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'attacker@example.test', password: 'Password123!' }),
        });
        assert.equal(login.status, 200);
        const { token } = await login.json() as { token: string };
        assert.notEqual(fake.state.sessions[0]?.token, token, 'database stores only a digest of the bearer token');
        assert.match(fake.state.sessions[0]?.token ?? '', /^[a-f0-9]{64}$/);

        const createCase = await fetch(`${api}/api/cases`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(createCase.status, 200);
        const createdCase = await createCase.json() as { id: string; provenanceSaltCiphertext?: string; provenanceHead?: string };
        const { id } = createdCase;
        assert.equal('provenanceSaltCiphertext' in createdCase, false, 'encrypted case salts must never be returned by the case API');
        assert.equal('provenanceHead' in createdCase, false, 'raw internal ledger heads must not be returned by the case API');

        const list = await fetch(`${api}/api/cases`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(list.status, 200);
        assert.equal((await list.json() as { cases: Array<{ id: string }> }).cases[0]?.id, id);

        const unauthenticatedDelete = await fetch(`${api}/api/cases/${id}`, { method: 'DELETE' });
        assert.equal(unauthenticatedDelete.status, 401);

        const investigatorDelete = await fetch(`${api}/api/cases/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(investigatorDelete.status, 403);
        assert.equal(fake.state.cases.length, 1, 'unauthorized deletion must preserve the case');

        const logout = await fetch(`${api}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        assert.equal(logout.status, 200);
        const revokedSession = await fetch(`${api}/api/cases`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(revokedSession.status, 401, 'logout must revoke the hashed session token');
    });
});

test('operator provisioning creates an ADMIN that can use admin-only deletion', async () => {
    const fake = createFakePrisma();
    await provisionAdmin(fake.client, 'operator@example.test', 'LongOperatorPassword123!');
    assert.equal(fake.state.users[0].role, 'ADMIN');

    await withServer(fake.client, async api => {
        const login = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'operator@example.test', password: 'LongOperatorPassword123!' }),
        });
        assert.equal(login.status, 200);
        const { token } = await login.json() as { token: string };

        const createCase = await fetch(`${api}/api/cases`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(createCase.status, 200);
        const { id } = await createCase.json() as { id: string };

        const deleteCase = await fetch(`${api}/api/cases/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(deleteCase.status, 200);
        assert.equal(fake.state.cases.length, 0);
    });
});

test('expired sessions are evicted when authentication rejects them', async () => {
    const fake = createFakePrisma();
    const token = 'a'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    fake.state.users.push({
        id: 'user-expired', email: 'expired@example.test', passwordHash: 'unused', role: 'INVESTIGATOR',
    });
    fake.state.sessions.push({
        id: 'session-expired', token: tokenHash, userId: 'user-expired', expiresAt: new Date(Date.now() - 1000),
    });

    await withServer(fake.client, async api => {
        const response = await fetch(`${api}/api/cases`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 401);
        assert.equal(fake.state.sessions.some(session => session.token === tokenHash), false,
            'expired token digests should be removed after the authentication attempt');
        const retry = await fetch(`${api}/api/cases`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(retry.status, 401, 'removal must make subsequent token lookups fail closed');
    });
});

test('operator credential rotation immediately revokes all existing sessions', async () => {
    const fake = createFakePrisma();
    fake.state.users.push({
        id: 'user-rotate', email: 'rotate@example.test', passwordHash: await hashPassword('PreviousPassword123!'), role: 'INVESTIGATOR',
    });
    const token = 'c'.repeat(64);
    const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    fake.state.sessions.push({
        id: 'session-rotate', token: tokenHash, userId: 'user-rotate', expiresAt: new Date(Date.now() + 86_400_000),
    });

    await provisionAdmin(fake.client, 'rotate@example.test', 'ReplacementPassword123!');
    assert.equal(fake.state.sessions.length, 0, 'credential updates must revoke every prior session in the same transaction');
    assert.equal(fake.state.users[0]?.role, 'ADMIN');

    await withServer(fake.client, async api => {
        const revoked = await fetch(`${api}/api/cases`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(revoked.status, 401, 'the old bearer token must fail immediately after credential rotation');
        const login = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'rotate@example.test', password: 'ReplacementPassword123!' }),
        });
        assert.equal(login.status, 200, 'the replacement credential should remain usable');
    });
});

test('over-limit reconstruction evidence returns 422 without persisting a partial update', async () => {
    const fake = createFakePrisma();

    await withServer(fake.client, async api => {
        const register = await fetch(`${api}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'limit@example.test', password: 'Password123!' }),
        });
        assert.equal(register.status, 201);

        const login = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'limit@example.test', password: 'Password123!' }),
        });
        assert.equal(login.status, 200);
        const { token } = await login.json() as { token: string };

        const createCase = await fetch(`${api}/api/cases`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(createCase.status, 200);
        const { id } = await createCase.json() as { id: string };
        const priorState = fake.state.cases[0].currentState;

        const evidence: Array<{ id: string; table: string; recordId: number; field: string; value: string }> = [];
        for (let index = 0; index < 14; index++) {
            evidence.push(
                { id: `a-${index}`, table: 'Department', recordId: 1, field: `conflict_${index}`, value: `a-${index}` },
                { id: `b-${index}`, table: 'Department', recordId: 1, field: `conflict_${index}`, value: `b-${index}` },
            );
        }
        const response = await fetch(`${api}/api/cases/${id}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence }),
        });
        assert.equal(response.status, 422);
        assert.equal((await response.json() as { code: string }).code, 'SEARCH_SPACE_LIMIT');
        assert.equal(fake.state.evidenceFragments.length, 0, 'rejected evidence must not be persisted');
        assert.equal(fake.state.cases[0].currentState, priorState, 'rejected evidence must preserve the prior reconstruction');
    });
});

test('accepted evidence and its provenance chain commit together and verify through the API', async () => {
    const fake = createFakePrisma();
    await withServer(fake.client, async api => {
        await fetch(`${api}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'provenance@example.test', password: 'Password123!' }),
        });
        const login = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'provenance@example.test', password: 'Password123!' }),
        });
        const { token } = await login.json() as { token: string };
        const createCase = await fetch(`${api}/api/cases`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        const { id } = await createCase.json() as { id: string };

        const response = await fetch(`${api}/api/cases/${id}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence: [{ table: 'Department', recordId: 1, field: 'name', value: 'Ada' }] }),
        });
        assert.equal(response.status, 200);
        const accepted = await response.json() as { provenance: { sequence: number; appendedEvents: number } };
        assert.equal(accepted.provenance.sequence, 1);
        assert.equal(accepted.provenance.appendedEvents, 1);
        assert.equal('headHash' in accepted.provenance, false, 'raw unsalted ledger heads must not be returned by the API');
        assert.equal(fake.state.evidenceFragments.length, 1);
        assert.equal(fake.state.provenanceEntries.length, 1);
        assert.equal(fake.state.provenanceEntries[0].fragmentId, fake.state.evidenceFragments[0].id);
        assert.equal(typeof fake.state.cases[0].provenanceSaltCiphertext, 'string', 'the case salt should be stored as encrypted ciphertext');

        const verification = await fetch(`${api}/api/cases/${id}/provenance`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(verification.status, 200);
        const result = await verification.json() as {
            valid: boolean;
            checkedEntries: number;
            entries: Array<Record<string, unknown> & { sequence: number; previousEnvelopeHash: string; envelopeHash: string }>;
            publicEnvelope: { headHash: string; zeroKnowledgeProof: boolean };
        };
        assert.equal(result.valid, true);
        assert.equal('headHash' in result, false, 'the internal raw ledger head must remain private');
        assert.equal(result.checkedEntries, 1);
        assert.equal('payload' in result.entries[0]!, false, 'default response must not disclose the evidence payload');
        assert.equal('ledgerHash' in result.entries[0]!, false, 'default response must not expose unsalted ledger digests');
        assert.equal(JSON.stringify(result.entries).includes('Ada'), false, 'low-entropy evidence text must not appear in public commitments');
        assert.equal(result.publicEnvelope.zeroKnowledgeProof, false, 'commitment envelope must not claim to be a ZK proof');
        assert.equal(verifyPublicProvenanceEnvelope(result.entries as any, result.publicEnvelope.headHash, 0, PUBLIC_ENVELOPE_GENESIS_HASH).valid, true,
            'public commitment page should verify in an independent verifier');

        const disclosureResponse = await fetch(`${api}/api/cases/${id}/provenance/claims/1`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(disclosureResponse.status, 200);
        const selective = await disclosureResponse.json() as { disclosure: any; envelope: any };
        assert.equal(selective.disclosure.payload.includes('Ada'), true, 'selective disclosure should include only the requested event payload');
        assert.equal(verifyProvenanceDisclosure(selective.disclosure, selective.envelope), true,
            'event-scoped disclosure should independently verify against its public commitment');

        fake.state.evidenceFragments[0].value = 'tampered';
        const tamperedVerification = await fetch(`${api}/api/cases/${id}/provenance`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal((await tamperedVerification.json() as { valid: boolean }).valid, false,
            'verification must bind ledger evidence to the persisted fragment row');

        const tamperedClaim = await fetch(`${api}/api/cases/${id}/provenance/claims/1`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(tamperedClaim.status, 409, 'selective disclosure must reject when the underlying evidence fragment was tampered with');

        // Restore fragment and simulate extra phantom entries beyond stored case sequence
        fake.state.evidenceFragments[0].value = 'Ada';
        fake.state.provenanceEntries.push({
            id: 'provenance-phantom',
            caseId: id,
            sequence: 2,
            eventType: 'EVIDENCE_ACCEPTED',
            fragmentId: 'phantom-frag',
            relatedFragmentIds: '[]',
            actorId: 'attacker',
            receivedAt: new Date(),
            payload: '{"field":"name","value":"Phantom"}',
            previousHash: fake.state.provenanceEntries[0].hash,
            hash: '0'.repeat(64),
        });
        const desyncClaim = await fetch(`${api}/api/cases/${id}/provenance/claims/1`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(desyncClaim.status, 409, 'selective disclosure must reject when ledger contains entries beyond recorded sequence');
    });
});



test('durable engine rehydration correctly restores case state across app restarts', async () => {
    const { client: prisma, state } = createFakePrisma();
    const investigator = await prisma.user.create({ data: { email: 'inv2@test.com', passwordHash: 'hash', role: 'INVESTIGATOR' } });
    const sessionToken = 'a'.repeat(64);
    await prisma.session.create({ data: { token: crypto.createHash('sha256').update(sessionToken).digest('hex'), userId: investigator.id, expiresAt: new Date(Date.now() + 86400000) } });

    let caseId = '';
    let publicEnvelopeHead = '';

    await withServer(prisma, async (api) => {
        const createRes = await fetch(api + '/api/cases', { method: 'POST', headers: { authorization: `Bearer ${sessionToken}` } });
        const createData = await createRes.json();
        caseId = createData.id;

        const evidenceRes = await fetch(api + '/api/cases/' + caseId + '/evidence', {
            method: 'POST',
            headers: { authorization: `Bearer ${sessionToken}`, 'content-type': 'application/json' },
            body: JSON.stringify({ evidence: [
                { table: 'Department', recordId: 1, field: 'name', value: 'Forensics' },
                { table: 'Department', recordId: 1, field: 'id', value: 99 },
            ] })
        });
        assert.equal(evidenceRes.status, 200);
        const auditRes = await fetch(`${api}/api/cases/${caseId}/provenance`, {
            headers: { authorization: `Bearer ${sessionToken}` },
        });
        const audit = await auditRes.json() as { valid: boolean; publicEnvelope: { headHash: string } };
        assert.equal(audit.valid, true);
        publicEnvelopeHead = audit.publicEnvelope.headHash;
    });

    await withServer(prisma, async (api) => {
        const restoredRes = await fetch(api + '/api/cases/' + caseId, {
            headers: { authorization: `Bearer ${sessionToken}` },
        });
        assert.equal(restoredRes.status, 200);
        const restored = await restoredRes.json();
        assert.equal(restored.bestState.data.Department[0].name, 'Forensics', 'case listing must replay all fragments from the committed batch');
        assert.equal(restored.bestState.data.Department[0].id, 99, 'batch metadata must preserve multi-fragment transactions on replay');
        const restoredAuditRes = await fetch(`${api}/api/cases/${caseId}/provenance`, {
            headers: { authorization: `Bearer ${sessionToken}` },
        });
        const restoredAudit = await restoredAuditRes.json() as { valid: boolean; publicEnvelope: { headHash: string } };
        assert.equal(restoredAudit.valid, true, 'the encrypted case salt should decrypt after a server/app restart');
        assert.equal(restoredAudit.publicEnvelope.headHash, publicEnvelopeHead,
            'event-scoped public commitments should remain deterministic across restarts');

        const evRes = await fetch(api + '/api/cases/' + caseId + '/evidence', {
            method: 'POST',
            headers: { authorization: `Bearer ${sessionToken}`, 'content-type': 'application/json' },
            body: JSON.stringify({ evidence: [{ table: 'Department', recordId: 1, field: 'id', value: 99 }] })
        });
        const evData = await evRes.json();
        assert(evData.bestState, 'rehydrated engine should return bestState');
        assert(evData.bestState.data.Department.length === 1, 'rehydrated engine should contain the combined state from both app sessions');
    });
});

test('CORS permits configured origins and rejects unknown browser origins', async () => {
    const previous = process.env.CORS_ORIGINS;
    process.env.CORS_ORIGINS = 'https://investigator.example.test';
    try {
        await withServer(createFakePrisma().client, async api => {
            const allowed = await fetch(`${api}/api/auth/login`, {
                method: 'OPTIONS',
                headers: {
                    Origin: 'https://investigator.example.test',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'content-type',
                },
            });
            assert.equal(allowed.status, 204);
            assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://investigator.example.test');

            const denied = await fetch(`${api}/api/auth/login`, {
                method: 'OPTIONS',
                headers: {
                    Origin: 'https://attacker.example.test',
                    'Access-Control-Request-Method': 'POST',
                    'Access-Control-Request-Headers': 'content-type',
                },
            });
            assert.equal(denied.status, 403);
            assert.equal((await denied.json() as { error: string }).error, 'Origin is not allowed.');
        });
    } finally {
        if (previous === undefined) delete process.env.CORS_ORIGINS;
        else process.env.CORS_ORIGINS = previous;
    }
});

test('authentication routes throttle repeated attempts and hide internal error details', async () => {
    const fake = createFakePrisma();
    await withServer(fake.client, async api => {
        const responses = await Promise.all(Array.from({ length: 11 }, () => fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'missing@example.test', password: 'invalid' }),
        })));
        assert.equal(responses.slice(0, 10).every(response => response.status === 401), true);
        assert.equal(responses[10]?.status, 429, 'the request after the configured auth budget must be rejected');
        assert.ok(responses[10]?.headers.has('retry-after'));
    });

    const broken = createFakePrisma();
    (broken.client.user as any).findUnique = async () => { throw new Error('database secret detail'); };
    await withServer(broken.client, async api => {
        const response = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'user@example.test', password: 'Password123!' }),
        });
        assert.equal(response.status, 500);
        const text = await response.text();
        assert.equal(text.includes('database secret detail'), false, 'API errors must not return database messages');
    });
});

test('same-case evidence writes serialize and preserve every committed ledger sequence', async () => {
    const fake = createFakePrisma();
    await withServer(fake.client, async api => {
        await fetch(`${api}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'concurrent@example.test', password: 'Password123!' }),
        });
        const login = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'concurrent@example.test', password: 'Password123!' }),
        });
        const { token } = await login.json() as { token: string };
        const createCase = await fetch(`${api}/api/cases`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
        const { id } = await createCase.json() as { id: string };
        const submit = (value: string) => fetch(`${api}/api/cases/${id}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence: [{ table: 'Department', recordId: 1, field: 'name', value }] }),
        });
        const responses = await Promise.all([submit('North'), submit('South')]);
        assert.equal(responses.every(response => response.status === 200), true, 'serialized writes should both succeed');
        assert.equal(fake.state.cases[0]?.provenanceSequence, 2);
        assert.deepEqual(fake.state.provenanceEntries.map(entry => entry.sequence), [1, 2]);
        assert.equal(fake.state.evidenceFragments.length, 2);
        const resultBodies = await Promise.all(responses.map(response => response.json())) as Array<{ candidates: Array<{ id: string; rank: number }> }>;
        const alternative = resultBodies.flatMap(body => body.candidates).find(candidate => candidate.rank > 1);
        assert.ok(alternative, 'contradictory values should materialize an inspectable alternative candidate');
        const candidateResponse = await fetch(`${api}/api/cases/${id}/candidates/${encodeURIComponent(alternative!.id)}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(candidateResponse.status, 200);
        const candidateBody = await candidateResponse.json() as { candidate: { data: { Department: Array<{ name: string }> } } };
        assert.ok(['North', 'South'].includes(candidateBody.candidate.data.Department[0]?.name ?? ''));
    });
});

test('externally anchorable provenance checkpoint endpoint returns verifiable manifest and enforces authorization', async () => {
    const fake = createFakePrisma();
    await withServer(fake.client, async api => {
        // Register owner
        await fetch(`${api}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'owner@example.test', password: 'Password123!' }),
        });
        const ownerLogin = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'owner@example.test', password: 'Password123!' }),
        });
        const { token: ownerToken } = await ownerLogin.json() as { token: string };

        // Register bystander
        await fetch(`${api}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'bystander@example.test', password: 'Password123!' }),
        });
        const bystanderLogin = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'bystander@example.test', password: 'Password123!' }),
        });
        const { token: bystanderToken } = await bystanderLogin.json() as { token: string };

        // Create case
        const createCase = await fetch(`${api}/api/cases`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ownerToken}` },
        });
        const { id: caseId } = await createCase.json() as { id: string };

        // Submit evidence to advance provenance
        const evidenceRes = await fetch(`${api}/api/cases/${caseId}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence: [{ table: 'Department', recordId: 1, field: 'name', value: 'Engineering' }] }),
        });
        assert.equal(evidenceRes.status, 200);

        // Fetch checkpoint as owner
        const checkpointRes = await fetch(`${api}/api/cases/${caseId}/provenance/checkpoint`, {
            headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(checkpointRes.status, 200);
        const checkpoint = await checkpointRes.json() as any;
        assert.equal(checkpoint.version, 1);
        assert.equal(checkpoint.caseId, caseId);
        assert.equal(checkpoint.sequence, 1);
        assert.match(checkpoint.publicEnvelopeMerkleRoot, /^[a-f0-9]{64}$/);
        assert.equal(verifyProvenanceCheckpointManifest(checkpoint), true, 'Manifest must verify cryptographically');

        // Bystander cannot access checkpoint (403 Forbidden)
        const forbiddenRes = await fetch(`${api}/api/cases/${caseId}/provenance/checkpoint`, {
            headers: { Authorization: `Bearer ${bystanderToken}` },
        });
        assert.equal(forbiddenRes.status, 403);
    });
});

test('Merkle proof and offline audit bundle endpoints verify and enforce case ownership', async () => {
    const fake = createFakePrisma();
    await withServer(fake.client, async api => {
        const register = async (email: string) => {
            await fetch(`${api}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: 'Password123!' }),
            });
            const response = await fetch(`${api}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password: 'Password123!' }),
            });
            return (await response.json() as { token: string }).token;
        };
        const ownerToken = await register('merkle-owner@example.test');
        const outsiderToken = await register('merkle-outsider@example.test');
        const caseResponse = await fetch(`${api}/api/cases`, {
            method: 'POST', headers: { Authorization: `Bearer ${ownerToken}` },
        });
        const { id } = await caseResponse.json() as { id: string };
        const invalidConfidence = await fetch(`${api}/api/cases/${id}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence: [{ table: 'Department', recordId: 1, field: 'name', value: 'Invalid', confidence: 1.1 }] }),
        });
        assert.equal(invalidConfidence.status, 400);
        assert.equal(fake.state.evidenceFragments.length, 0, 'invalid confidence must not persist evidence');
        const evidenceResponse = await fetch(`${api}/api/cases/${id}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence: [
                { table: 'Department', recordId: 1, field: 'name', value: 'Engineering', confidence: 0.8 },
                { table: 'Employee', recordId: 7, field: 'name', value: 'Ada Lovelace' },
            ] }),
        });
        assert.equal(evidenceResponse.status, 200);
        assert.equal(JSON.parse(fake.state.provenanceEntries[0]!.payload).confidence, 0.8,
            'source confidence must be retained in the replayable provenance payload');

        const proofResponse = await fetch(`${api}/api/cases/${id}/provenance/proofs/2`, {
            headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(proofResponse.status, 200);
        const proofResult = await proofResponse.json() as any;
        assert.equal(proofResult.proof.sequence, 2);
        assert.equal(proofResult.proof.totalEvents, 2);
        assert.equal(verifyProvenanceCheckpointManifest(proofResult.checkpoint), true);
        assert.equal(verifyEnvelopeInclusionProof(
            proofResult.proof,
            proofResult.envelope.envelopeHash,
            proofResult.checkpoint.publicEnvelopeMerkleRoot,
        ), true);

        // Subsequent query for sequence 1 tests O(log N) accumulator cache reuse
        const proof1Response = await fetch(`${api}/api/cases/${id}/provenance/proofs/1`, {
            headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(proof1Response.status, 200);
        const proof1Result = await proof1Response.json() as any;
        assert.equal(proof1Result.proof.sequence, 1);
        assert.equal(proof1Result.proof.totalEvents, 2);
        assert.equal(verifyEnvelopeInclusionProof(
            proof1Result.proof,
            proof1Result.envelope.envelopeHash,
            proof1Result.checkpoint.publicEnvelopeMerkleRoot,
        ), true);

        // Verify cache invalidation when new evidence arrives
        await fetch(`${api}/api/cases/${id}/evidence`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ evidence: [{ table: 'Employee', recordId: 8, field: 'name', value: 'Charles Babbage' }] }),
        });
        const proof3Response = await fetch(`${api}/api/cases/${id}/provenance/proofs/3`, {
            headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(proof3Response.status, 200);
        const proof3Result = await proof3Response.json() as any;
        assert.equal(proof3Result.proof.sequence, 3);
        assert.equal(proof3Result.proof.totalEvents, 3);
        assert.notEqual(proof3Result.checkpoint.publicEnvelopeMerkleRoot, proofResult.checkpoint.publicEnvelopeMerkleRoot,
            'advancing sequence must update Merkle root and invalidate stale cache');
        assert.equal(verifyEnvelopeInclusionProof(
            proof3Result.proof,
            proof3Result.envelope.envelopeHash,
            proof3Result.checkpoint.publicEnvelopeMerkleRoot,
        ), true);

        const invalidSequence = await fetch(`${api}/api/cases/${id}/provenance/proofs/0`, {
            headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(invalidSequence.status, 400);
        const forbiddenProof = await fetch(`${api}/api/cases/${id}/provenance/proofs/1`, {
            headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        assert.equal(forbiddenProof.status, 403);

        const bundleResponse = await fetch(`${api}/api/cases/${id}/export/audit-bundle`, {
            headers: { Authorization: `Bearer ${ownerToken}` },
        });
        assert.equal(bundleResponse.status, 200);
        assert.match(bundleResponse.headers.get('content-type') ?? '', /application\/(vnd\.lazarus-x\.audit-bundle\.v1\+)?json/);
        const bundle = await bundleResponse.json() as any;
        assert.equal(bundle.format, 'LAZARUS-X-OFFLINE-AUDIT-BUNDLE');
        assert.equal(bundle.caseId, id);
        assert.equal(bundle.publicEnvelopes.length, 3);
        assert.equal(bundle.checkpoint.publicEnvelopeMerkleRoot, proof3Result.checkpoint.publicEnvelopeMerkleRoot);
        assert.equal(bundle.candidateSnapshot.candidates.length > 0, true);
        assert.match(bundle.verificationScript, /node:crypto/);
        assert.equal(typeof bundle.bundleDigest, 'string');
        const forbiddenBundle = await fetch(`${api}/api/cases/${id}/export/audit-bundle`, {
            headers: { Authorization: `Bearer ${outsiderToken}` },
        });
        assert.equal(forbiddenBundle.status, 403);
    });
});

test('configurable trust proxy partitions rate limits by forwarded client IP', async () => {
    const fake = createFakePrisma();
    await withServer(fake.client, async api => {
        // Under trustProxy: 1, requests with different X-Forwarded-For should have independent auth rate limit budgets
        const client1Attempts = await Promise.all(Array.from({ length: 10 }, () => fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.1' },
            body: JSON.stringify({ email: 'client1@example.test', password: 'wrong' }),
        })));
        assert.equal(client1Attempts.every(r => r.status === 401), true);

        // 11th attempt from client 1 should be throttled (429)
        const client1Throttled = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.1' },
            body: JSON.stringify({ email: 'client1@example.test', password: 'wrong' }),
        });
        assert.equal(client1Throttled.status, 429);

        // Client 2 with distinct X-Forwarded-For should not be throttled yet
        const client2Attempt = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '198.51.100.2' },
            body: JSON.stringify({ email: 'client2@example.test', password: 'wrong' }),
        });
        assert.equal(client2Attempt.status, 401, 'Client 2 should have its own separate rate limit window');
    }, { trustProxy: 1 });
});

test('case sealing cryptographically freezes case and rejects further evidence writes', async () => {
    const fake = createFakePrisma();
    await withServer(fake.client, async api => {
        await fetch(`${api}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'examiner@example.test', password: 'Password123!' }),
        });
        const loginRes = await fetch(`${api}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'examiner@example.test', password: 'Password123!' }),
        });
        assert.equal(loginRes.status, 200);
        const { token } = await loginRes.json() as { token: string };

        const caseRes = await fetch(`${api}/api/cases`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(caseRes.status, 200);
        const { id } = await caseRes.json() as { id: string };

        // Submit evidence
        const evRes = await fetch(`${api}/api/cases/${id}/evidence`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                evidence: [{ table: 'Department', recordId: 1, field: 'name', value: 'Engineering' }],
            }),
        });
        assert.equal(evRes.status, 200);

        // Seal the case
        const sealRes = await fetch(`${api}/api/cases/${id}/seal`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(sealRes.status, 200);
        const sealData = await sealRes.json() as { success: boolean; status: string; checkpoint: { publicEnvelopeMerkleRoot: string; sequence: number } };
        assert.equal(sealData.success, true);
        assert.equal(sealData.status, 'SEALED');
        assert.equal(sealData.checkpoint.sequence, 1);
        assert.equal(typeof sealData.checkpoint.publicEnvelopeMerkleRoot, 'string');

        // Verify case status in GET /api/cases/:id
        const getRes = await fetch(`${api}/api/cases/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(getRes.status, 200);
        const getData = await getRes.json() as { status: string };
        assert.equal(getData.status, 'SEALED');

        // Submitting evidence to sealed case must fail with 409 CASE_SEALED
        const postSealedEv = await fetch(`${api}/api/cases/${id}/evidence`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                evidence: [{ table: 'Department', recordId: 2, field: 'name', value: 'HR' }],
            }),
        });
        assert.equal(postSealedEv.status, 409);
        const errJson = await postSealedEv.json() as { code: string };
        assert.equal(errJson.code, 'CASE_SEALED');

        // Re-sealing must fail with 409 CASE_ALREADY_SEALED
        const reSealRes = await fetch(`${api}/api/cases/${id}/seal`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(reSealRes.status, 409);
    });
});
