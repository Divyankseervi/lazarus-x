-- Views and triggers migration for SQLite live database
-- Provides declarative database views and fail-closed integrity triggers for LAZARUS-X

CREATE VIEW IF NOT EXISTS vw_case_activity_summary AS
SELECT 
  c.id AS caseId,
  c.name AS caseName,
  c.status AS caseStatus,
  u.email AS ownerEmail,
  u.role AS ownerRole,
  COUNT(DISTINCT e.id) AS total_evidence_fragments,
  COUNT(DISTINCT p.id) AS total_provenance_entries,
  c.updatedAt AS lastUpdated
FROM ReconstructionCase c
INNER JOIN User u ON c.ownerId = u.id
LEFT JOIN EvidenceFragment e ON c.id = e.caseId
LEFT JOIN EvidenceProvenanceEntry p ON c.id = p.caseId
GROUP BY c.id, c.name, c.status, u.email, u.role, c.updatedAt;

CREATE VIEW IF NOT EXISTS vw_candidate_ranking AS
SELECT 
  c.id AS caseId,
  cr.id AS candidateId,
  cr.probabilityScore,
  cr.isPruned
FROM ReconstructionCase c
JOIN CandidateReconstruction cr ON c.id = cr.caseId
WHERE cr.isPruned = 0;

CREATE TRIGGER IF NOT EXISTS trg_audit_evidence_insert
AFTER INSERT ON EvidenceFragment
BEGIN
  INSERT INTO AuditLog (id, userId, action, resourceType, resourceId, timestamp)
  VALUES (
    lower(hex(randomblob(16))),
    NEW.userId,
    'TRIGGER_AUTO_AUDIT: EVIDENCE_FRAGMENT_COMMITTED',
    'CASE',
    NEW.caseId,
    CURRENT_TIMESTAMP
  );
END;

CREATE TRIGGER IF NOT EXISTS trg_seal_insert_guard
BEFORE INSERT ON EvidenceFragment
WHEN (SELECT status FROM ReconstructionCase WHERE id = NEW.caseId) = 'SEALED'
BEGIN
  SELECT RAISE(ABORT, 'FAIL_CLOSED TRIGGER: Case is sealed (database insert guard). New evidence insertion rejected.');
END;
