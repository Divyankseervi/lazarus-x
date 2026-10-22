import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addDBMSRequirements() {
    try {
        console.log("Applying DBMS Course Requirements (Views & Triggers)...");
        
        // Requirement: Views
        await prisma.$executeRawUnsafe(`
            CREATE VIEW IF NOT EXISTS CaseActivitySummary AS
            SELECT c.id as caseId, c.name, u.email as ownerEmail, count(e.id) as evidenceCount
            FROM ReconstructionCase c
            JOIN User u ON c.ownerId = u.id
            LEFT JOIN EvidenceFragment e ON e.caseId = c.id
            GROUP BY c.id;
        `);
        console.log("✅ Created VIEW: CaseActivitySummary");

        // Requirement: Triggers
        await prisma.$executeRawUnsafe(`
            CREATE TRIGGER IF NOT EXISTS AuditLogOnEvidence
            AFTER INSERT ON EvidenceFragment
            BEGIN
                INSERT INTO AuditLog (id, userId, action, resourceType, resourceId, timestamp)
                VALUES (lower(hex(randomblob(16))), NEW.userId, 'SUBMIT_EVIDENCE_TRIGGER', 'CASE', NEW.caseId, CURRENT_TIMESTAMP);
            END;
        `);
        console.log("✅ Created TRIGGER: AuditLogOnEvidence");
        
        // Demonstration of Joins/Aggregations from the View
        const viewData = await prisma.$queryRawUnsafe('SELECT * FROM CaseActivitySummary;');
        console.log("VIEW Query Result:", viewData);

    } catch (e) {
        console.error("Error applying requirements:", e);
    } finally {
        await prisma.$disconnect();
    }
}

addDBMSRequirements();
