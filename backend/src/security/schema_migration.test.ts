import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';

test('provenance SQL migration applies to an isolated pre-change SQLite schema', async () => {
    const tempRoot = resolve(tmpdir());
    const tempDirectory = mkdtempSync(join(tempRoot, 'lazarus-schema-migration-'));
    const relativeDirectory = relative(tempRoot, resolve(tempDirectory));
    assert.ok(relativeDirectory && !relativeDirectory.startsWith('..') && !isAbsolute(relativeDirectory),
        'temporary database path must remain under the OS temporary directory');

    const databasePath = join(tempDirectory, 'migration-test.db').replace(/\\/g, '/');
    const prisma = new PrismaClient({ datasourceUrl: `file:${databasePath}` });
    try {
        await prisma.$executeRaw`CREATE TABLE "ReconstructionCase" ("id" TEXT NOT NULL PRIMARY KEY)`;
        await prisma.$executeRaw`CREATE TABLE "EvidenceProvenanceEntry" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "caseId" TEXT NOT NULL,
            "receivedAt" DATETIME NOT NULL
        )`;
        await prisma.$executeRaw`INSERT INTO "ReconstructionCase"("id") VALUES ('legacy-case')`;

        const migrationPath = resolve(process.cwd(), 'prisma/migrations/20261011000000_provenance_salt_and_indexes/migration.sql');
        const migrationSql = readFileSync(migrationPath, 'utf8');
        const statements = migrationSql.replace(/--[^\r\n]*/g, '').split(';').map(statement => statement.trim()).filter(Boolean);
        assert.equal(statements.length, 2, 'expected the additive column and index statements');
        for (const statement of statements) await prisma.$executeRawUnsafe(statement);

        const columns1 = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("ReconstructionCase")');
        const indexes = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA index_list("EvidenceProvenanceEntry")');
        assert.ok(columns1.some(column => column.name === 'provenanceSaltCiphertext'), 'migration should add encrypted salt storage');
        assert.ok(indexes.some(index => index.name === 'EvidenceProvenanceEntry_caseId_receivedAt_idx'),
            'migration should add the case/timestamp lookup index');

        // Apply second migration: 20261011120000_provenance_merkle_accumulator
        const merkleMigrationPath = resolve(process.cwd(), 'prisma/migrations/20261011120000_provenance_merkle_accumulator/migration.sql');
        const merkleMigrationSql = readFileSync(merkleMigrationPath, 'utf8');
        const merkleStatements = merkleMigrationSql.replace(/--[^\r\n]*/g, '').split(';').map(statement => statement.trim()).filter(Boolean);
        assert.equal(merkleStatements.length, 2, 'expected two additive column statements for Merkle accumulator');
        for (const statement of merkleStatements) await prisma.$executeRawUnsafe(statement);

        const columns2 = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("ReconstructionCase")');
        assert.ok(columns2.some(column => column.name === 'provenanceMerkleRoot'), 'merkle migration should add provenanceMerkleRoot');
        assert.ok(columns2.some(column => column.name === 'provenanceEnvelopeHead'), 'merkle migration should add provenanceEnvelopeHead');

        // Apply the case-specific target schema migration. Older cases must remain
        // readable and fall back to legacy compatibility schema when the JSON is {}.
        const schemaMigrationPath = resolve(process.cwd(), 'prisma/migrations/20261023150000_case_schema_definition/migration.sql');
        const schemaMigrationSql = readFileSync(schemaMigrationPath, 'utf8');
        const schemaStatements = schemaMigrationSql.replace(/--[^\r\n]*/g, '').split(';').map(statement => statement.trim()).filter(Boolean);
        assert.equal(schemaStatements.length, 1, 'expected one additive case schema column');
        for (const statement of schemaStatements) await prisma.$executeRawUnsafe(statement);
        const columns3 = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("ReconstructionCase")');
        assert.ok(columns3.some(column => column.name === 'schemaDefinition'), 'schema migration should add schemaDefinition');
        const legacySchema = await prisma.$queryRawUnsafe<Array<{ schemaDefinition: string }>>(`SELECT "schemaDefinition" FROM "ReconstructionCase" WHERE "id" = 'legacy-case'`);
        assert.equal(legacySchema[0]?.schemaDefinition, '{}', 'existing cases should receive the documented legacy default');
    } finally {
        try { await prisma.$disconnect(); }
        finally { rmSync(tempDirectory, { recursive: true, force: true }); }
    }
});
