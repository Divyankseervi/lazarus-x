import React, { useState } from 'react';
import { Split, CheckCircle2, AlertCircle, ArrowRight, Filter } from 'lucide-react';

interface ValueDistribution {
    value: unknown;
    probability: number;
    candidateCount: number;
}

export interface DisputedFieldRecommendation {
    table: string;
    recordId: number;
    field: string;
    expectedInformationGain: number;
    /** The API calls these candidateValues; predictedValues is retained for old responses. */
    candidateValues?: ValueDistribution[];
    predictedValues?: ValueDistribution[];
    explanation?: string;
}

interface CandidateDiffMatrixProps {
    tables: readonly string[];
    selectedTable: string;
    onSelectTable: (table: string) => void;
    currentData?: Record<string, Array<Record<string, unknown>>>;
    disputedFields: DisputedFieldRecommendation[];
    candidateCount: number;
    onSeedEvidence: (table: string, recordId: number, field: string) => void;
}

export const CandidateDiffMatrix: React.FC<CandidateDiffMatrixProps> = ({
    tables,
    selectedTable,
    onSelectTable,
    currentData,
    disputedFields,
    candidateCount,
    onSeedEvidence,
}) => {
    const [filterDisputedOnly, setFilterDisputedOnly] = useState(false);

    const rows = currentData?.[selectedTable] || [];

    // Map disputed attributes for fast lookup: key = "${recordId}:${field}"
    const disputedMap = new Map<string, DisputedFieldRecommendation>();
    disputedFields.forEach(df => {
        if (df.table === selectedTable) {
            disputedMap.set(`${df.recordId}:${df.field}`, df);
        }
    });

    // Extract all unique attributes for the current table
    const attributes = Array.from(
        new Set(
            rows.flatMap(r => Object.keys(r).filter(k => k !== '_recordId'))
        )
    );

    const disputedInTableCount = Array.from(disputedMap.keys()).length;

    return (
        <div className="diff-matrix-container" role="region" aria-label="Candidate Field Inspection">
            <div className="diff-matrix-header">
                <div className="diff-matrix-title">
                    <Split size={16} className="text-cyan" />
                        <strong>Compare different answers <span className="legacy-term">(Candidate Conflict &amp; Field Inspection)</span></strong>
                    <span className="candidate-badge">
                            {candidateCount} possible answer{candidateCount === 1 ? '' : 's'}
                    </span>
                </div>

                <div className="diff-matrix-controls">
                    <div className="table-tabs">
                        {tables.map(t => (
                            <button
                                key={t}
                                type="button"
                                className={`table-tab ${selectedTable === t ? 'active' : ''}`}
                                onClick={() => onSelectTable(t)}
                            >
                                {t}
                                {disputedFields.some(df => df.table === t) && (
                                    <span className="tab-conflict-dot" title="Has conflicting interpretations" />
                                )}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className={`filter-toggle ${filterDisputedOnly ? 'active' : ''}`}
                        onClick={() => setFilterDisputedOnly(!filterDisputedOnly)}
                    >
                        <Filter size={12} />
                        Differences only ({disputedInTableCount})
                    </button>
                </div>
            </div>

            <div className="matrix-stats-bar">
                <span>Record type: <b>{selectedTable}</b> ({rows.length} records)</span>
                <span className="stats-divider">•</span>
                <span className={disputedInTableCount > 0 ? 'stat-conflict' : 'stat-consensus'}>
                    {disputedInTableCount > 0
                        ? <><AlertCircle size={12} className="text-amber" /> {disputedInTableCount} detail{disputedInTableCount === 1 ? '' : 's'} still need checking</>
                        : <><CheckCircle2 size={12} className="text-emerald" /> No differences found here</>}
                </span>
                <span className="stats-divider">•</span>
                <span className="stat-conflict">
                    <AlertCircle size={12} className="text-amber" /> {disputedInTableCount} difference{disputedInTableCount === 1 ? '' : 's'}
                </span>
            </div>

            <div className="diff-table-wrapper custom-scrollbar">
                <table className="diff-matrix-table">
                    <thead>
                        <tr>
                            <th className="locator-col">Locator</th>
                            {attributes.map(attr => (
                                <th key={attr} className="attr-col">
                                    {attr}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => {
                            const recId = Number(row._recordId);
                            // If filterDisputedOnly, check if this row has any disputed attributes
                            const rowHasDispute = attributes.some(attr => disputedMap.has(`${recId}:${attr}`));
                            if (filterDisputedOnly && !rowHasDispute) return null;

                            return (
                                <tr key={recId} className={rowHasDispute ? 'row-has-conflict' : ''}>
                                    <td className="locator-cell">
                                        <span className="record-badge">#{String(recId).padStart(2, '0')}</span>
                                    </td>
                                    {attributes.map(attr => {
                                        const dispute = disputedMap.get(`${recId}:${attr}`);
                                        const value = row[attr];
                                        const displayVal = value !== undefined && value !== null ? String(value) : '—';

                                        if (dispute) {
                                            return (
                                                <td key={attr} className="cell-disputed">
                                                    <div className="dispute-card">
                                                        <div className="dispute-top">
                                                            <span className="dispute-label">
                                                                <AlertCircle size={11} /> Needs checking
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="seed-inquiry-btn"
                                                                title="Ask for another source record about this detail"
                                                                onClick={() => onSeedEvidence(selectedTable, recId, attr)}
                                                            >
                                                                Check another source <ArrowRight size={10} />
                                                            </button>
                                                        </div>
                                                        <div className="dispute-values">
                                                            {(dispute.candidateValues ?? dispute.predictedValues)?.length ? (
                                                                (dispute.candidateValues ?? dispute.predictedValues ?? []).map((pv, idx) => (
                                                                    <div key={idx} className="pred-val-row">
                                                                        <span className="val-text">"{String(pv.value)}"</span>
                                                                        <div className="val-bar-bg">
                                                                            <div
                                                                                className="val-bar-fill"
                                                                                style={{ width: `${Math.round(pv.probability * 100)}%` }}
                                                                            />
                                                                        </div>
                                                                        <span className="val-pct" title="Normalized heuristic candidate weight, not a calibrated probability">{Math.round(pv.probability * 100)}%*</span>
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <div className="pred-val-row">
                                                                    <span className="val-text">No candidate values were returned. Current view: "{displayVal}"</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <p className="dispute-explanation">
                                                            <strong>Why this is disputed:</strong> the surviving reconstructions agree on the record, but disagree on this field.
                                                            <br />
                                                            <strong>What resolves it:</strong> add one independent observation for this exact record and field.
                                                        </p>
                                                    </div>
                                                </td>
                                            );
                                        }

                                        return (
                                            <td key={attr} className="cell-consensus">
                                                <div className="consensus-wrapper">
                                                    <span className="cell-value">{displayVal}</span>
                                                    <span className="consensus-tag" title="This cell is not currently surfaced as disputed. It is not proof that all candidate states agree.">
                                                        <CheckCircle2 size={10} />
                                                    </span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={attributes.length + 1} className="empty-matrix-cell">
                                    No observed records in relation <b>{selectedTable}</b>.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
