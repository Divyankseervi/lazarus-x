import { PrismaClient } from '@prisma/client';
import { hashPassword } from './security/password';

export async function provisionAdmin(prisma: PrismaClient, email: string, password: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail.length > 254 || !/^\S+@\S+\.\S+$/.test(normalizedEmail) ||
        password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error('Administrator provisioning requires a valid email and a password from 12 characters to 72 UTF-8 bytes.');
    }

    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async tx => {
        const existing = await tx.user.findUnique({ where: { email: normalizedEmail } });
        if (existing) {
            await tx.user.update({
                where: { email: normalizedEmail },
                data: { passwordHash, role: 'ADMIN' }
            });
            // Credential rotation, role changes, and operator takeovers revoke
            // every bearer token issued under the previous account state.
            await tx.session.deleteMany({ where: { userId: existing.id } });
        } else {
            await tx.user.create({
                data: { email: normalizedEmail, passwordHash, role: 'ADMIN' }
            });
        }
    });
}

async function runProvisioningCommand(): Promise<void> {
    const email = process.env.LAZARUS_ADMIN_EMAIL;
    const password = process.env.LAZARUS_ADMIN_PASSWORD;
    if (!email || !password) {
        throw new Error('Set LAZARUS_ADMIN_EMAIL and LAZARUS_ADMIN_PASSWORD in the operator environment.');
    }

    const { createConfiguredPrismaClient } = require('./database') as typeof import('./database');
    const prisma = createConfiguredPrismaClient();
    try {
        await provisionAdmin(prisma, email, password);
        console.log('Administrator account provisioned.');
    } finally {
        await prisma.$disconnect();
    }
}

if (require.main === module) {
    runProvisioningCommand().catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : 'Administrator provisioning failed.');
        process.exitCode = 1;
    });
}
