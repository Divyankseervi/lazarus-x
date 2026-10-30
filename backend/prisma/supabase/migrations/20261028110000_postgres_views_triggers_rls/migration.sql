-- PostgreSQL equivalents for the SQLite views and integrity triggers, plus
-- row-level security defaults that keep the public Data API from reading app data.

CREATE OR REPLACE VIEW public.vw_case_activity_summary
WITH (security_invoker = true)
AS
SELECT
  c.id AS "caseId",
  c.name AS "caseName",
  c.status AS "caseStatus",
  u.email AS "ownerEmail",
  u.role AS "ownerRole",
  COUNT(DISTINCT e.id) AS total_evidence_fragments,
  COUNT(DISTINCT p.id) AS total_provenance_entries,
  c."updatedAt" AS "lastUpdated"
FROM public."ReconstructionCase" AS c
JOIN public."User" AS u ON u.id = c."ownerId"
LEFT JOIN public."EvidenceFragment" AS e ON e."caseId" = c.id
LEFT JOIN public."EvidenceProvenanceEntry" AS p ON p."caseId" = c.id
GROUP BY c.id, c.name, c.status, u.email, u.role, c."updatedAt";

CREATE OR REPLACE VIEW public.vw_candidate_ranking
WITH (security_invoker = true)
AS
SELECT
  c.id AS "caseId",
  cr.id AS "candidateId",
  cr."probabilityScore",
  cr."isPruned"
FROM public."ReconstructionCase" AS c
JOIN public."CandidateReconstruction" AS cr ON cr."caseId" = c.id
WHERE cr."isPruned" = false;

CREATE OR REPLACE FUNCTION public.lazarus_audit_evidence_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public."AuditLog" (id, "userId", action, "resourceType", "resourceId", timestamp)
  VALUES (
    gen_random_uuid()::text,
    NEW."userId",
    'TRIGGER_AUTO_AUDIT: EVIDENCE_FRAGMENT_COMMITTED',
    'CASE',
    NEW."caseId",
    CURRENT_TIMESTAMP
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_evidence_insert ON public."EvidenceFragment";
CREATE TRIGGER trg_audit_evidence_insert
AFTER INSERT ON public."EvidenceFragment"
FOR EACH ROW
EXECUTE FUNCTION public.lazarus_audit_evidence_insert();

CREATE OR REPLACE FUNCTION public.lazarus_reject_evidence_for_sealed_case()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public."ReconstructionCase"
    WHERE id = NEW."caseId" AND status = 'SEALED'
  ) THEN
    RAISE EXCEPTION 'FAIL_CLOSED: case is sealed; evidence insertion rejected.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seal_insert_guard ON public."EvidenceFragment";
CREATE TRIGGER trg_seal_insert_guard
BEFORE INSERT ON public."EvidenceFragment"
FOR EACH ROW
EXECUTE FUNCTION public.lazarus_reject_evidence_for_sealed_case();

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'User', 'Session', 'AuditLog', 'ReconstructionCase', 'EvidenceFragment',
    'SourceDocumentLocation', 'EvidenceProvenanceEntry', 'CandidateReconstruction',
    'ConstraintEvaluation', 'Department', 'Employee', 'Order'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', table_name);
  END LOOP;
END;
$$;

REVOKE ALL ON public.vw_case_activity_summary, public.vw_candidate_ranking FROM anon, authenticated;
