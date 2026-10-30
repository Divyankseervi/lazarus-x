require('dotenv').config();

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const provider = (process.env.DATABASE_PROVIDER || 'sqlite').trim().toLowerCase();
const cliPath = path.resolve(__dirname, '../node_modules/prisma/build/index.js');

function runPrisma(args) {
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        cwd: path.resolve(__dirname, '..'),
        env: process.env,
        stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}

function generateClient(schema) {
    // Production Docker images generate the matching client at build time and
    // run with a read-only root filesystem. Keep local setup self-contained.
    if (process.env.PRISMA_CLIENT_GENERATED === 'true') return;
    runPrisma(['generate', '--schema', schema]);
}

if (provider === 'sqlite') {
    const schema = 'prisma/schema.prisma';
    runPrisma(['validate', '--schema', schema]);
    generateClient(schema);
    runPrisma(['db', 'push', '--schema', schema]);
} else if (provider === 'postgresql') {
    const schema = 'prisma/supabase/schema.prisma';
    runPrisma(['validate', '--schema', schema]);
    generateClient(schema);
    runPrisma(['migrate', 'deploy', '--schema', schema]);
} else {
    console.error('DATABASE_PROVIDER must be either sqlite or postgresql.');
    process.exit(1);
}
