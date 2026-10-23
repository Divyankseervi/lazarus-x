-- Persist the declared target schema with each case. Existing records receive
-- an empty JSON object and are interpreted through the legacy compatibility schema.
ALTER TABLE "ReconstructionCase"
ADD COLUMN "schemaDefinition" TEXT NOT NULL DEFAULT '{}';
