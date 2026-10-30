-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'INVESTIGATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconstructionCase" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Untitled Case',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "currentState" TEXT NOT NULL,
    "schemaDefinition" TEXT NOT NULL DEFAULT '{}',
    "provenanceHead" TEXT NOT NULL DEFAULT 'b4c2613e5407a1150c170fd4d99d11fbb2d4b1eb9d9be872a9e5f0b843104d91',
    "provenanceSequence" INTEGER NOT NULL DEFAULT 0,
    "provenanceSaltCiphertext" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReconstructionCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFragment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "table" TEXT NOT NULL,
    "recordId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceRef" TEXT,
    "sourceSha256" TEXT,

    CONSTRAINT "EvidenceFragment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocumentLocation" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "departmentName" TEXT NOT NULL,
    "officeName" TEXT NOT NULL,
    "documentName" TEXT NOT NULL,
    "referenceCode" TEXT,
    "sourceReference" TEXT,
    "storageLocation" TEXT NOT NULL,
    "custodian" TEXT,
    "contact" TEXT,
    "accessNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_STORAGE',
    "demoKey" TEXT,
    "lastVerifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceDocumentLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceProvenanceEntry" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "fragmentId" TEXT NOT NULL,
    "relatedFragmentIds" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "payload" TEXT NOT NULL,
    "previousHash" TEXT NOT NULL,
    "hash" TEXT NOT NULL,

    CONSTRAINT "EvidenceProvenanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateReconstruction" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "stateDump" TEXT NOT NULL,
    "probabilityScore" DOUBLE PRECISION NOT NULL,
    "isPruned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateReconstruction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstraintEvaluation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "constraintId" TEXT NOT NULL,
    "fatalViolations" INTEGER NOT NULL DEFAULT 0,
    "resolvableViolations" INTEGER NOT NULL DEFAULT 0,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstraintEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "departmentId" INTEGER NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "employeeId" INTEGER NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "ReconstructionCase_ownerId_updatedAt_idx" ON "ReconstructionCase"("ownerId", "updatedAt");

-- CreateIndex
CREATE INDEX "EvidenceFragment_caseId_id_idx" ON "EvidenceFragment"("caseId", "id");

-- CreateIndex
CREATE INDEX "SourceDocumentLocation_ownerId_departmentName_officeName_idx" ON "SourceDocumentLocation"("ownerId", "departmentName", "officeName");

-- CreateIndex
CREATE INDEX "SourceDocumentLocation_ownerId_documentName_idx" ON "SourceDocumentLocation"("ownerId", "documentName");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocumentLocation_ownerId_demoKey_key" ON "SourceDocumentLocation"("ownerId", "demoKey");

-- CreateIndex
CREATE INDEX "EvidenceProvenanceEntry_caseId_hash_idx" ON "EvidenceProvenanceEntry"("caseId", "hash");

-- CreateIndex
CREATE INDEX "EvidenceProvenanceEntry_caseId_receivedAt_idx" ON "EvidenceProvenanceEntry"("caseId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceProvenanceEntry_caseId_sequence_key" ON "EvidenceProvenanceEntry"("caseId", "sequence");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconstructionCase" ADD CONSTRAINT "ReconstructionCase_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFragment" ADD CONSTRAINT "EvidenceFragment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReconstructionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFragment" ADD CONSTRAINT "EvidenceFragment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocumentLocation" ADD CONSTRAINT "SourceDocumentLocation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceProvenanceEntry" ADD CONSTRAINT "EvidenceProvenanceEntry_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReconstructionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateReconstruction" ADD CONSTRAINT "CandidateReconstruction_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReconstructionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstraintEvaluation" ADD CONSTRAINT "ConstraintEvaluation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "ReconstructionCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

