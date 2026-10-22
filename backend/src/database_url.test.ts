import assert from 'node:assert/strict';
import { test } from 'node:test';
import path from 'node:path';
import { resolveSqliteDatabaseUrl } from './database_url';

test('SQLite URLs resolve relative paths from the Prisma schema directory', () => {
    const schemaDirectory = path.resolve('isolated-schema-root');
    assert.equal(
        resolveSqliteDatabaseUrl('file:./dev.db', schemaDirectory),
        `file:${path.join(schemaDirectory, 'dev.db').replace(/\\/g, '/')}`,
    );
    assert.equal(
        resolveSqliteDatabaseUrl('file:../data/case.db?mode=rwc', schemaDirectory),
        `file:${path.resolve(schemaDirectory, '../data/case.db').replace(/\\/g, '/')}?mode=rwc`,
    );
});

test('SQLite URL resolution preserves absolute paths and rejects other providers', () => {
    const schemaDirectory = path.resolve('isolated-schema-root');
    const absolutePath = path.resolve('isolated-database.db');
    assert.equal(
        resolveSqliteDatabaseUrl(`file:${absolutePath.replace(/\\/g, '/')}`, schemaDirectory),
        `file:${absolutePath.replace(/\\/g, '/')}`,
    );
    assert.throws(() => resolveSqliteDatabaseUrl('postgresql://localhost/db', schemaDirectory), /SQLite/);
    assert.throws(() => resolveSqliteDatabaseUrl('file:%ZZ', schemaDirectory), /encoded SQLite path/);
});

test('SQLite URL resolution safely encodes spaces and URL delimiters in paths', () => {
    const schemaDirectory = path.resolve('isolated-schema-root');
    const expectedPath = path.resolve(schemaDirectory, 'folder with space', 'db#one.db')
        .split(path.sep)
        .map(segment => encodeURIComponent(segment).replace(/%3A/gi, ':'))
        .join('/');
    assert.equal(
        resolveSqliteDatabaseUrl('file:./folder%20with%20space/db%23one.db?mode=rwc', schemaDirectory),
        `file:${expectedPath}?mode=rwc`,
    );
});
