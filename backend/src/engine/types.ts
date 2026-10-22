export interface DomainRecord {
    [key: string]: any;
}

export interface RecordData extends DomainRecord {
    _recordId: number;
}

export interface Constraint {
    id?: string;
    type: 'UNIQUE' | 'FOREIGN_KEY' | 'NOT_NULL';
    table: string;
    field: string;
    targetTable?: string;
    targetField?: string;
    /** Composite foreign-key columns, ordered to match targetFields. */
    fields?: string[];
    targetFields?: string[];
    /** SQL MATCH semantics for a composite nullable foreign key. Defaults to SIMPLE. */
    match?: 'SIMPLE' | 'FULL';
    /** Enable FK domain pruning only when the supplied target evidence is known complete. */
    targetEvidenceComplete?: boolean;
}

export interface Schema {
    tables: string[];
    constraints: Constraint[];
}

export interface CandidateState {
    id: string;
    data: Record<string, RecordData[]>;
    probabilityScore: number;
    isActive: boolean;
    // Delta Tracking State
    globalViolations: number;
    fatalViolations: number;
    resolvableViolations: number;
    /** Heuristic edit-distance and ambiguity cost; not a calibrated probability. */
    fuzzyPenalty?: number;
    /** Confidence-weighted conflict cost; this is a heuristic, not a calibrated probability. */
    sourceReliabilityPenalty?: number;
    fuzzyCorrections?: FuzzyCorrection[];
    fuzzyDomains?: FuzzyDomainSummary[];
    constraintCache: Record<string, { fatal: number, resolvable: number }>;
}

export interface FuzzyCorrection {
    source: { table: string; recordId: number; field: string; value: string };
    target: { table: string; recordId: number; field: string; value: string };
    editDistance: number;
    negativeLogLikelihood: number;
    sourceFragmentIds: string[];
    targetFragmentIds: string[];
}

export interface FuzzyDomainSummary {
    table: string;
    recordId: number;
    field: string;
    selectedValue: string;
    alternatives: string[];
    entropyNats: number;
    /** Mean edit cost, capped at maxEditDistance + 1 for distant values in a transitive component. */
    editDistanceCost: number;
}

export interface Evidence {
    id: string;
    table: string;
    recordId: number;
    field: string;
    value: any;
    /** Optional source confidence in (0, 1]; omitted confidence is treated as 1.0. */
    confidence?: number;
}

export interface EvidenceProcessOptions {
    actorId?: string;
    receivedAt?: Date;
    /** Stable transaction grouping for deterministic replay; defaults to the first fragment ID. */
    batchId?: string;
    /** Internal migration switch used only to replay pre-batch-metadata ledger entries. */
    includeBatchMetadata?: boolean;
}

export interface ProvenanceEntry {
    sequence: number;
    eventType: 'EVIDENCE_ACCEPTED' | 'FUZZY_CORRECTION';
    fragmentId: string;
    relatedFragmentIds: string[];
    actorId: string;
    receivedAt: string;
    payload: string;
    previousHash: string;
    hash: string;
}

export interface PropagationDiagnostics {
    revisions: number;
    prunedValues: number;
    status: 'consistent' | 'contradiction_fallback';
}

export interface CandidateValuePrediction {
    value: unknown;
    probability: number;
    candidateCount: number;
}

export interface ForensicEvidenceRecommendation {
    table: string;
    recordId: number;
    field: string;
    expectedInformationGain: number;
    currentEntropy: number;
    expectedRemainingEntropy: number;
    candidateValues: CandidateValuePrediction[];
    explanation?: string;
}

export interface BranchingDiagnostics {
    totalCandidateStates: number;
    priorEntropyBits: number;
    disputedAttributesCount: number;
    recommendationsCount: number;
    exhausted: boolean;
    contradictionFallback: boolean;
}
