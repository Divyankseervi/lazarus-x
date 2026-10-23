import React from 'react';
import { ShieldCheck, Printer, Download, X, Hash, Award, CheckCircle } from 'lucide-react';
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
        md += `---\n\n## Reconstructed Table Data (Best State)\n\n`;

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

    return (
        <div className="report-modal-backdrop" role="dialog" aria-modal="true" aria-label="Forensic Investigation Report">
            <div className="report-modal-content custom-scrollbar">
                <div className="report-modal-header no-print">
                    <div className="report-badge-top">
                        <Award size={16} className="text-emerald" />
                        <span>FORENSIC INTEGRITY REPORT · RESEARCH PROTOTYPE</span>
                    </div>
                    <div className="report-header-actions">
                        <button type="button" className="secondary-button" onClick={printDossier}>
                            <Printer size={14} /> Print Dossier
                        </button>
                        <button type="button" className="secondary-button" onClick={downloadMarkdown}>
                            <Download size={14} /> Download Markdown
                        </button>
                        <button type="button" className="icon-button" onClick={onClose} aria-label="Close report modal">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <article className="printable-dossier">
                    <div className="dossier-masthead">
                        <div className="masthead-left">
                            <div className="masthead-logo">
                                <ShieldCheck size={28} className="text-cyan" />
                                <div>
                                    <h1>LAZARUS-X FORENSIC DOSSIER</h1>
                                    <p>Automated Database Reconstruction & Integrity Audit</p>
                                </div>
                            </div>
                        </div>
                        <div className="masthead-right">
                            <div className="certificate-stamp">
                                <strong>GENERATED REPORT</strong>
                                <small>Not independently certified</small>
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
                                {caseStatus === 'SEALED' ? 'SEALED (API-ENFORCED)' : 'ACTIVE INGESTION'}
                            </strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">TOTAL LEDGER EVENTS</span>
                            <strong className="meta-value">{totalEvents.toLocaleString()}</strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">ENTROPY / AMBIGUITY</span>
                            <strong className="meta-value">{entropyBits.toFixed(3)} bits ({candidateCount} candidate{candidateCount === 1 ? '' : 's'})</strong>
                        </div>
                    </div>

                    <div className="dossier-section">
                        <h2>1. Cryptographic Provenance Summary</h2>
                        <div className="custody-banner">
                            <Hash size={16} className="text-cyan" />
                            <div className="custody-hash-copy">
                                <span>PUBLIC ENVELOPE HEAD COMMITMENT:</span>
                                <code>{auditHead || 'Genesis commitment active'}</code>
                            </div>
                        </div>
                        <p className="dossier-para">
                            The ledger summary below is generated from records stored by this application. Where proofs are available,
                            verify them independently against the exported proof data. This report does not independently authenticate
                            the original source, establish a complete external chain of custody, or determine legal admissibility.
                        </p>
                        {auditEntries && auditEntries.length > 0 && (
                            <div className="dossier-audit-summary">
                                <strong>Recent Cryptographic Ledger Anchors ({auditEntries.length} total)</strong>
                                <table className="dossier-audit-table">
                                    <thead>
                                        <tr>
                                            <th>Seq</th>
                                            <th>Event Type</th>
                                            <th>Envelope Hash</th>
                                            <th>Payload Commitment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {auditEntries.slice(-5).map(e => (
                                            <tr key={e.sequence}>
                                                <td>#{e.sequence}</td>
                                                <td><code>{e.eventType}</code></td>
                                                <td><code>{e.envelopeHash.slice(0, 12)}...</code></td>
                                                <td><code>{e.payloadCommitment.slice(0, 12)}...</code></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    <div className="dossier-section">
                        <h2>2. Best-Ranked Reconstructed State (Heuristic)</h2>
                        {engineData ? (
                            Object.entries(engineData).map(([table, rows]) => (
                                <div key={table} className="dossier-table-block">
                                    <h3>Relation: {table} ({rows.length} rows)</h3>
                                    {rows.length === 0 ? (
                                        <p className="empty-dossier-table">No reconstructed records in this relation.</p>
                                    ) : (
                                        <table className="dossier-data-table">
                                            <thead>
                                                <tr>
                                                    <th>#</th>
                                                    {Object.keys(rows[0]!).filter(k => k !== '_recordId').map(k => (
                                                        <th key={k}>{k}</th>
                                                    ))}
                                                    <th>Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rows.map(r => (
                                                    <tr key={r._recordId as number}>
                                                        <td>#{r._recordId as number}</td>
                                                        {Object.keys(rows[0]!).filter(k => k !== '_recordId').map(k => (
                                                            <td key={k}>{String(r[k] ?? 'NULL')}</td>
                                                        ))}
                                                        <td>
                                                            <span className="badge-verified">
                                                                <CheckCircle size={11} /> Included
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p>No table state loaded.</p>
                        )}
                    </div>

                    <div className="dossier-section">
                        <h2>3. Review Notes and Limitations</h2>
                        <div className="attestation-box">
                            <p>
                                This report summarizes output from the LAZARUS-X research prototype's bounded constraint-propagation engine,
                                fuzzy string comparison and provenance components. Candidate rankings are heuristic, not calibrated probabilities.
                                A hash match proves byte equality against the referenced digest only; it does not prove source authenticity or
                                completeness. Application-level sealing blocks evidence writes through the application API, not direct database changes.
                                This document is not an independent forensic examination, certification or legal opinion.
                            </p>
                            <div className="signatures-row">
                                <div className="sig-block">
                                    <span className="sig-line" />
                                    <small>Prepared by (optional)</small>
                                </div>
                                <div className="sig-block">
                                    <span className="sig-line" />
                                    <small>Reviewed by (optional)</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </article>
            </div>
        </div>
    );
};
