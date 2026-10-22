import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import path from 'node:path';
import { DEFAULT_DATABASE_URL, resolveSqliteDatabaseUrl } from './database_url';

/** Build the Prisma client using the configured SQLite URL or the legacy local default. */
export function createConfiguredPrismaClient(): PrismaClient {
    const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
    const resolvedUrl = resolveSqliteDatabaseUrl(databaseUrl, path.resolve(__dirname, '../prisma'));
    process.env.DATABASE_URL = resolvedUrl;
    return new PrismaClient({ datasources: { db: { url: resolvedUrl } } });
}
