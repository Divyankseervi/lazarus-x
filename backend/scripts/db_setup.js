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
    // If DIRECT_URL is set to an IPv6-only direct Supabase host (db.*.supabase.co)
    // but DATABASE_URL uses the IPv4 pooler, fall back DIRECT_URL to DATABASE_URL
    // so Prisma migrations succeed on IPv4-only cloud platforms (like Render).
    if (process.env.DIRECT_URL && /db\.[a-z0-9]+\.supabase\.co/i.test(process.env.DIRECT_URL) && process.env.DATABASE_URL && /pooler\.supabase\.com/i.test(process.env.DATABASE_URL)) {
        console.log('Notice: overriding IPv6-only DIRECT_URL with IPv4 DATABASE_URL pooler for cloud host compatibility.');
        process.env.DIRECT_URL = process.env.DATABASE_URL;
    }
    const schema = 'prisma/supabase/schema.prisma';
    runPrisma(['validate', '--schema', schema]);
    generateClient(schema);
    runPrisma(['migrate', 'deploy', '--schema', schema]);
} else {
    console.error('DATABASE_PROVIDER must be either sqlite or postgresql.');
    process.exit(1);
}
