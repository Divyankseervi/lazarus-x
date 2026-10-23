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
    const [activeConceptTab, setActiveConceptTab] = useState<'concept1' | 'concept2' | 'concept3'>('concept1');

    if (!isOpen) return null;

    const downloadSpecification = () => {
        // Download the research disclosure draft
        const element = document.createElement('a');
        const file = new Blob([
            `# LAZARUS-X RESEARCH DISCLOSURE DRAFT (NOT A PATENT FILING)\n\n` +
            `**Case Identifier:** ${caseId || 'N/A'}\n` +
            `**System Status:** ${caseStatus} (case seals are enforced through the application API)\n` +
            `**Current Relational Entropy:** ${entropyBits.toFixed(4)} bits\n` +
            `**Surviving Hypotheses:** ${candidateCount}\n` +
            `**Cryptographic Head:** ${auditHead || 'Genesis'}\n\n` +
            `This package summarizes the research specification draft in research/PATENT_SPECIFICATION_FORMAL.md. It is an engineering disclosure, not a patent filing or legal opinion.\n`
        ], { type: 'text/markdown' });
        element.href = URL.createObjectURL(file);
        element.download = `lazarus-x-research-disclosure-${caseId || 'system'}.md`;
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    };

    return (
        <div className="report-modal-backdrop" role="dialog" aria-modal="true" aria-label="Research Concepts and Technical Disclosure">
            <div className="report-modal-content custom-scrollbar" style={{ maxWidth: '960px' }}>
                <div className="report-modal-header no-print">
                    <div className="report-badge-top">
                        <Scale size={16} className="text-cyan" />
                        <span>RESEARCH DESIGN NOTES (NOT A PATENT FILING)</span>
                    </div>
                    <div className="report-header-actions">
                        <button type="button" className="secondary-button" onClick={downloadSpecification}>
                            <Download size={14} /> Download Research Draft
                        </button>
                        <button type="button" className="icon-button" onClick={onClose} aria-label="Close research disclosure modal">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="patent-dossier-body">
                    <p role="note" className="patent-statutory-notice">
                        Research prototype only — this panel summarizes implemented design concepts. It is not a patent filing, novelty search, prior-art opinion, legal assessment, or finding of patentability.
                    </p>
                    {/* Header Masthead */}
                    <div className="patent-masthead">
                        <div className="patent-masthead-left">
                            <div className="patent-logo-badge">
                                <Award size={26} className="text-cyan" />
                            </div>
                            <div>
                                <h1 style={{ fontSize: '1.25rem', margin: 0, color: '#f8fafc' }}>
                                    LAZARUS-X RESEARCH CONCEPT &amp; TECHNICAL DISCLOSURE
                                </h1>
                                <p style={{ margin: '3px 0 0', color: '#94a3b8', fontSize: '0.82rem' }}>
                                    Research themes: database reconstruction · integrity provenance · uncertainty reduction
                                </p>
                            </div>
                        </div>
                        <div className="patent-masthead-right">
                            <div className="certificate-stamp">
                                <strong>3 TECHNICAL CONCEPTS</strong>
                                <small>Research draft · Not a filing</small>
                            </div>
                        </div>
                    </div>

                    {/* Live Telemetry Bar */}
                    <div className="patent-telemetry-grid">
                        <div className="meta-box">
                            <span className="meta-label">SURVIVING HYPOTHESES (ENGINE)</span>
                            <strong className="meta-value">{candidateCount.toLocaleString()} candidates</strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">SHANNON ENTROPY (CURRENT CANDIDATES)</span>
                            <strong className="meta-value">{entropyBits.toFixed(3)} bits (H)</strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">PROVENANCE HEAD (LEDGER)</span>
                            <strong className="meta-value" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                {auditHead ? `${auditHead.slice(0, 16)}...` : 'Genesis Active'}
                            </strong>
                        </div>
                        <div className="meta-box">
                            <span className="meta-label">CASE STATE (API-ENFORCED)</span>
                            <strong className={`meta-value ${caseStatus === 'SEALED' ? 'text-emerald' : 'text-amber'}`}>
                                {caseStatus === 'SEALED' ? 'SEALED (API-ENFORCED)' : 'ACTIVE INGESTION'}
                            </strong>
                        </div>
                    </div>

                    {/* Concept Tabs */}
                    <div className="patent-tabs-bar">
                        <button
                            type="button"
                            className={`patent-tab ${activeConceptTab === 'concept1' ? 'active' : ''}`}
                            onClick={() => setActiveConceptTab('concept1')}
                        >
                            <Binary size={14} /> Concept 1 · Reconstruction Engine
                        </button>
                        <button
                            type="button"
                            className={`patent-tab ${activeConceptTab === 'concept2' ? 'active' : ''}`}
                            onClick={() => setActiveConceptTab('concept2')}
                        >
                            <Activity size={14} /> Concept 2 · Entropy Guidance
                        </button>
                        <button
                            type="button"
                            className={`patent-tab ${activeConceptTab === 'concept3' ? 'active' : ''}`}
                            onClick={() => setActiveConceptTab('concept3')}
                        >
                            <Shield size={14} /> Concept 3 · Provenance Ledger
                        </button>
                    </div>

                    {/* Concept Details Body */}
                    <div className="patent-claim-content">
                        {activeConceptTab === 'concept1' && (
                            <div className="claim-panel">
                                <div className="claim-header-row">
                                    <h3 style={{ margin: 0, color: '#38bdf8' }}>Concept 1: Bounded Multi-Hypothesis Relational Reconstruction</h3>
                                    <span className="badge-verified"><CheckCircle2 size={12} /> Implemented concept (not legal validation)</span>
                                </div>
                                <div className="claim-prose custom-scrollbar">
                                    <p><b>How the prototype works:</b></p>
                                    <p>One or more hardware processors configured to ingest a plurality of partial forensic evidence fragments arriving out-of-order and unsequenced without database transaction log boundaries; maintain a multi-hypothesis candidate state space; execute an incremental Arc-Consistency (AC-3) constraint propagation process; classify violations into fatal violations (pruned immediately) and resolvable violations (preserved under open-world semantics); and compute heuristic penalties and normalized probability distributions.</p>
                                </div>
                                
                                <div className="prior-art-comparison">
                                    <h4>Implementation Notes:</h4>
                                    <div className="prior-art-grid">
                                        <div className="prior-art-card">
                                            <strong>Candidate-state model</strong>
                                            <p>The engine maintains competing candidate states and ranks them under configured constraints and capacity bounds. Survival of the historical ground truth must be measured on a known test corpus.</p>
                                        </div>
                                        <div className="prior-art-card">
                                            <strong>Evidence arrival order</strong>
                                            <p>Evidence fragments are processed as application inputs, including out-of-order arrival. This does not replace native SQLite WAL/journal recovery.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeConceptTab === 'concept2' && (
                            <div className="claim-panel">
                                <div className="claim-header-row">
                                    <h3 style={{ margin: 0, color: '#a855f7' }}>Concept 2: Entropy-Based Evidence Suggestions</h3>
                                    <span className="badge-verified"><CheckCircle2 size={12} /> Math Model · Research Summary</span>
                                </div>
                                <div className="claim-prose custom-scrollbar">
                                    <p><b>How evidence suggestions are ranked:</b></p>
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

                        {activeConceptTab === 'concept3' && (
                            <div className="claim-panel">
                                <div className="claim-header-row">
                                    <h3 style={{ margin: 0, color: '#34d399' }}>Concept 3: Provenance Ledger &amp; API-Level Sealing</h3>
                                    <span className="badge-verified"><CheckCircle2 size={12} /> Merkle Accumulator · Design Summary</span>
                                </div>
                                <div className="claim-prose custom-scrollbar">
                                    <p><b>Current implementation summary:</b></p>
                                    <p>Evidence ingestion creates application-sequenced events connected through SHA-256 hashes; keyed HMAC commitments and Merkle inclusion proofs are available for selected provenance outputs. The API rejects further evidence submissions after a case is sealed. Sequence order represents application recording order, not independent proof of real-world chronology. SQLite does not prevent a database administrator from altering rows directly; stronger operational protection requires controls outside this application.</p>
                                </div>

                                <div className="prior-art-comparison">
                                    <h4>Implementation Notes:</h4>
                                    <div className="prior-art-grid">
                                        <div className="prior-art-card">
                                            <strong>What the proof shows</strong>
                                            <p>Hash-chain and Merkle verification can detect mismatches against preserved commitments. This prototype does not implement a general zero-knowledge proof and is not database-level immutable.</p>
                                        </div>
                                        <div className="prior-art-card">
                                            <strong>What still needs protection</strong>
                                            <p>The provenance master key, exported manifests, checkpoints and backups need independent access control and off-system preservation. No legal admissibility or novelty assessment is implied.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Statutory Disclaimer */}
                    <div className="patent-statutory-notice">
                        <small>
                            <b>LEGAL BOUNDARY NOTICE:</b> These notes describe the current research prototype. They are not a patent filing, legal opinion, novelty search, or guarantee of correctness. Validate all claims with reproducible experiments before drawing conclusions.
                        </small>
                    </div>
                </div>
            </div>
        </div>
    );
};
