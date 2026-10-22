import React, { useState } from 'react';
import { Database, X, ShieldCheck, Key, GitFork, CheckCircle, Table, Layers } from 'lucide-react';

interface ERDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TableDefinition {
  name: string;
  category: 'System & Security' | 'Forensic Workflow' | 'Relational Target Schema';
  description: string;
  primaryKey: string;
  foreignKeys: string[];
  attributes: Array<{
    name: string;
    type: string;
    constraints: string;
    description: string;
  }>;
}

const SCHEMA_TABLES: TableDefinition[] = [
  {
    name: 'User',
    category: 'System & Security',
    description: 'Single unified entity for RBAC storing investigators and chief auditors with BCrypt password hashes.',
    primaryKey: 'id (UUID)',
    foreignKeys: [],
    attributes: [
      { name: 'id', type: 'String (UUID)', constraints: 'PRIMARY KEY, NOT NULL', description: 'Unique user identifier' },
      { name: 'email', type: 'String', constraints: 'UNIQUE, NOT NULL', description: 'Investigator academic/organization email' },
      { name: 'passwordHash', type: 'String', constraints: 'NOT NULL', description: 'BCrypt KDF (Cost 12) password digest' },
      { name: 'role', type: 'String', constraints: "DEFAULT 'INVESTIGATOR'", description: 'RBAC authorization level: ADMIN or INVESTIGATOR' },
      { name: 'createdAt', type: 'DateTime', constraints: 'DEFAULT now()', description: 'Account registration timestamp' },
    ]
  },
  {
    name: 'Session',
    category: 'System & Security',
    description: 'Active authentication sessions storing SHA-256 digests of bearer tokens with automated eviction.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['userId -> User.id (CASCADE)'],
    attributes: [
      { name: 'id', type: 'String (UUID)', constraints: 'PRIMARY KEY, NOT NULL', description: 'Session identifier' },
      { name: 'token', type: 'String', constraints: 'UNIQUE, NOT NULL', description: 'SHA-256 digest of bearer token' },
      { name: 'userId', type: 'String', constraints: 'FOREIGN KEY, NOT NULL', description: 'Reference to authenticated User' },
      { name: 'expiresAt', type: 'DateTime', constraints: 'NOT NULL', description: 'Session expiration deadline (24h TTL)' },
      { name: 'createdAt', type: 'DateTime', constraints: 'DEFAULT now()', description: 'Session issuance timestamp' },
    ]
  },
  {
    name: 'AuditLog',
    category: 'System & Security',
    description: 'Immutable database audit trail recording security, mutation, and trigger actions.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['userId -> User.id'],
    attributes: [
      { name: 'id', type: 'String (UUID)', constraints: 'PRIMARY KEY, NOT NULL', description: 'Audit entry UUID' },
      { name: 'userId', type: 'String', constraints: 'FOREIGN KEY, NOT NULL', description: 'Actor user identifier' },
      { name: 'action', type: 'String', constraints: 'NOT NULL', description: 'Action opcode (LOGIN, CREATE_CASE, SEAL_CASE, etc.)' },
      { name: 'resourceType', type: 'String?', constraints: 'NULLABLE', description: 'Target entity type (CASE, DATABASE, etc.)' },
      { name: 'resourceId', type: 'String?', constraints: 'NULLABLE', description: 'Identifier of affected record' },
      { name: 'timestamp', type: 'DateTime', constraints: 'DEFAULT now()', description: 'Chronological event timestamp' },
    ]
  },
  {
    name: 'ReconstructionCase',
    category: 'Forensic Workflow',
    description: 'Central forensic investigation docket managing state versions, cryptographic salt, and custody status.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['ownerId -> User.id'],
    attributes: [
      { name: 'id', type: 'String (UUID)', constraints: 'PRIMARY KEY, NOT NULL', description: 'Case file UUID' },
      { name: 'name', type: 'String', constraints: "DEFAULT 'Untitled Case'", description: 'Forensic operation title' },
      { name: 'status', type: 'String', constraints: "DEFAULT 'ACTIVE'", description: 'Custody state: ACTIVE, SEALED, RESOLVED' },
      { name: 'currentState', type: 'String (JSON)', constraints: 'NOT NULL', description: 'Top candidate reconstruction snapshot' },
      { name: 'provenanceHead', type: 'String', constraints: 'NOT NULL', description: 'Current SHA-256 cryptographic chain head' },
      { name: 'provenanceSequence', type: 'Int', constraints: 'DEFAULT 0', description: 'Monotonic sequence counter' },
      { name: 'provenanceSaltCiphertext', type: 'String?', constraints: 'NULLABLE', description: 'AES-256-GCM encrypted case salt' },
      { name: 'ownerId', type: 'String', constraints: 'FOREIGN KEY, NOT NULL', description: 'Case creator investigator reference' },
    ]
  },
  {
    name: 'EvidenceFragment',
    category: 'Forensic Workflow',
    description: 'Individual fragmentary database observation collected from raw media or network traces.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['caseId -> ReconstructionCase.id (CASCADE)', 'userId -> User.id'],
    attributes: [
      { name: 'id', type: 'String (UUID)', constraints: 'PRIMARY KEY, NOT NULL', description: 'Fragment record UUID' },
      { name: 'caseId', type: 'String', constraints: 'FOREIGN KEY, NOT NULL', description: 'Parent case reference' },
      { name: 'table', type: 'String', constraints: 'NOT NULL', description: 'Target relational entity name' },
      { name: 'recordLocator', type: 'Int', constraints: 'NOT NULL', description: 'Heuristic row boundary identifier' },
      { name: 'payload', type: 'String (JSON)', constraints: 'NOT NULL', description: 'Field attributes and values observed' },
      { name: 'confidence', type: 'Float', constraints: 'DEFAULT 1.0', description: 'Investigator confidence rating [0.1, 1.0]' },
      { name: 'rawHash', type: 'String', constraints: 'NOT NULL', description: 'SHA-256 checksum of source byte fragment' },
    ]
  },
  {
    name: 'EvidenceProvenanceEntry',
    category: 'Forensic Workflow',
    description: 'Cryptographic ledger entries forming an RFC 6962 tamper-evident Merkle hash tree.',
    primaryKey: 'id (UUID)',
    foreignKeys: ['caseId -> ReconstructionCase.id (CASCADE)'],
    attributes: [
      { name: 'id', type: 'String (UUID)', constraints: 'PRIMARY KEY, NOT NULL', description: 'Ledger sequence UUID' },
      { name: 'caseId', type: 'String', constraints: 'FOREIGN KEY, NOT NULL', description: 'Parent case reference' },
      { name: 'sequence', type: 'Int', constraints: 'NOT NULL', description: 'Monotonic sequence number' },
      { name: 'eventType', type: 'String', constraints: 'NOT NULL', description: 'EVIDENCE_ACCEPTED or FUZZY_CORRECTION' },
      { name: 'hash', type: 'String', constraints: 'NOT NULL', description: 'SHA-256 node commitment hash' },
      { name: 'previousHash', type: 'String', constraints: 'NOT NULL', description: 'Predecessor envelope hash pointer' },
      { name: 'receivedAt', type: 'DateTime', constraints: 'DEFAULT now()', description: 'Ledger ingress timestamp' },
    ]
  },
  {
    name: 'Department',
    category: 'Relational Target Schema',
    description: 'Target organizational unit entity exhibiting 3NF/BCNF normalization.',
    primaryKey: 'id (Int)',
    foreignKeys: [],
    attributes: [
      { name: 'id', type: 'Int', constraints: 'PRIMARY KEY, AUTO_INCREMENT', description: 'Unique department code' },
      { name: 'name', type: 'String', constraints: 'UNIQUE, NOT NULL', description: 'Official organizational unit name' },
      { name: 'budget', type: 'Float', constraints: 'NOT NULL', description: 'Annual allocated operating budget' },
    ]
  },
  {
    name: 'Employee',
    category: 'Relational Target Schema',
    description: 'Target personnel entity with foreign key referencing Department and candidate disambiguation.',
    primaryKey: 'id (Int)',
    foreignKeys: ['deptId -> Department.id (CASCADE)'],
    attributes: [
      { name: 'id', type: 'Int', constraints: 'PRIMARY KEY, AUTO_INCREMENT', description: 'Unique employee ID' },
      { name: 'name', type: 'String', constraints: 'NOT NULL', description: 'Employee legal name' },
      { name: 'deptId', type: 'Int', constraints: 'FOREIGN KEY, NOT NULL', description: 'Associated Department reference' },
      { name: 'salary', type: 'Float', constraints: 'NOT NULL', description: 'Monthly base compensation' },
      { name: 'badgeNumber', type: 'String', constraints: 'UNIQUE, NOT NULL', description: 'Physical access badge credential' },
    ]
  },
  {
    name: 'Order',
    category: 'Relational Target Schema',
    description: 'Target transactional entity with foreign key referencing Employee.',
    primaryKey: 'id (Int)',
    foreignKeys: ['employeeId -> Employee.id (CASCADE)'],
    attributes: [
      { name: 'id', type: 'Int', constraints: 'PRIMARY KEY, AUTO_INCREMENT', description: 'Requisition order sequence ID' },
      { name: 'employeeId', type: 'Int', constraints: 'FOREIGN KEY, NOT NULL', description: 'Purchasing employee reference' },
      { name: 'totalAmount', type: 'Float', constraints: 'NOT NULL', description: 'Monetary procurement total' },
      { name: 'status', type: 'String', constraints: "DEFAULT 'PENDING'", description: 'Order lifecycle state' },
    ]
  }
];

export const ERDiagramModal: React.FC<ERDiagramModalProps> = ({ isOpen, onClose }) => {
  const [selectedTable, setSelectedTable] = useState<string>('Department');

  if (!isOpen) return null;

  const activeDef = SCHEMA_TABLES.find(t => t.name === selectedTable) || SCHEMA_TABLES[0]!;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box er-modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-icon-badge">
              <Database size={20} />
            </div>
            <div>
              <h2 className="modal-title">Relational ER Diagram &amp; Data Dictionary</h2>
              <p className="modal-subtitle">
                11-Table Normalized Relational Architecture · 3NF &amp; BCNF Verified (BCSE302P QP Section 2)
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="er-summary-banner">
          <div className="er-badge-item">
            <Layers size={14} />
            <span><strong>11 Database Relations</strong></span>
          </div>
          <div className="er-badge-item">
            <GitFork size={14} />
            <span><strong>10 Foreign Key Relationships</strong></span>
          </div>
          <div className="er-badge-item">
            <CheckCircle size={14} />
            <span><strong>Strict 3NF &amp; BCNF Conformance</strong></span>
          </div>
          <div className="er-badge-item">
            <ShieldCheck size={14} />
            <span><strong>Single-Table RBAC (No separate admin tables)</strong></span>
          </div>
        </div>

        <div className="er-body-layout">
          {/* Left Table Selector */}
          <aside className="er-tables-sidebar custom-scrollbar">
            <div className="er-category-group">
              <span className="er-category-title">Target Relational Schema (3NF)</span>
              {SCHEMA_TABLES.filter(t => t.category === 'Relational Target Schema').map(t => (
                <button
                  key={t.name}
                  type="button"
                  className={`er-table-pill ${selectedTable === t.name ? 'active' : ''}`}
                  onClick={() => setSelectedTable(t.name)}
                >
                  <Table size={13} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>

            <div className="er-category-group">
              <span className="er-category-title">Forensic Reconstruction Models</span>
              {SCHEMA_TABLES.filter(t => t.category === 'Forensic Workflow').map(t => (
                <button
                  key={t.name}
                  type="button"
                  className={`er-table-pill ${selectedTable === t.name ? 'active' : ''}`}
                  onClick={() => setSelectedTable(t.name)}
                >
                  <Database size={13} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>

            <div className="er-category-group">
              <span className="er-category-title">System &amp; Security Models</span>
              {SCHEMA_TABLES.filter(t => t.category === 'System & Security').map(t => (
                <button
                  key={t.name}
                  type="button"
                  className={`er-table-pill ${selectedTable === t.name ? 'active' : ''}`}
                  onClick={() => setSelectedTable(t.name)}
                >
                  <ShieldCheck size={13} />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Right Table Attributes Inspector */}
          <section className="er-table-inspector custom-scrollbar">
            <div className="er-table-header">
              <div className="er-table-meta">
                <span className="er-category-tag">{activeDef.category}</span>
                <h3>Relation: <code>{activeDef.name}</code></h3>
                <p>{activeDef.description}</p>
              </div>

              <div className="er-keys-summary">
                <div className="er-key-row">
                  <Key size={13} className="text-amber" />
                  <span><strong>Primary Key:</strong> <code>{activeDef.primaryKey}</code></span>
                </div>
                {activeDef.foreignKeys.length > 0 && (
                  <div className="er-key-row">
                    <GitFork size={13} className="text-cyan" />
                    <span><strong>Foreign Keys:</strong> {activeDef.foreignKeys.map(fk => <code key={fk}>{fk}</code>)}</span>
                  </div>
                )}
              </div>
            </div>

            <table className="er-attributes-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>SQL Data Type</th>
                  <th>Constraints</th>
                  <th>Forensic Purpose</th>
                </tr>
              </thead>
              <tbody>
                {activeDef.attributes.map(attr => (
                  <tr key={attr.name}>
                    <td>
                      <strong className="attr-name">{attr.name}</strong>
                    </td>
                    <td>
                      <code>{attr.type}</code>
                    </td>
                    <td>
                      <span className="attr-constraints">{attr.constraints}</span>
                    </td>
                    <td className="attr-desc">{attr.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div className="modal-footer">
          <span className="er-doc-link">
            Full mathematical proofs &amp; Mermaid ERD available in <code>docs/ER_diagram.md</code> &amp; <code>docs/data_dictionary.md</code>
          </span>
          <button type="button" className="primary-button" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
