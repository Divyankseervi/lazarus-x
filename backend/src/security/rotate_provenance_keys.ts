import 'dotenv/config';
import { parseProvenanceMasterKey } from '../engine/provenance';
import { rotateCaseProvenanceKeys } from './key_rotation';

/**
 * Offline operator command. Stop API writers first, inject both keys through
 * the secret manager/environment, run this once, then change the API secret.
 * Key material is never accepted as an argument or written to output.
 */
async function runRotationCommand(): Promise<void> {
    const readOperatorKey = (name: 'PROVENANCE_OLD_ENCRYPTION_KEY' | 'PROVENANCE_NEW_ENCRYPTION_KEY'): Buffer => {
        const value = process.env[name];
        if (!value) throw new Error(`${name} is required.`);
        try { return parseProvenanceMasterKey(value); }
        catch { throw new Error(`${name} must be set to 64 hexadecimal characters.`); }
    };
    const oldMasterKey = readOperatorKey('PROVENANCE_OLD_ENCRYPTION_KEY');
    const newMasterKey = readOperatorKey('PROVENANCE_NEW_ENCRYPTION_KEY');
    if (oldMasterKey.equals(newMasterKey)) {
        throw new Error('The new provenance master key must differ from the old key.');
    }

    const { createConfiguredPrismaClient } = require('../database') as typeof import('../database');
    const prisma = createConfiguredPrismaClient();
    try {
        const result = await rotateCaseProvenanceKeys(prisma, oldMasterKey, newMasterKey);
        process.stdout.write(`${JSON.stringify({ operation: 'provenance-key-rotation', ...result })}\n`);
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    runRotationCommand().catch((error: unknown) => {
        const knownMessage = error instanceof Error && /^(PROVENANCE_(OLD|NEW)_ENCRYPTION_KEY (is required|must be set to 64 hexadecimal characters)\.|The new provenance master key must differ from the old key\.)$/.test(error.message)
            ? error.message
            : 'Database rotation failed. Check operator logs for the error class; key material was not logged.';
        process.stderr.write(`Provenance key rotation failed: ${knownMessage}\n`);
        process.exitCode = 1;
    });
}
