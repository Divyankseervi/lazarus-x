-- Preserve an analyst-friendly source reference and optional artifact digest per evidence fragment.
-- Existing evidence remains valid with NULL metadata.
ALTER TABLE "EvidenceFragment" ADD COLUMN "sourceRef" TEXT;
ALTER TABLE "EvidenceFragment" ADD COLUMN "sourceSha256" TEXT;
