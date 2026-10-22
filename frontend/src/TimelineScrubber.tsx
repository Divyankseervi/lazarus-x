import React, { useState, useMemo } from 'react';
import { Search, Shield, Clock, ArrowDownToLine, Zap } from 'lucide-react';
import type { PublicEnvelopeEntry } from './provenanceVerifier';

interface TimelineScrubberProps {
    entries: PublicEnvelopeEntry[];
    onInspectProof?: (sequence: number) => void;
    totalEvents?: number;
    auditHead?: string | null;
}

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
    entries,
    onInspectProof,
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | 'EVIDENCE_ACCEPTED' | 'FUZZY_CORRECTION'>('ALL');

    const filtered = useMemo(() => {
        return entries.filter(e => {
            if (typeFilter !== 'ALL' && e.eventType !== typeFilter) return false;
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const seq = String(e.sequence);
                const hash = e.envelopeHash.toLowerCase();
                const actor = e.actorCommitment.toLowerCase();
                if (!seq.includes(term) && !hash.includes(term) && !actor.includes(term)) {
                    return false;
                }
            }
            return true;
        });
    }, [entries, typeFilter, searchTerm]);

    const shortHash = (h: string) => `${h.slice(0, 6)}...${h.slice(-6)}`;

    return (
        <div className="timeline-scrubber" role="region" aria-label="Forensic Evidence Timeline Scrubber">
            <div className="scrubber-controls">
                <div className="scrubber-search">
                    <Search size={14} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search timeline by sequence or commitment hash..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        aria-label="Filter events by search term"
                    />
                    {searchTerm && (
                        <button className="clear-btn" onClick={() => setSearchTerm('')}>x</button>
                    )}
                </div>

                <div className="scrubber-filters">
                    <button
                        className={`filter-pill ${typeFilter === 'ALL' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('ALL')}
                    >
                        All ({entries.length})
                    </button>
                    <button
                        className={`filter-pill ${typeFilter === 'EVIDENCE_ACCEPTED' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('EVIDENCE_ACCEPTED')}
                    >
                        Evidence ({entries.filter(e => e.eventType === 'EVIDENCE_ACCEPTED').length})
                    </button>
                    <button
                        className={`filter-pill ${typeFilter === 'FUZZY_CORRECTION' ? 'active' : ''}`}
                        onClick={() => setTypeFilter('FUZZY_CORRECTION')}
                    >
                        Corrections ({entries.filter(e => e.eventType === 'FUZZY_CORRECTION').length})
                    </button>
                </div>
            </div>

            <div className="scrubber-event-stream custom-scrollbar">
                {filtered.map(entry => (
                    <div key={`${entry.sequence}-${entry.envelopeHash}`} className="scrubber-row">
                        <div className="scrubber-seq-col">
                            <span className="seq-badge">#{String(entry.sequence).padStart(5, '0')}</span>
                            <div className="seq-line" />
                        </div>

                        <div className="scrubber-body-col">
                            <div className="scrubber-row-top">
                                <span className={`event-type-badge ${entry.eventType === 'FUZZY_CORRECTION' ? 'badge-fuzzy' : 'badge-evidence'}`}>
                                    {entry.eventType === 'FUZZY_CORRECTION' ? <Zap size={12} /> : <Shield size={12} />}
                                    {entry.eventType === 'FUZZY_CORRECTION' ? 'Fuzzy Correction' : 'Evidence Accepted'}
                                </span>
                                <span className="scrubber-time">
                                    <Clock size={11} /> {new Date(entry.receivedAt).toLocaleTimeString()}
                                </span>
                            </div>

                            <div className="scrubber-hashes">
                                <span className="hash-tag" title={`Envelope: ${entry.envelopeHash}`}>
                                    Env: <code>{shortHash(entry.envelopeHash)}</code>
                                </span>
                                <span className="hash-tag" title={`Actor: ${entry.actorCommitment}`}>
                                    Actor: <code>{shortHash(entry.actorCommitment)}</code>
                                </span>
                                <span className="hash-tag" title={`Payload: ${entry.payloadCommitment}`}>
                                    Payload: <code>{shortHash(entry.payloadCommitment)}</code>
                                </span>
                            </div>

                            <div className="scrubber-actions">
                                <button
                                    className="scrubber-proof-btn"
                                    onClick={() => onInspectProof?.(entry.sequence)}
                                    title="Inspect Merkle inclusion path for this event"
                                >
                                    <ArrowDownToLine size={12} /> Verify Merkle Proof
                                </button>
                            </div>
                        </div>
                    </div>
                ))}

                {filtered.length === 0 && (
                    <div className="scrubber-empty">
                        <span>No timeline events match the current filter.</span>
                    </div>
                )}
            </div>
        </div>
    );
};
