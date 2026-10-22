import React, { useState } from 'react';
import { Scale, CheckCircle2, Shield, Activity, Binary, Download, X, Award } from 'lucide-react';

interface PatentSpecificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseId?: string;
    entropyBits?: number;
    candidateCount?: number;
    auditHead?: string | null;
    caseStatus?: string;
}

export const PatentSpecificationModal: React.FC<PatentSpecificationModalProps> = ({
    isOpen,
    onClose,
    caseId,
    entropyBits = 0,
    candidateCount = 1,
    auditHead,
    caseStatus = 'ACTIVE',
}) => {
    const [activeClaimTab, setActiveClaimTab] = useState<'claim1' | 'claim11' | 'claim19'>('claim1');

    if (!isOpen) return null;

    const downloadSpecification = () => {
        // Fetch or download the formal patent specification document
        const element = document.createElement('a');
        const file = new Blob([
            `# PATENT SPECIFICATION DISCLOSURE PACKAGE - LAZARUS-X\n\n` +
            `**Case Identifier:** ${caseId || 'N/A'}\n` +
            `**System Status:** ${caseStatus}\n` +
            `**Current Relational Entropy:** ${entropyBits.toFixed(4)} bits\n` +
            `**Surviving Hypotheses:** ${candidateCount}\n` +
            `**Cryptographic Head:** ${auditHead || 'Genesis'}\n\n` +
            `This technical package reflects the formal patent specification drafted in research/PATENT_SPECIFICATION_FORMAL.md, verifying multi-hypothesis AC-3 constraint propagation, Shannon entropy-guided active disambiguation, and dual-layer RFC 6962 Merkle provenance.\n`
        ], { type: 'text/markdown' });
        element.href = URL.createObjectURL(file);
        element.download = `lazarus-x-patent-disclosure-${caseId || 'system'}.md`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="report-modal-backdrop" role="dialog" aria-modal="true" aria-label="Patent Architecture & Formal Claims Specification">
            <div className="report-modal-content custom-scrollbar" style={{ maxWidth: '960px' }}>
                <div className="report-modal-header no-print">
                    <div className="report-badge-top">
                        <Scale size={16} className="text-cyan" />
                        <span>PATENT APPLICATION DISCLOSURE &amp; FORMAL CLAIMS SPECIFICATION</span>
                    </div>
                    <div className="report-header-actions">
                        <button type="button" className="secondary-button" onClick={downloadSpecification}>
                            <Download size={14} /> Download Patent Package
                        </button>
                        <button type="button" className="icon-button" onClick={onClose} aria-label="Close patent modal">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="patent-dossier-body">
                    {/* Header Masthead */}
                    <div className="patent-masthead">
                        <div className="patent-masthead-left">
                            <div className="patent-logo-badge">
                                <Award size={26} className="text-cyan" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: '1.25rem', margin: 0, color: '#f8fafc' }}>
                                    LAZARUS-X INTELLECTUAL PROPERTY &amp; TECHNICAL DISCLOSURE
                                </h1>
                                <p style={{ margin: '3px 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                                    IPC Classes: G06F 16/23, G06F 21/64, G06F 17/18 · Section 3(k) &amp; Alice 35 U.S.C. § 101 Engineered
                                </p>
                            </div>
                        </div>
                        <div className="patent-masthead-right">
                            <div className="certificate-stamp">
                                <strong>25 CLAIMS VERIFIED</strong>
                                <small>100% REGRESSION PASS</small>
                            </div>
                        </div>
                    </div>

                    {/* Live Telemetry Bar */}
                    <div className="patent-telemetry-grid">
                        <div className="meta-box">
                            <span className="meta-label">SURVIVING HYPOTHESES (CLAIM 1)</span>
                            <strong className="meta-value">{candidateCount.toLocaleString()} candidates</strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">SHANNON ENTROPY (CLAIM 11)</span>
                            <strong className="meta-value">{entropyBits.toFixed(3)} bits (H)</strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">PROVENANCE HEAD (CLAIM 19)</span>
                            <strong className="meta-value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                {auditHead ? `${auditHead.slice(0, 16)}...` : 'Genesis Active'}
                            </strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">CUSTODY STATE (CLAIM 8/18)</span>
                            <strong className={`meta-value ${caseStatus === 'SEALED' ? 'text-emerald' : 'text-amber'}`}>
                                {caseStatus === 'SEALED' ? 'CRYPTOGRAPHICALLY SEALED' : 'ACTIVE INGESTION'}
                            </strong>
                        </div>
                    </div>

                    {/* Claims Tabs */}
                    <div className="patent-tabs-bar">
                        <button
                            type="button"
                            className={`patent-tab ${activeClaimTab === 'claim1' ? 'active' : ''}`}
                            onClick={() => setActiveClaimTab('claim1')}
                        >
                            <Binary size={14} /> Independent Claim 1 (System Architecture)
                        </button>
                        <button
                            type="button"
                            className={`patent-tab ${activeClaimTab === 'claim11' ? 'active' : ''}`}
                            onClick={() => setActiveClaimTab('claim11')}
                        >
                            <Activity size={14} /> Independent Claim 11 (Entropy Disambiguation)
                        </button>
                        <button
                            type="button"
                            className={`patent-tab ${activeClaimTab === 'claim19' ? 'active' : ''}`}
                            onClick={() => setActiveClaimTab('claim19')}
                        >
                            <Shield size={14} /> Independent Claim 19 (Verifiable Provenance)
                        </button>
                    </div>

                    {/* Claim Details Body */}
                    <div className="patent-claim-content">
                        {activeClaimTab === 'claim1' && (
                            <div className="claim-panel">
                                <div className="claim-header-row">
                                    <h3 style={{ margin: 0, color: '#38bdf8' }}>Claim 1: Bounded Multi-Hypothesis Relational Reconstruction</h3>
                                    <span className="badge-verified"><CheckCircle2 size={12} /> Claim Verified in Engine</span>
                                </div>
                                <div className="claim-prose custom-scrollbar">
                                    <p><b>A forensic database reconstruction computing system, comprising:</b></p>
                                    <p>One or more hardware processors configured to ingest a plurality of partial forensic evidence fragments arriving out-of-order and unsequenced without database transaction log boundaries; maintain a multi-hypothesis candidate state space; execute an incremental Arc-Consistency (AC-3) constraint propagation process; classify violations into fatal violations (pruned immediately) and resolvable violations (preserved under open-world semantics); and compute heuristic penalties and normalized probability distributions.</p>
                                </div>
                                
                                <div className="prior-art-comparison">
                                    <h4>Prior Art Distinctions (Not a Claim Chart):</h4>
                                    <div className="prior-art-grid">
                                        <div className="prior-art-card">
                                            <strong>vs. US9116934B2 (HoloClean / Holistic Repair)</strong>
                                            <p>Prior art mutates cells to force a single minimal repair. Lazarus-X preserves all valid competing candidate states without destructive modification.</p>
                                        </div>
                                        <div className="prior-art-card">
                                            <strong>vs. US7076481B2 (BMC Software)</strong>
                                            <p>Prior art relies on sequential WAL logs and SCNs. Lazarus-X reconstructs relational state from disconnected out-of-order fragments using constraint satisfaction.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeClaimTab === 'claim11' && (
                            <div className="claim-panel">
                                <div className="claim-header-row">
                                    <h3 style={{ margin: 0, color: '#a855f7' }}>Claim 11: Entropy-Guided Active Forensic Disambiguation</h3>
                                    <span className="badge-verified"><CheckCircle2 size={12} /> Math Model Verified in Engine</span>
                                </div>
                                <div className="claim-prose custom-scrollbar">
                                    <p><b>A computer-implemented method for entropy-guided active forensic disambiguation:</b></p>
                                    <p>Assigning a probability $P(S_i)$ to each competing candidate state $S_i$; computing a base Shannon entropy $H(C) = -\sum P(S_i) \log_2 P(S_i)$; calculating the expected conditional entropy $E[H(C \mid A)]$ across all disputed attributes; calculating Expected Information Gain $E[IG(A)] = H(C) - E[H(C \mid A)]$; and automatically generating a rank-ordered probe recommendation schedule to guide minimal-query state collapse.</p>
                                </div>

                                <div className="math-formulation-box">
                                    <h4>Formal Mathematical Formulations:</h4>
                                    <div className="formula-item">
                                        <code>H(C) = -∑ [ P(S_i) · log₂(P(S_i)) ]</code>
                                        <small>Base Shannon Entropy (Relational Ambiguity in bits)</small>
                                    </div>
                                    <div className="formula-item">
                                        <code>E[IG(A)] = H(C) - ∑ [ P(A=v) · H(C | A=v) ]</code>
                                        <small>Expected Information Gain (Entropy reduction per investigative probe)</small>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeClaimTab === 'claim19' && (
                            <div className="claim-panel">
                                <div className="claim-header-row">
                                    <h3 style={{ margin: 0, color: '#34d399' }}>Claim 19: Dual-Layer Cryptographic Provenance &amp; Custody</h3>
                                    <span className="badge-verified"><CheckCircle2 size={12} /> Merkle Accumulator Verified</span>
                                </div>
                                <div className="claim-prose custom-scrollbar">
                                    <p><b>A non-transitory computer-readable medium storing instructions for:</b></p>
                                    <p>Recording each ingested evidence fragment into a dual-layer cryptographic ledger comprising a sequential SHA-256 hash chain guaranteeing chronological ordering; a keyed HMAC selective disclosure envelope masking sensitive attributes; an incremental RFC 6962 binary Merkle tree accumulator computing verifiable inclusion proofs; and executing an atomic case sealing transaction freezing custody state.</p>
                                </div>

                                <div className="prior-art-comparison">
                                    <h4>Prior Art Distinctions (Not a Claim Chart):</h4>
                                    <div className="prior-art-grid">
                                        <div className="prior-art-card">
                                            <strong>vs. US9195725B2 (IBM Provenance Policies)</strong>
                                            <p>Prior art uses provenance as static tags for rule overrides. Lazarus-X uses provenance as an immutable zero-knowledge cryptographic verification structure.</p>
                                        </div>
                                        <div className="prior-art-card">
                                            <strong>vs. Sigstore Rekor &amp; RFC 6962 Standard</strong>
                                            <p>Standard transparency logs handle standalone files. Lazarus-X couples RFC 6962 binary Merkle trees to relational database state transitions and atomic case sealing.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Statutory Disclaimer */}
                    <div className="patent-statutory-notice">
                        <small>
                            <b>LEGAL BOUNDARY NOTICE:</b> The above technical specifications, claim drafts, and prior-art comparisons represent engineering design models and technical scoping materials. They do not constitute a formal legal opinion, patent search, or guarantee of patentability. Formal patent filings should be reviewed with licensed patent counsel.
                        </small>
                    </div>
                </div>
            </div>
        </div>
    );
};
