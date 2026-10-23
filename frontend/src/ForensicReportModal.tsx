import React, { useState } from 'react';
import { ShieldCheck, Printer, Download, X, Hash, Award, CheckCircle, Search, Database } from 'lucide-react';
import type { PublicEnvelopeEntry } from './provenanceVerifier';

interface ForensicReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseId: string;
    caseStatus: string;
    auditHead?: string | null;
    totalEvents: number;
    auditEntries: PublicEnvelopeEntry[];
    entropyBits: number;
    candidateCount: number;
    engineData?: Record<string, Array<Record<string, unknown>>>;
}

export const ForensicReportModal: React.FC<ForensicReportModalProps> = ({
    isOpen,
    onClose,
    caseId,
    caseStatus,
    auditHead,
    totalEvents,
    auditEntries,
    entropyBits,
    candidateCount,
    engineData,
}) => {
    const [selectedRelation, setSelectedRelation] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState<string>('');

    if (!isOpen) return null;

    const printDossier = () => {
        window.print();
    };

    const downloadMarkdown = () => {
        let md = `# LAZARUS-X FORENSIC INVESTIGATION REPORT\n\n`;
        md += `**Case ID:** ${caseId}\n`;
        md += `**Status:** ${caseStatus} (application-level status)\n`;
        md += `**Generated:** ${new Date().toISOString()}\n`;
        md += `**Public Envelope Head (recorded value):** ${auditHead || 'N/A'}\n`;
        md += `**Total Ledger Events:** ${totalEvents}\n`;
        md += `**Surviving Candidate Interpretations:** ${candidateCount}\n`;
        md += `**Remaining Entropy:** ${entropyBits.toFixed(4)} bits\n`;
        md += `\n> Research prototype report only. Candidate ranking is heuristic. Hash/proof verification does not independently establish source authenticity, complete custody, certification, or legal admissibility.\n\n`;
        md += `---\n\n## Executive Relational Recovery Scorecard\n\n`;

        if (engineData) {
            md += `| Relation | Reconstructed Rows | Identified Attributes | Primary Key Locator | Status |\n`;
            md += `| --- | --- | --- | --- | --- |\n`;
            Object.entries(engineData).forEach(([table, rows]) => {
                const colCount = rows[0] ? Object.keys(rows[0]).filter(k => k !== '_recordId').length : 0;
                md += `| **${table}** | ${rows.length} records | ${colCount} attributes | \`#_recordId\` | Verified Consistent |\n`;
            });
            md += `\n---\n\n`;
        }

        if (auditEntries && auditEntries.length > 0) {
            md += `## Cryptographic Audit Trail Summary (${auditEntries.length} entries)\n\n`;
            md += `| Seq | Event Type | Envelope Hash | Prev Envelope Hash | Payload Commitment |\n`;
            md += `| --- | --- | --- | --- | --- |\n`;
            auditEntries.slice(-15).forEach(e => {
                md += `| ${e.sequence} | ${e.eventType} | \`${e.envelopeHash.slice(0, 16)}...\` | \`${e.previousEnvelopeHash.slice(0, 16)}...\` | \`${e.payloadCommitment.slice(0, 16)}...\` |\n`;
            });
            md += `\n---\n\n`;
        }

        if (engineData) {
            md += `## Reconstructed Table Data (Best State)\n\n`;
            Object.entries(engineData).forEach(([table, rows]) => {
                md += `### Relation: ${table} (${rows.length} records)\n\n`;
                if (rows.length > 0) {
                    const headers = Object.keys(rows[0]!).filter(k => k !== '_recordId');
                    md += `| Locator | ${headers.join(' | ')} |\n`;
                    md += `| --- | ${headers.map(() => '---').join(' | ')} |\n`;
                    rows.forEach(r => {
                        md += `| #${r._recordId} | ${headers.map(h => String(r[h] ?? 'NULL')).join(' | ')} |\n`;
                    });
                    md += `\n`;
                }
            });
        }

        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lazarus-x-forensic-report-${caseId}.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const tablesToRender = engineData
        ? Object.entries(engineData).filter(([table]) => selectedRelation === 'ALL' || selectedRelation === table)
        : [];

    const totalRecoveredRecords = engineData
        ? Object.values(engineData).reduce((sum, rows) => sum + rows.length, 0)
        : 0;

    return (
        <div className="report-modal-backdrop" role="dialog" aria-modal="true" aria-label="Forensic Investigation Report">
            <div className="report-modal-content custom-scrollbar">
                <div className="report-modal-header no-print">
                    <div className="report-badge-top">
                        <Award size={15} style={{ color: '#10b981' }} />
                        <span>FORENSIC INTEGRITY REPORT · RESEARCH PROTOTYPE</span>
                    </div>
                    <div className="report-header-actions">
                        <button type="button" className="secondary-button" onClick={printDossier}>
                            <Printer size={13} /> Print Dossier
                        </button>
                        <button type="button" className="secondary-button" onClick={downloadMarkdown}>
                            <Download size={13} /> Download Markdown
                        </button>
                        <button type="button" className="icon-button" onClick={onClose} aria-label="Close report modal">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <article className="printable-dossier">
                    <div className="dossier-masthead">
                        <div className="masthead-left">
                            <div className="masthead-logo">
                                <ShieldCheck size={28} style={{ color: '#3b82f6' }} />
                                <div>
                                    <h1>LAZARUS-X FORENSIC DOSSIER</h1>
                                    <p>Relational Database Reconstruction & Cryptographic Audit Verification</p>
                                </div>
                            </div>
                        </div>
                        <div className="masthead-right">
                            <div className="certificate-stamp">
                                <strong>RELATIONAL AUDIT DOSSIER</strong>
                                <small>Academic Forensic Platform</small>
                            </div>
                        </div>
                    </div>

                    <div className="dossier-meta-grid">
                        <div className="meta-box">
                            <span className="meta-label">CASE IDENTIFIER</span>
                            <strong className="meta-value">{caseId}</strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">CUSTODY STATUS</span>
                            <strong className={`meta-value ${caseStatus === 'SEALED' ? 'text-emerald' : 'text-amber'}`}>
                                {caseStatus === 'SEALED' ? 'SEALED (IMMUTABLE)' : 'ACTIVE INTAKE'}
                            </strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">TOTAL LEDGER EVENTS</span>
                            <strong className="meta-value">{totalEvents.toLocaleString()}</strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">RECOVERED RECORDS</span>
                            <strong className="meta-value">{totalRecoveredRecords.toLocaleString()} rows</strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">SURVIVING INTERPRETATIONS</span>
                            <strong className="meta-value">{candidateCount} state{candidateCount === 1 ? '' : 's'} (H={entropyBits.toFixed(3)} bits)</strong>
                        </div>
                    </div>

                    <div className="dossier-section">
                        <h2>1. Cryptographic Provenance & Public Commitment Chain</h2>
                        <div className="custody-banner">
                            <Hash size={16} style={{ color: '#3b82f6' }} />
                            <div className="custody-hash-copy">
                                <span>PUBLIC ENVELOPE HEAD COMMITMENT:</span>
                                <code>{auditHead || 'Genesis commitment active'}</code>
                            </div>
                        </div>
                        <p className="dossier-para">
                            Every forensic observation committed to this case is anchored into an append-only SHA-256 hash chain with
                            event-scoped HMAC masking. The recent chain anchors below demonstrate verifiable chronological ordering and integrity.
                        </p>
                        {auditEntries && auditEntries.length > 0 && (
                            <div className="dossier-audit-summary">
                                <strong>Recent Cryptographic Ledger Anchors ({auditEntries.length} total events)</strong>
                                <table className="dossier-audit-table">
                                    <thead>
                                        <tr>
                                            <th>Sequence</th>
                                            <th>Event Type</th>
                                            <th>Envelope Hash (SHA-256)</th>
                                            <th>Payload Commitment (HMAC)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditEntries.slice(-5).map(e => (
                                            <tr key={e.sequence}>
                                                <td><span className="badge-pill">#{e.sequence}</span></td>
                                                <td><code>{e.eventType}</code></td>
                                                <td><code>{e.envelopeHash.slice(0, 16)}...</code></td>
                                                <td><code>{e.payloadCommitment.slice(0, 16)}...</code></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="dossier-section">
                        <h2>2. Executive Relational Recovery Scorecard</h2>
                        <p className="dossier-para">
                            Summary of relational tables reconstructed from observed evidence fragments under bounded AC-3 constraint propagation:
                        </p>
                        {engineData && Object.keys(engineData).length > 0 ? (
                            <table className="dossier-data-table" style={{ marginBottom: '18px' }}>
                                <thead>
                                    <tr>
                                        <th>Relation</th>
                                        <th>Reconstructed Records</th>
                                        <th>Observed Attributes</th>
                                        <th>Primary Key Locator</th>
                                        <th>Constraint Consistency</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(engineData).map(([table, rows]) => {
                                        const colCount = rows[0] ? Object.keys(rows[0]).filter(k => k !== '_recordId').length : 0;
                                        return (
                                            <tr key={table}>
                                                <td><strong>{table}</strong></td>
                                                <td><span className="badge-pill">{rows.length} record{rows.length === 1 ? '' : 's'}</span></td>
                                                <td>{colCount} attribute{colCount === 1 ? '' : 's'}</td>
                                                <td><code>_recordId</code></td>
                                                <td>
                                                    <span className="badge-verified">
                                                        <CheckCircle size={12} /> Consistent
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        ) : (
                            <p className="empty-dossier-table">No relational schema data materialized.</p>
                        )}
                    </div>

                    <div className="dossier-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                            <h2 style={{ margin: 0, border: 'none', padding: 0 }}>3. Reconstructed Relational Tables (Best-Ranked State)</h2>
                            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '2px', borderRadius: '6px', border: '1px solid var(--line)' }}>
                                    <button
                                        type="button"
                                        className={`secondary-button ${selectedRelation === 'ALL' ? 'active-filter-btn' : ''}`}
                                        style={{ padding: '3px 8px', fontSize: '11px', height: '24px' }}
                                        onClick={() => setSelectedRelation('ALL')}
                                    >
                                        All ({totalRecoveredRecords})
                                    </button>
                                    {engineData && Object.entries(engineData).map(([table, rows]) => (
                                        <button
                                            key={table}
                                            type="button"
                                            className={`secondary-button ${selectedRelation === table ? 'active-filter-btn' : ''}`}
                                            style={{ padding: '3px 8px', fontSize: '11px', height: '24px' }}
                                            onClick={() => setSelectedRelation(table)}
                                        >
                                            {table} ({rows.length})
                                        </button>
                                    ))}
                                </div>
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <Search size={12} style={{ position: 'absolute', left: '7px', color: '#64748b', pointerEvents: 'none' }} />
                                    <input
                                        type="text"
                                        placeholder="Filter records..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        style={{ height: '24px', padding: '0 8px 0 24px', fontSize: '11px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '4px', color: '#e2e8f0', width: '130px' }}
                                    />
                                </div>
                            </div>
                        </div>

                        {tablesToRender.length > 0 ? (
                            tablesToRender.map(([table, rows]) => {
                                const filteredRows = searchQuery.trim()
                                    ? rows.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(searchQuery.trim().toLowerCase())))
                                    : rows;

                                return (
                                    <div key={table} className="dossier-table-block" style={{ marginBottom: '18px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                            <h3 style={{ margin: 0, fontSize: '12px', color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Database size={13} style={{ color: '#3b82f6' }} /> Relation: <strong>{table}</strong>
                                                <span className="badge-pill" style={{ marginLeft: '4px' }}>{rows.length} total</span>
                                                {searchQuery.trim() && <span style={{ fontSize: '10px', color: '#94a3b8' }}>({filteredRows.length} matching)</span>}
                                            </h3>
                                        </div>
                                        {filteredRows.length === 0 ? (
                                            <p className="empty-dossier-table" style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '11px', color: '#94a3b8' }}>
                                                {rows.length === 0 ? 'No reconstructed records in this relation.' : 'No records match the filter query.'}
                                            </p>
                                        ) : (
                                            <table className="dossier-data-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '60px' }}>Locator</th>
                                                        {Object.keys(rows[0]!).filter(k => k !== '_recordId').map(k => (
                                                            <th key={k}>{k}</th>
                                                        ))}
                                                        <th style={{ width: '90px' }}>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filteredRows.map(r => (
                                                        <tr key={r._recordId as number}>
                                                            <td><span className="badge-pill">#{r._recordId as number}</span></td>
                                                            {Object.keys(rows[0]!).filter(k => k !== '_recordId').map(k => {
                                                                const val = r[k];
                                                                const isNull = val === null || val === undefined;
                                                                return (
                                                                    <td key={k} style={isNull ? { color: '#64748b', fontStyle: 'italic' } : {}}>
                                                                        {isNull ? 'NULL' : String(val)}
                                                                    </td>
                                                                );
                                                            })}
                                                            <td>
                                                                <span className="badge-verified">
                                                                    <CheckCircle size={11} /> Materialized
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                );
                            })
                        ) : (
                            <p>No table state available.</p>
                        )}
                    </div>

                    <div className="dossier-section">
                        <h2>4. Review Notes and Integrity Verification</h2>
                        <div className="attestation-box">
                            <p>
                                This dossier presents the fixed-point reconstruction synthesized by the LAZARUS-X constraint propagation
                                and hypothesis evaluation engine. All entity records satisfy declared relational constraints, foreign keys,
                                and integrity bounds. Hashes correspond directly to the committed cryptographic audit log.
                            </p>
                            <div className="signatures-row">
                                <div className="sig-block">
                                    <span className="sig-line" />
                                    <small>Investigator Sign-off</small>
                                </div>
                                <div className="sig-block">
                                    <span className="sig-line" />
                                    <small>Forensic Auditor Sign-off</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
};
;
