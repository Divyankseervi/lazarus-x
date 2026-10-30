require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

if ((process.env.DATABASE_PROVIDER || '').trim().toLowerCase() !== 'postgresql') {
    console.error('Set DATABASE_PROVIDER=postgresql before running the Supabase smoke check.');
    process.exit(1);
}

const prisma = new PrismaClient();
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const userId = `supabase-smoke-${suffix}`;
const caseId = `supabase-smoke-${suffix}`;
const evidenceId = `supabase-smoke-${suffix}`;

async function cleanUp() {
    await prisma.auditLog.deleteMany({ where: { userId } });
    await prisma.evidenceFragment.deleteMany({ where: { id: evidenceId } });
    await prisma.reconstructionCase.deleteMany({ where: { id: caseId } });
    await prisma.user.deleteMany({ where: { id: userId } });
}

async function main() {
    try {
        await prisma.user.create({
            data: { id: userId, email: `${suffix}@example.invalid`, passwordHash: 'smoke-test-only' },
        });
        await prisma.reconstructionCase.create({
            data: { id: caseId, name: 'Temporary Supabase smoke check', currentState: '{}', schemaDefinition: '{}', ownerId: userId },
        });
        await prisma.evidenceFragment.create({
            data: { id: evidenceId, caseId, table: 'Smoke', recordId: 1, field: 'value', value: 'temporary', userId },
        });

        const auditCount = await prisma.auditLog.count({
            where: { userId, resourceId: caseId, action: 'TRIGGER_AUTO_AUDIT: EVIDENCE_FRAGMENT_COMMITTED' },
        });
        const viewRows = await prisma.$queryRaw`SELECT total_evidence_fragments FROM public.vw_case_activity_summary WHERE "caseId" = ${caseId}`;
        if (auditCount !== 1 || Number(viewRows[0]?.total_evidence_fragments) !== 1) {
            throw new Error('Evidence audit trigger or activity view returned an unexpected result.');
        }

        await prisma.reconstructionCase.update({ where: { id: caseId }, data: { status: 'SEALED' } });
        let sealedInsertRejected = false;
        try {
            await prisma.evidenceFragment.create({
                data: { id: `${evidenceId}-sealed`, caseId, table: 'Smoke', recordId: 2, field: 'value', value: 'blocked', userId },
            });
        } catch (error) {
            sealedInsertRejected = String(error?.message || error).includes('case is sealed');
        }
        if (!sealedInsertRejected) throw new Error('Sealed-case insert guard did not reject a direct database insert.');

        const rlsTables = await prisma.$queryRaw`
          SELECT COUNT(*)::int AS count
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind = 'r'
            AND c.relrowsecurity = true
            AND c.relname IN ('User', 'Session', 'AuditLog', 'ReconstructionCase', 'EvidenceFragment', 'SourceDocumentLocation', 'EvidenceProvenanceEntry', 'CandidateReconstruction', 'ConstraintEvaluation', 'Department', 'Employee', 'Order')
        `;
        if (rlsTables[0]?.count !== 12) throw new Error('RLS is not enabled on all 12 application tables.');

        console.log(JSON.stringify({ connected: true, evidenceAuditTrigger: 'passed', sealedInsertGuard: 'passed', activityView: 'passed', rlsTables: rlsTables[0].count }));
    } finally {
        await cleanUp();
        await prisma.$disconnect();
    }
}

main().catch(error => {
    console.error(JSON.stringify({ connected: false, name: error?.name || 'Error', code: error?.code || null, message: error?.message || 'Smoke check failed.' }));
    process.exitCode = 1;
});
