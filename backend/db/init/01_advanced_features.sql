-- =========================================================================
-- LAZARUS-X ADVANCED DATABASE FEATURES (POSTGRESQL INITIALIZATION)
-- Course: BCSE302P - Database Systems Lab | Faculty: Dr. V. SIVAKUMAR
-- Slot: L25+L26 | Semester: Fall Semester 2026-27
-- =========================================================================

-- 1. VIEW: Case Activity and Provenance Summary (Joins & Aggregates)
CREATE OR REPLACE VIEW vw_case_activity_summary AS
SELECT
    c.id AS case_id,
    c.name AS case_name,
    c.status AS case_status,
    u.email AS owner_email,
    u.role AS owner_role,
    COUNT(DISTINCT e.id) AS total_evidence_fragments,
    COUNT(DISTINCT p.id) AS total_provenance_entries,
    c."updatedAt" AS last_updated
FROM "ReconstructionCase" c
INNER JOIN "User" u ON c."ownerId" = u.id
LEFT JOIN "EvidenceFragment" e ON c.id = e."caseId"
LEFT JOIN "EvidenceProvenanceEntry" p ON c.id = p."caseId"
GROUP BY c.id, c.name, c.status, u.email, u.role, c."updatedAt";

-- 2. VIEW: Candidate Hypothesis Ranking (Aggregates & Window Functions)
CREATE OR REPLACE VIEW vw_candidate_hypothesis_ranking AS
SELECT
    c.id AS case_id,
    cr.id AS candidate_id,
    cr."probabilityScore",
    cr."isPruned",
    RANK() OVER (PARTITION BY c.id ORDER BY cr."probabilityScore" DESC) AS rank
FROM "ReconstructionCase" c
JOIN "CandidateReconstruction" cr ON c.id = cr."caseId"
WHERE cr."isPruned" = false;

-- 3. STORED PROCEDURE: Atomic Case Sealing & Custody Finalization
CREATE OR REPLACE PROCEDURE sp_seal_forensic_case(
    p_case_id TEXT,
    p_admin_user_id TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_status TEXT;
    v_evidence_count INT;
BEGIN
    SELECT status INTO v_status FROM "ReconstructionCase" WHERE id = p_case_id FOR UPDATE;

    IF v_status IS NULL THEN
        RAISE EXCEPTION 'Case % not found', p_case_id;
    END IF;

    IF v_status = 'SEALED' THEN
        RAISE EXCEPTION 'Case % is already cryptographically sealed', p_case_id;
    END IF;

    SELECT COUNT(*) INTO v_evidence_count FROM "EvidenceFragment" WHERE "caseId" = p_case_id;

    UPDATE "ReconstructionCase"
    SET status = 'SEALED',
        "provenanceSequence" = v_evidence_count,
        "updatedAt" = NOW()
    WHERE id = p_case_id;

    INSERT INTO "AuditLog" (id, "userId", action, "resourceType", "resourceId", timestamp)
    VALUES (
        gen_random_uuid()::text,
        p_admin_user_id,
        'STORED_PROCEDURE_SEAL_CASE',
        'CASE',
        p_case_id,
        NOW()
    );
END;
$$;

-- 4. TRIGGER: Automated Audit Logging on Evidence Fragment Insertion
CREATE OR REPLACE FUNCTION fn_audit_evidence_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO "AuditLog" (id, "userId", action, "resourceType", "resourceId", timestamp)
    VALUES (
        gen_random_uuid()::text,
        NEW."userId",
        'TRIGGER_AUTO_AUDIT: EVIDENCE_FRAGMENT_COMMITTED',
        'CASE',
        NEW."caseId",
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_audit_evidence_insert
AFTER INSERT ON "EvidenceFragment"
FOR EACH ROW
EXECUTE FUNCTION fn_audit_evidence_insert();

-- 5. TRIGGER: Immutability Guard Preventing Post-Seal Evidence Insertion
CREATE OR REPLACE FUNCTION fn_guard_sealed_case()
RETURNS TRIGGER AS $$
DECLARE
    v_case_status TEXT;
BEGIN
    SELECT status INTO v_case_status FROM "ReconstructionCase" WHERE id = NEW."caseId";

    IF v_case_status = 'SEALED' THEN
        RAISE EXCEPTION 'FAIL_CLOSED TRIGGER: Case % is cryptographically sealed. New evidence insertion rejected.', NEW."caseId";
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_guard_sealed_case
BEFORE INSERT ON "EvidenceFragment"
FOR EACH ROW
EXECUTE FUNCTION fn_guard_sealed_case();
