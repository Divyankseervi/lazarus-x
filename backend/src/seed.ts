import { hashPassword } from './security/password';
import { createConfiguredPrismaClient } from './database';

async function main() {
  console.log('[SEED] Provisioning evaluator accounts in dev.db...');
  const prisma = createConfiguredPrismaClient();

  try {
    // 1. Investigator 23bce1042@vitstudent.ac.in (Password123!456)
    const invHash = await hashPassword('Password123!456');
    const investigator = await prisma.user.upsert({
      where: { email: '23bce1042@vitstudent.ac.in' },
      update: { passwordHash: invHash, role: 'INVESTIGATOR' },
      create: {
        email: '23bce1042@vitstudent.ac.in',
        passwordHash: invHash,
        role: 'INVESTIGATOR'
      }
    });
    console.log(`✔ Seeded Investigator: ${investigator.email} (Role: ${investigator.role})`);

    // 2. Admin admin@lazarus-forensics.org (AdminSecret#2026)
    const adminHash = await hashPassword('AdminSecret#2026');
    const admin = await prisma.user.upsert({
      where: { email: 'admin@lazarus-forensics.org' },
      update: { passwordHash: adminHash, role: 'ADMIN' },
      create: {
        email: 'admin@lazarus-forensics.org',
        passwordHash: adminHash,
        role: 'ADMIN'
      }
    });
    console.log(`✔ Seeded Admin: ${admin.email} (Role: ${admin.role})`);

    // 3. Demo Case
    const existingCase = await prisma.reconstructionCase.findFirst({
      where: { ownerId: investigator.id }
    });

    if (!existingCase) {
      const demoState = {
        Department: [
          { _recordId: 10, id: 1, name: 'Cyber Defense & Forensics', budget: 850000 },
          { _recordId: 11, id: 2, name: 'Threat Intelligence', budget: 620000 }
        ],
        Employee: [
          { _recordId: 20, id: 101, name: 'Special Agent Vance', deptId: 1, salary: 135000, badgeNumber: 'CYBER-09' },
          { _recordId: 21, id: 102, name: 'Dr. Sarah Connor', deptId: 1, salary: 142000, badgeNumber: 'CYBER-14' },
          { _recordId: 22, id: 103, name: 'Inspector Marcus Wright', deptId: 2, salary: 118000, badgeNumber: 'INTEL-03' }
        ],
        Order: [
          { _recordId: 30, id: 5001, employeeId: 101, totalAmount: 42000, status: 'VERIFIED' },
          { _recordId: 31, id: 5002, employeeId: 102, totalAmount: 18500, status: 'APPROVED' }
        ]
      };

      const demoCase = await prisma.reconstructionCase.create({
        data: {
          name: 'Operation Chimera - Forensic Database Recovery',
          status: 'ACTIVE',
          ownerId: investigator.id,
          currentState: JSON.stringify(demoState),
          provenanceHead: 'b4c2613e5407a1150c170fd4d99d11fbb2d4b1eb9d9be872a9e5f0b843104d91',
          provenanceSequence: 5
        }
      });
      console.log(`✔ Seeded Demo Case: "${demoCase.name}" (ID: ${demoCase.id})`);

      // Seed Audit Logs
      await prisma.auditLog.create({
        data: { userId: investigator.id, action: 'LOGIN', resourceType: 'USER', resourceId: investigator.id }
      });
      await prisma.auditLog.create({
        data: { userId: investigator.id, action: 'CREATE_CASE', resourceType: 'CASE', resourceId: demoCase.id }
      });
      await prisma.auditLog.create({
        data: { userId: investigator.id, action: 'SUBMIT_EVIDENCE', resourceType: 'CASE', resourceId: demoCase.id }
      });
      await prisma.auditLog.create({
        data: { userId: admin.id, action: 'LOGIN', resourceType: 'USER', resourceId: admin.id }
      });
      console.log('✔ Seeded Relational Audit Logs.');
    } else {
      console.log(`ℹ Case already present: "${existingCase.name}"`);
    }

    console.log('[SEED] Database seeding complete and ready for live evaluation!');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('[SEED ERROR]', err);
    process.exit(1);
  });
}
