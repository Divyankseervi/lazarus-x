-- Additive LAZARUS-X Merkle accumulator schema update.
-- Records verified Merkle roots and public envelope heads for fast O(1) checkpoint lookup.
-- Apply only to a reviewed production database that does not already contain these columns.
-- Do not run this migration against backend/prisma/dev.db.
ALTER TABLE "ReconstructionCase" ADD COLUMN "provenanceMerkleRoot" TEXT;
ALTER TABLE "ReconstructionCase" ADD COLUMN "provenanceEnvelopeHead" TEXT;
