import os from 'node:os';
import path from 'node:path';
import { createApp } from './index';

const databaseUrl = process.env.LAZARUS_E2E_DATABASE_URL;
const port = Number(process.env.PORT);
if (!databaseUrl || !databaseUrl.startsWith('file:') || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('The isolated E2E database URL and a valid port are required.');
}
let rawDatabasePath: string;
try {
    rawDatabasePath = decodeURIComponent(databaseUrl.slice('file:'.length).split('?')[0]);
} catch {
    throw new Error('The isolated E2E database URL contains an invalid encoded path.');
}
const databasePath = path.resolve(rawDatabasePath.replace(/\//g, path.sep));
const tempRoot = path.resolve(os.tmpdir());
const databaseDirectory = path.dirname(databasePath);
if (!databasePath.toLowerCase().endsWith(`${path.sep}e2e.db`.toLowerCase()) ||
    !databaseDirectory.startsWith(`${tempRoot}${path.sep}`) ||
    !path.basename(databaseDirectory).startsWith('lazarus-x-e2e-')) {
    throw new Error('The E2E API refuses database files outside its dedicated temporary directory.');
}

process.env.DATABASE_URL = databaseUrl;
const { createConfiguredPrismaClient } = require('./database') as typeof import('./database');
const prisma = createConfiguredPrismaClient();
const app = createApp(prisma, Buffer.alloc(32, 0x42));
let server: ReturnType<typeof app.listen> | undefined;
let shuttingDown = false;
const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const finish = () => { void prisma.$disconnect().finally(() => { process.exitCode = 0; }); };
    if (server) server.close(finish);
    else finish();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

async function startServer(): Promise<void> {
    try {
        await prisma.$connect();
        await prisma.user.count();
    } catch (error) {
        const errorCode = typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : undefined;
        process.stderr.write(`LAZARUS_E2E_DATABASE_ERROR:${error instanceof Error ? error.name : 'UnknownError'}${errorCode ? `:${errorCode}` : ''}\n`);
        await prisma.$disconnect().catch(() => undefined);
        process.exitCode = 1;
        return;
    }

    server = app.listen(port, '127.0.0.1', () => {
        process.stdout.write(`LAZARUS_E2E_READY:${port}\n`);
    });
    server.on('error', error => {
        process.stderr.write(`LAZARUS_E2E_SERVER_ERROR:${error.name}\n`);
        void prisma.$disconnect().finally(() => { process.exitCode = 1; });
    });
}

void startServer();
