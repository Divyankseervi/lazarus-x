-- Additive LAZARUS-X provenance schema update.
-- Apply only to a reviewed production database that does not already contain
-- this column or index. Do not run this migration against backend/prisma/dev.db.
ALTER TABLE "ReconstructionCase" ADD COLUMN "provenanceSaltCiphertext" TEXT;

CREATE INDEX IF NOT EXISTS "EvidenceProvenanceEntry_caseId_receivedAt_idx"
  ON "EvidenceProvenanceEntry"("caseId", "receivedAt");
