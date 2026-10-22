import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import {
    appendPublicProvenanceEnvelope,
    createProvenanceDisclosure,
    decryptCaseSalt,
    deriveEventCommitmentKey,
    encryptCaseSalt,
    PUBLIC_ENVELOPE_GENESIS_HASH,
    verifyProvenanceDisclosure,
} from '../engine/provenance';
import { ProvenanceEntry } from '../engine/types';
import { rotateCaseProvenanceKeys } from './key_rotation';

interface MemoryCase {
    id: string;
    provenanceSaltCiphertext: string | null;
}

function memoryPrisma(initialCases: MemoryCase[]): { prisma: PrismaClient; read: () => MemoryCase[] } {
    let rows = initialCases.map(record => ({ ...record }));
    const prisma = {
        $transaction: async <T>(run: (tx: unknown) => Promise<T>): Promise<T> => {
            const working = rows.map(record => ({ ...record }));
            const tx = {
                reconstructionCase: {
                    findMany: async (args: { where?: { id: { gt: string } }; take: number }) => working
                        .filter(record => !args.where || record.id > args.where.id.gt)
                        .sort((a, b) => a.id.localeCompare(b.id))
                        .slice(0, args.take)
                        .map(({ id, provenanceSaltCiphertext }) => ({ id, provenanceSaltCiphertext })),
                    updateMany: async (args: { where: { id: string; provenanceSaltCiphertext: string }; data: { provenanceSaltCiphertext: string } }) => {
                        const record = working.find(item => item.id === args.where.id && item.provenanceSaltCiphertext === args.where.provenanceSaltCiphertext);
                        if (!record) return { count: 0 };
                        record.provenanceSaltCiphertext = args.data.provenanceSaltCiphertext;
                        return { count: 1 };
                    },
                },
            };
            const result = await run(tx);
            rows = working;
            return result;
        },
    } as unknown as PrismaClient;
    return { prisma, read: () => rows.map(record => ({ ...record })) };
}

const event: ProvenanceEntry = {
    sequence: 3,
    eventType: 'EVIDENCE_ACCEPTED',
    fragmentId: 'fragment-rotated',
    relatedFragmentIds: [],
    actorId: 'investigator-rotated',
    receivedAt: '2026-10-11T12:00:00.000Z',
    payload: '{"field":"name","value":"Ada"}',
    previousHash: 'a'.repeat(64),
    hash: 'b'.repeat(64),
};

test('key rotation preserves case salts, event keys, and selective disclosure verification', async () => {
    const oldMasterKey = Buffer.alloc(32, 11);
    const newMasterKey = Buffer.alloc(32, 12);
    const caseSalt = Buffer.alloc(32, 13);
    const originalCiphertext = encryptCaseSalt(caseSalt, oldMasterKey);
    const pagedCases = Array.from({ length: 251 }, (_, index) => ({
        id: `bulk-${String(index).padStart(3, '0')}`,
        provenanceSaltCiphertext: encryptCaseSalt(Buffer.alloc(32, index % 251), oldMasterKey),
    }));
    const { prisma, read } = memoryPrisma([
        { id: 'case-a', provenanceSaltCiphertext: originalCiphertext },
        { id: 'case-b', provenanceSaltCiphertext: null },
        ...pagedCases,
    ]);

    const rotated = await rotateCaseProvenanceKeys(prisma, oldMasterKey, newMasterKey);
    const stored = read();
    assert.deepEqual(rotated, { casesScanned: 253, casesRotated: 252, casesWithoutSalt: 1 });
    const rotatedCase = stored.find(record => record.id === 'case-a')!;
    assert.notEqual(rotatedCase.provenanceSaltCiphertext, originalCiphertext, 'rotation should use a fresh AES-GCM IV');
    assert.deepEqual(decryptCaseSalt(rotatedCase.provenanceSaltCiphertext!, newMasterKey), caseSalt);
    assert.equal(stored.find(record => record.id === 'case-b')!.provenanceSaltCiphertext, null,
        'uninitialized legacy cases remain eligible for lazy initialization');
    const lastPagedCase = stored.find(record => record.id === 'bulk-250')!;
    assert.equal(decryptCaseSalt(lastPagedCase.provenanceSaltCiphertext!, newMasterKey).length, 32,
        'rotation must continue across the 250-case page boundary');

    const oldEventKey = deriveEventCommitmentKey(decryptCaseSalt(originalCiphertext, oldMasterKey), event.sequence);
    const newEventKey = deriveEventCommitmentKey(decryptCaseSalt(rotatedCase.provenanceSaltCiphertext!, newMasterKey), event.sequence);
    assert.deepEqual(newEventKey, oldEventKey, 'preserving the case salt must preserve every event key');
    const envelope = appendPublicProvenanceEnvelope(event, PUBLIC_ENVELOPE_GENESIS_HASH, oldEventKey);
    const disclosure = createProvenanceDisclosure(event, newEventKey);
    assert.equal(verifyProvenanceDisclosure(disclosure, envelope), true,
        'a disclosure created after rotation must still verify against the existing envelope');
});

test('key rotation rolls back all cases if any stored salt cannot be authenticated', async () => {
    const oldMasterKey = Buffer.alloc(32, 21);
    const newMasterKey = Buffer.alloc(32, 22);
    const validCiphertext = encryptCaseSalt(Buffer.alloc(32, 23), oldMasterKey);
    const invalidCiphertext = encryptCaseSalt(Buffer.alloc(32, 24), Buffer.alloc(32, 25));
    const { prisma, read } = memoryPrisma([
        { id: 'case-a', provenanceSaltCiphertext: validCiphertext },
        { id: 'case-b', provenanceSaltCiphertext: invalidCiphertext },
    ]);

    await assert.rejects(rotateCaseProvenanceKeys(prisma, oldMasterKey, newMasterKey));
    assert.deepEqual(read(), [
        { id: 'case-a', provenanceSaltCiphertext: validCiphertext },
        { id: 'case-b', provenanceSaltCiphertext: invalidCiphertext },
    ], 'the transaction must not commit an earlier case when a later case fails');
});

test('key rotation commits through a real Prisma SQLite transaction isolated from dev.db', async () => {
    const tempRoot = resolve(tmpdir());
    const tempDirectory = mkdtempSync(join(tempRoot, 'lazarus-key-rotation-'));
    const relativeDirectory = relative(tempRoot, resolve(tempDirectory));
    assert.ok(relativeDirectory && !relativeDirectory.startsWith('..') && !isAbsolute(relativeDirectory),
        'temporary database path must remain under the OS temporary directory');

    const databasePath = join(tempDirectory, 'rotation-test.db').replace(/\\/g, '/');
    const prisma = new PrismaClient({ datasourceUrl: `file:${databasePath}` });
    const oldMasterKey = Buffer.alloc(32, 31);
    const newMasterKey = Buffer.alloc(32, 32);
    const firstSalt = Buffer.alloc(32, 33);
    const secondSalt = Buffer.alloc(32, 34);
    const firstCiphertext = encryptCaseSalt(firstSalt, oldMasterKey);
    const secondCiphertext = encryptCaseSalt(secondSalt, oldMasterKey);

    try {
        await prisma.$executeRaw`CREATE TABLE "ReconstructionCase" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "provenanceSaltCiphertext" TEXT,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`;
        await prisma.$executeRaw`INSERT INTO "ReconstructionCase" ("id", "provenanceSaltCiphertext")
            VALUES (${'case-a'}, ${firstCiphertext}), (${'case-b'}, ${secondCiphertext}), (${'case-null'}, ${null})`;

        const rotated = await rotateCaseProvenanceKeys(prisma, oldMasterKey, newMasterKey);
        const rows = await prisma.reconstructionCase.findMany({
            orderBy: { id: 'asc' },
            select: { id: true, provenanceSaltCiphertext: true },
        });
        assert.deepEqual(rotated, { casesScanned: 3, casesRotated: 2, casesWithoutSalt: 1 });
        assert.deepEqual(decryptCaseSalt(rows[0]!.provenanceSaltCiphertext!, newMasterKey), firstSalt);
        assert.deepEqual(decryptCaseSalt(rows[1]!.provenanceSaltCiphertext!, newMasterKey), secondSalt);
        assert.equal(rows[2]!.provenanceSaltCiphertext, null);
    } finally {
        try { await prisma.$disconnect(); }
        finally { rmSync(tempDirectory, { recursive: true, force: true }); }
    }
});
