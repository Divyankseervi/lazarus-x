import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { DEFAULT_DATABASE_URL, resolveSqliteDatabaseUrl } from './database_url';

/** Build the Prisma client using the configured SQLite URL or the legacy local default. */
export function createConfiguredPrismaClient(): PrismaClient {
    const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
    const provider = process.env.DATABASE_PROVIDER?.trim().toLowerCase() || 'sqlite';
    const resolvedUrl = provider === 'postgresql'
        ? databaseUrl
        : resolveSqliteDatabaseUrl(databaseUrl, path.resolve(__dirname, '../prisma'));
    if (provider !== 'sqlite' && provider !== 'postgresql') {
        throw new Error('DATABASE_PROVIDER must be either sqlite or postgresql.');
    }
    if (provider === 'postgresql' && !/^postgres(?:ql)?:\/\//i.test(resolvedUrl)) {
        throw new Error('PostgreSQL requires a postgres:// or postgresql:// DATABASE_URL.');
    }
    process.env.DATABASE_URL = resolvedUrl;
    return new PrismaClient({ datasources: { db: { url: resolvedUrl } } });
}
