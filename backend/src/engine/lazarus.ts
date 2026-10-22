import { createHash } from 'crypto';
import { Buffer } from 'buffer';
import {
    BranchingDiagnostics,
    CandidateValuePrediction,
    ForensicEvidenceRecommendation,
    CandidateState,
    Constraint,
    Evidence,
    EvidenceProcessOptions,
    FuzzyCorrection,
    FuzzyDomainSummary,
    PropagationDiagnostics,
    ProvenanceEntry,
    RecordData,
    Schema,
} from './types';
import { appendProvenanceEntry, canonicalJson, PROVENANCE_GENESIS_HASH } from './provenance';

type DomainValue = string | number | boolean | null;
interface DomainEntry {
    value: DomainValue;
    evidenceIds: string[];
    evidenceConfidences: number[];
}
type FieldDomain = Map<string, DomainEntry>;
type RecordDomains = Map<number, Map<string, FieldDomain>>;
type EvidenceGraph = Map<string, RecordDomains>;
interface VariableRef { table: string; recordId: number; field: string }
interface FuzzyAlternativeMetrics {
    entropyNats: number;
    editDistanceCost: number;
    alternatives: string[];
}
interface MaterializationResult {
    states: CandidateState[];
    diagnostics: PropagationDiagnostics;
}

function getConstraintId(c: Constraint): string {
    return c.id || JSON.stringify([
        c.type,
        c.table,
        c.fields ?? [c.field],
        c.targetTable || '',
        c.targetFields ?? (c.targetField ? [c.targetField] : []),
        c.match ?? 'SIMPLE',
    ]);
}

function defineOwnValue(target: Record<string, unknown>, key: string, value: unknown): void {
    Object.defineProperty(target, key, { configurable: true, enumerable: true, writable: true, value });
}

function valueKey(value: DomainValue): string {
    return `${typeof value}:${JSON.stringify(value)}`;
}

function variableKey(variable: VariableRef): string {
    return JSON.stringify([variable.table, variable.recordId, variable.field]);
}

function compareValues(a: DomainValue, b: DomainValue): number {
    const left = valueKey(a);
    const right = valueKey(b);
    return left < right ? -1 : left > right ? 1 : 0;
}

function sameScalarValue(a: DomainValue, b: DomainValue): boolean {
    return typeof a === typeof b && a === b;
}

function provenanceEntryBytes(entry: ProvenanceEntry): number {
    return 128 + Buffer.byteLength(entry.payload, 'utf8') + Buffer.byteLength(entry.actorId, 'utf8') +
        Buffer.byteLength(entry.fragmentId, 'utf8') + Buffer.byteLength(entry.receivedAt, 'utf8') +
        Buffer.byteLength(entry.previousHash, 'utf8') + Buffer.byteLength(entry.hash, 'utf8') +
        entry.relatedFragmentIds.reduce((sum, id) => sum + Buffer.byteLength(id, 'utf8') + 4, 0);
}

function emptyGraph(tables: readonly string[]): EvidenceGraph {
    return new Map(tables.map(table => [table, new Map<number, Map<string, FieldDomain>>() ]));
}

function cloneGraph(graph: EvidenceGraph): EvidenceGraph {
    const copy: EvidenceGraph = new Map();
    for (const [table, records] of graph) {
        const recordCopy: RecordDomains = new Map();
        for (const [recordId, fields] of records) {
            const fieldCopy = new Map<string, FieldDomain>();
            for (const [field, values] of fields) fieldCopy.set(field, new Map(values));
            recordCopy.set(recordId, fieldCopy);
        }
        copy.set(table, recordCopy);
    }
    return copy;
}

function countGraphUnits(graph: EvidenceGraph): { records: number; fields: number; values: number; units: number } {
    let records = 0;
    let fields = 0;
    let values = 0;
    let retainedTextUnits = 0;
    for (const table of graph.values()) {
        records += table.size;
        for (const record of table.values()) {
            fields += record.size;
            for (const [field, domain] of record) {
                retainedTextUnits += field.length;
                values += domain.size;
                for (const entry of domain.values()) {
                    retainedTextUnits += valueKey(entry.value).length;
                    if (typeof entry.value === 'string') retainedTextUnits += entry.value.length;
                    for (const evidenceId of entry.evidenceIds) retainedTextUnits += evidenceId.length + 1;
                    retainedTextUnits += entry.evidenceConfidences.length;
                }
            }
        }
    }
    return { records, fields, values, units: records + fields + values + retainedTextUnits };
}

class FuzzyWorkBudget {
    public used = 0;
    private readonly codePoints = new Map<string, string[]>();

    constructor(private readonly maximum: number, private readonly maxDistance: number) {}

    public consume(amount = 1): void {
        if (!Number.isSafeInteger(amount) || amount < 1 || amount > this.maximum - this.used) {
            throw new SearchSpaceLimitError(`Fuzzy and constraint comparison work exceeds the configured limit of ${this.maximum}.`);
        }
        this.used += amount;
    }

    public assertAvailable(additional: number): void {
        if (!Number.isSafeInteger(additional) || additional < 0 || this.used + additional > this.maximum) {
            throw new SearchSpaceLimitError(`Fuzzy and constraint comparison work exceeds the configured limit of ${this.maximum}.`);
        }
    }

    public distance(a: string, b: string): number {
        this.consume(1 + Math.min(a.length, b.length));
        if (a === b) return 0;
        // Limit each comparison's memory and work even if a caller configured a
        // large evidence string limit for exact, non-fuzzy values.
        if (this.maxDistance === 0 || a.length > 512 || b.length > 512) return Number.POSITIVE_INFINITY;
        const left = this.toCodePoints(a);
        const right = this.toCodePoints(b);
        if (left.length > 256 || right.length > 256) return Number.POSITIVE_INFINITY;
        if (Math.abs(left.length - right.length) > this.maxDistance) return Number.POSITIVE_INFINITY;
        if (left.length === 0) return right.length <= this.maxDistance ? right.length : Number.POSITIVE_INFINITY;
        if (right.length === 0) return left.length <= this.maxDistance ? left.length : Number.POSITIVE_INFINITY;

        // Ukkonen banding bounds both the edit distance sought and the work per row.
        let previousPrevious = new Int32Array(right.length + 1);
        let previous = new Int32Array(right.length + 1);
        let current = new Int32Array(right.length + 1);
        const inf = this.maxDistance + 1;
        previousPrevious.fill(inf);
        for (let j = 0; j <= right.length; j++) previous[j] = j <= this.maxDistance ? j : inf;

        for (let i = 1; i <= left.length; i++) {
            current.fill(inf);
            if (i <= this.maxDistance) current[0] = i;
            const start = Math.max(1, i - this.maxDistance);
            const end = Math.min(right.length, i + this.maxDistance);
            this.consume(end - start + 1);
            let rowMinimum = inf;
            for (let j = start; j <= end; j++) {
                const substitution = previous[j - 1] + (left[i - 1] === right[j - 1] ? 0 : 1);
                const insertion = current[j - 1] + 1;
                const deletion = previous[j] + 1;
                let next = Math.min(substitution, insertion, deletion, inf);
                // Restricted Damerau-Levenshtein (optimal string alignment):
                // one adjacent transposition costs one edit. The band still
                // bounds every cell and each candidate is charged to the work budget.
                if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
                    next = Math.min(next, previousPrevious[j - 2]! + 1);
                }
                current[j] = next;
                if (next < rowMinimum) rowMinimum = next;
            }
            if (rowMinimum > this.maxDistance) return Number.POSITIVE_INFINITY;
            [previousPrevious, previous, current] = [previous, current, previousPrevious];
        }
        return previous[right.length] <= this.maxDistance ? previous[right.length] : Number.POSITIVE_INFINITY;
    }

    private toCodePoints(value: string): string[] {
        let result = this.codePoints.get(value);
        if (!result) {
            result = Array.from(value);
            // Bound auxiliary cache memory for high-cardinality domains.
            if (this.codePoints.size < 4096) this.codePoints.set(value, result);
        }
        return result;
    }
}

class ProvenanceLedger {
    private static readonly chunkSize = 256;
    private constructor(
        private readonly chunks: readonly ProvenanceEntry[][],
        public readonly length: number,
        public readonly byteLength: number
    ) {}

    public static empty(): ProvenanceLedger { return new ProvenanceLedger([], 0, 0); }

    public last(): ProvenanceEntry | undefined {
        const lastChunk = this.chunks[this.chunks.length - 1];
        return lastChunk?.[lastChunk.length - 1];
    }

    public append(additions: readonly ProvenanceEntry[]): ProvenanceLedger {
        if (additions.length === 0) return this;
        const nextChunks = this.chunks.slice();
        let tail = nextChunks.pop()?.slice() ?? [];
        for (const entry of additions) {
            if (tail.length === ProvenanceLedger.chunkSize) {
                nextChunks.push(tail);
                tail = [];
            }
            tail.push(entry);
        }
        if (tail.length > 0) nextChunks.push(tail);
        const addedBytes = additions.reduce((sum, entry) => sum + provenanceEntryBytes(entry), 0);
        return new ProvenanceLedger(nextChunks, this.length + additions.length, this.byteLength + addedBytes);
    }

    public all(): ProvenanceEntry[] { return this.chunks.flat(); }

    public since(sequence: number): ProvenanceEntry[] {
        const result: ProvenanceEntry[] = [];
        let remaining = sequence;
        for (const chunk of this.chunks) {
            if (remaining >= chunk.length) { remaining -= chunk.length; continue; }
            result.push(...chunk.slice(remaining));
            remaining = 0;
        }
        return result;
    }
}

class FragmentIdIndex {
    private static readonly shardCount = 256;
    private constructor(private readonly shards: readonly ReadonlySet<string>[]) {}

    public static empty(): FragmentIdIndex {
        return new FragmentIdIndex(Array.from({ length: FragmentIdIndex.shardCount }, () => new Set<string>()));
    }

    public has(fragmentId: string): boolean { return this.shards[this.shard(fragmentId)].has(fragmentId); }

    public with(fragmentIds: readonly string[]): FragmentIdIndex {
        const nextShards = this.shards.slice();
        const changed = new Map<number, Set<string>>();
        for (const fragmentId of fragmentIds) {
            const shardIndex = this.shard(fragmentId);
            let shard = changed.get(shardIndex);
            if (!shard) {
                shard = new Set(this.shards[shardIndex]);
                changed.set(shardIndex, shard);
                nextShards[shardIndex] = shard;
            }
            shard.add(fragmentId);
        }
        return new FragmentIdIndex(nextShards);
    }

    private shard(fragmentId: string): number {
        const digest = createHash('sha256').update(fragmentId, 'utf8').digest();
        return digest[0];
    }
}

export class EvidenceValidationError extends Error {
    public readonly code = 'INVALID_EVIDENCE';
    constructor(message: string) { super(message); this.name = 'EvidenceValidationError'; }
}

export class SearchSpaceLimitError extends Error {
    public readonly code = 'SEARCH_SPACE_LIMIT';
    constructor(message: string) { super(message); this.name = 'SearchSpaceLimitError'; }
}

export class LazarusXEngine {
    private schema: Schema;
    public states: CandidateState[] = [];
    public recomputationCount = 0;
    public readonly provenanceGenesisHash = PROVENANCE_GENESIS_HASH;
    private allConstraints: Constraint[] = [];
    private evidenceGraph: EvidenceGraph = new Map();
    private provenanceLedger = ProvenanceLedger.empty();
    private knownFragmentIds = FragmentIdIndex.empty();
    private appliedCorrectionKeys = new Set<string>();
    private propagationDiagnostics: PropagationDiagnostics = { revisions: 0, prunedValues: 0, status: 'consistent' };

    /**
     * `topK` remains for call-site compatibility. All surviving candidates are
     * enumerated exactly, subject to the explicit graph, propagation, fuzzy-work,
     * candidate, and materialization limits below.
     */
    constructor(
        schema: Schema,
        public topK: number = 5,
        public maxMaterializedStates: number = 10_000,
        public maxMaterializedUnits: number = 1_000_000,
        public maxEvidencePerBatch: number = 10_000,
        public maxPropagationRevisions: number = 100_000,
        public maxEditDistance: number = 1,
        public maxFuzzyComparisons: number = 1_000_000,
        public maxProvenanceEntries: number = 100_000,
        public maxProvenanceBytes: number = 64 * 1024 * 1024
    ) {
        for (const [name, value] of Object.entries({
            topK, maxMaterializedStates, maxMaterializedUnits, maxEvidencePerBatch,
            maxPropagationRevisions, maxFuzzyComparisons, maxProvenanceEntries, maxProvenanceBytes,
        })) {
            if (!Number.isSafeInteger(value) || value < 1) throw new RangeError(`${name} must be a positive safe integer.`);
        }
        if (!Number.isSafeInteger(maxEditDistance) || maxEditDistance < 0 || maxEditDistance > 4) {
            throw new RangeError('maxEditDistance must be an integer from 0 through 4.');
        }
        if (!Array.isArray(schema.tables) || schema.tables.some(t => typeof t !== 'string' || t.length === 0 || t.length > 256)) {
            throw new EvidenceValidationError('Schema tables must be non-empty strings of at most 256 characters.');
        }
        if (new Set(schema.tables).size !== schema.tables.length) throw new EvidenceValidationError('Schema table names must be unique.');
        if (!Array.isArray(schema.constraints)) throw new EvidenceValidationError('Schema constraints must be an array.');
        if (schema.constraints.length > maxMaterializedUnits) {
            throw new SearchSpaceLimitError(`Schema has more constraints than the configured work limit of ${maxMaterializedUnits}.`);
        }

        const tableNames = new Set(schema.tables);
        const seenConstraintIds = new Set<string>();
        this.schema = {
            tables: [...schema.tables],
            constraints: schema.constraints.map(constraint => {
                if (constraint.type !== 'FOREIGN_KEY') return { ...constraint, id: getConstraintId(constraint) };
                if ((constraint.fields !== undefined && !Array.isArray(constraint.fields)) ||
                    (constraint.targetFields !== undefined && !Array.isArray(constraint.targetFields))) {
                    throw new EvidenceValidationError('Composite foreign-key columns must be provided as arrays.');
                }
                const fields = constraint.fields ?? [constraint.field];
                const targetFields = constraint.targetFields ?? (constraint.targetField ? [constraint.targetField] : []);
                const normalized = {
                    ...constraint,
                    field: fields[0],
                    fields: [...fields],
                    targetField: targetFields[0],
                    targetFields: [...targetFields],
                };
                return { ...normalized, id: getConstraintId(normalized) };
            }),
        };
        for (const constraint of this.schema.constraints) {
            if (!['UNIQUE', 'FOREIGN_KEY', 'NOT_NULL'].includes(constraint.type) ||
                !tableNames.has(constraint.table) || typeof constraint.field !== 'string' || !constraint.field || constraint.field === '_recordId') {
                throw new EvidenceValidationError(`Constraint ${constraint.id} has an invalid type, table, or field.`);
            }
            if (typeof constraint.id !== 'string' || constraint.id.length === 0 || constraint.id.length > 256) {
                throw new EvidenceValidationError('Constraint ids must be non-empty strings of at most 256 characters.');
            }
            if (constraint.targetEvidenceComplete !== undefined && typeof constraint.targetEvidenceComplete !== 'boolean') {
                throw new EvidenceValidationError(`Constraint ${constraint.id} has an invalid targetEvidenceComplete flag.`);
            }
            if (seenConstraintIds.has(constraint.id!)) throw new EvidenceValidationError(`Duplicate constraint id ${constraint.id}.`);
            seenConstraintIds.add(constraint.id!);
            if (constraint.type === 'FOREIGN_KEY') {
                const fields = constraint.fields!;
                const targetFields = constraint.targetFields!;
                const validFieldList = (items: string[]) => items.length > 0 && items.length <= 32 &&
                    new Set(items).size === items.length && items.every(item => typeof item === 'string' &&
                        item.length > 0 && item.length <= 256 && item !== '_recordId');
                if (!constraint.targetTable || !tableNames.has(constraint.targetTable) ||
                    !validFieldList(fields) || !validFieldList(targetFields) || fields.length !== targetFields.length ||
                    !['SIMPLE', 'FULL'].includes(constraint.match ?? 'SIMPLE')) {
                    throw new EvidenceValidationError(`Foreign key constraint ${constraint.id} has invalid source/target columns or NULL matching semantics.`);
                }
            }
        }
        this.allConstraints = this.schema.constraints;
        this.evidenceGraph = emptyGraph(this.schema.tables);
        const initial = this.materializeStates(this.evidenceGraph);
        this.states = initial.states;
        this.propagationDiagnostics = initial.diagnostics;
    }

    /** A fork is useful to stage engine changes until the corresponding DB transaction commits. */
    public fork(): LazarusXEngine {
        const copy = new LazarusXEngine(
            this.schema, this.topK, this.maxMaterializedStates, this.maxMaterializedUnits,
            this.maxEvidencePerBatch, this.maxPropagationRevisions, this.maxEditDistance,
            this.maxFuzzyComparisons, this.maxProvenanceEntries, this.maxProvenanceBytes
        );
        copy.evidenceGraph = cloneGraph(this.evidenceGraph);
        copy.states = this.states;
        copy.recomputationCount = this.recomputationCount;
        copy.provenanceLedger = this.provenanceLedger;
        // The persistent index and ledger are shared until the fork commits.
        copy.knownFragmentIds = this.knownFragmentIds;
        copy.appliedCorrectionKeys = this.appliedCorrectionKeys;
        copy.propagationDiagnostics = { ...this.propagationDiagnostics };
        return copy;
    }

    public processEvidence(evidenceList: Evidence[], options: EvidenceProcessOptions = {}): void {
        if (!Array.isArray(evidenceList)) throw new EvidenceValidationError('Evidence must be provided as an array.');
        if (evidenceList.length > this.maxEvidencePerBatch) {
            throw new SearchSpaceLimitError(`Evidence batch has ${evidenceList.length} items; the configured limit is ${this.maxEvidencePerBatch}.`);
        }
        const actorId = options.actorId ?? 'engine';
        if (typeof actorId !== 'string' || actorId.length === 0 || actorId.length > 256) {
            throw new EvidenceValidationError('Evidence actorId must be a non-empty string of at most 256 characters.');
        }
        const receivedAt = options.receivedAt ?? new Date();
        if (!(receivedAt instanceof Date) || !Number.isFinite(receivedAt.getTime())) {
            throw new EvidenceValidationError('Evidence receivedAt must be a valid Date.');
        }
        const batchId = options.batchId ?? evidenceList[0]?.id ?? 'empty-batch';
        if (typeof batchId !== 'string' || batchId.length === 0 || batchId.length > 256) {
            throw new EvidenceValidationError('Evidence batchId must be a non-empty string of at most 256 characters.');
        }
        const includeBatchMetadata = options.includeBatchMetadata !== false;
        if (this.provenanceLedger.length + evidenceList.length > this.maxProvenanceEntries) {
            throw new SearchSpaceLimitError(`Provenance entries exceed the configured limit of ${this.maxProvenanceEntries}.`);
        }

        const stagedEvidence: Evidence[] = [];
        const batchFragmentIds = new Set<string>();
        for (const evidence of evidenceList) {
            this.validateEvidence(evidence);
            if (this.knownFragmentIds.has(evidence.id) || batchFragmentIds.has(evidence.id)) {
                throw new EvidenceValidationError(`Evidence fragment id ${evidence.id} has already been used.`);
            }
            batchFragmentIds.add(evidence.id);
            stagedEvidence.push({
                id: evidence.id, table: evidence.table, recordId: evidence.recordId, field: evidence.field,
                value: evidence.value, ...(evidence.confidence === undefined ? {} : { confidence: evidence.confidence }),
            });
        }

        // Reject oversized growth before allocating any copy-on-write branches.
        // Evidence ids are counted even when an observation repeats an existing value.
        const existingUnits = countGraphUnits(this.evidenceGraph).units;
        let estimatedGrowth = 0;
        const newRecords = new Set<string>();
        const newVariables = new Set<string>();
        const newValues = new Set<string>();
        for (const evidence of stagedEvidence) {
            const records = this.evidenceGraph.get(evidence.table)!;
            const fields = records.get(evidence.recordId);
            const variable = variableKey({ table: evidence.table, recordId: evidence.recordId, field: evidence.field });
            if (!records.has(evidence.recordId) && !newRecords.has(JSON.stringify([evidence.table, evidence.recordId]))) {
                newRecords.add(JSON.stringify([evidence.table, evidence.recordId]));
                estimatedGrowth++;
            }
            if (!fields?.has(evidence.field) && !newVariables.has(variable)) {
                newVariables.add(variable);
                estimatedGrowth += 1 + evidence.field.length;
            }
            const valueIdentity = JSON.stringify([variable, valueKey(evidence.value)]);
            if (!fields?.get(evidence.field)?.has(valueKey(evidence.value)) && !newValues.has(valueIdentity)) {
                newValues.add(valueIdentity);
                estimatedGrowth += 1 + valueKey(evidence.value).length;
                if (typeof evidence.value === 'string') estimatedGrowth += evidence.value.length;
            }
            estimatedGrowth += evidence.id.length + 1;
            if (estimatedGrowth > this.maxMaterializedUnits - existingUnits) {
                throw new SearchSpaceLimitError(`Evidence graph growth exceeds the configured limit of ${this.maxMaterializedUnits} units.`);
            }
        }

        // Stage only touched branches. The authoritative graph and public states
        // are swapped only after propagation and exact materialization both pass.
        const stagedGraph = new Map(this.evidenceGraph);
        const copiedTables = new Set<string>();
        const copiedRecords = new Set<string>();
        const copiedFields = new Set<string>();
        for (const evidence of stagedEvidence) {
            if (!copiedTables.has(evidence.table)) {
                stagedGraph.set(evidence.table, new Map(this.evidenceGraph.get(evidence.table)!));
                copiedTables.add(evidence.table);
            }
            const records = stagedGraph.get(evidence.table)!;
            const recordKey = JSON.stringify([evidence.table, evidence.recordId]);
            if (!copiedRecords.has(recordKey)) {
                records.set(evidence.recordId, new Map(records.get(evidence.recordId)));
                copiedRecords.add(recordKey);
            }
            let fields = records.get(evidence.recordId);
            if (!fields) { fields = new Map(); records.set(evidence.recordId, fields); }
            const fieldKey = JSON.stringify([evidence.table, evidence.recordId, evidence.field]);
            if (!copiedFields.has(fieldKey)) {
                fields.set(evidence.field, new Map(fields.get(evidence.field)));
                copiedFields.add(fieldKey);
            }
            let values = fields.get(evidence.field);
            if (!values) { values = new Map(); fields.set(evidence.field, values); }
            const key = valueKey(evidence.value);
            const existing = values.get(key);
            values.set(key, {
                value: evidence.value,
                evidenceIds: existing ? [...existing.evidenceIds, evidence.id] : [evidence.id],
                evidenceConfidences: existing
                    ? [...existing.evidenceConfidences, evidence.confidence ?? 1]
                    : [evidence.confidence ?? 1],
            });
        }

        const previousRecomputations = this.recomputationCount;
        let result: MaterializationResult;
        try {
            result = this.materializeStates(stagedGraph);
        } catch (error) {
            this.recomputationCount = previousRecomputations;
            throw error;
        }

        const appendedEntries: ProvenanceEntry[] = [];
        let appendedBytes = 0;
        let previousEntry = this.provenanceLedger.last();
        const nextCorrectionKeys = new Set(this.appliedCorrectionKeys);
        const timestamp = receivedAt.toISOString();
        const appendEntry = (entry: ProvenanceEntry): void => {
            const entryBytes = provenanceEntryBytes(entry);
            if (entryBytes > 64 * 1024) {
                throw new SearchSpaceLimitError('A provenance event exceeds the 65536-byte event limit.');
            }
            if (this.provenanceLedger.byteLength + appendedBytes + entryBytes > this.maxProvenanceBytes) {
                throw new SearchSpaceLimitError(`Provenance payloads exceed the configured byte limit of ${this.maxProvenanceBytes}.`);
            }
            appendedEntries.push(entry);
            appendedBytes += entryBytes;
            previousEntry = entry;
        };
        try {
            for (let batchIndex = 0; batchIndex < stagedEvidence.length; batchIndex++) {
                const evidence = stagedEvidence[batchIndex]!;
                const payload = canonicalJson({
                    table: evidence.table,
                    recordId: evidence.recordId,
                    field: evidence.field,
                    value: evidence.value,
                    valueType: evidence.value === null ? 'null' : typeof evidence.value,
                    ...(evidence.confidence === undefined ? {} : { confidence: evidence.confidence }),
                    ...(includeBatchMetadata ? { batchId, batchIndex, batchSize: stagedEvidence.length } : {}),
                });
                appendEntry(appendProvenanceEntry(previousEntry, {
                    eventType: 'EVIDENCE_ACCEPTED', fragmentId: evidence.id, relatedFragmentIds: [],
                    actorId, receivedAt: timestamp, payload,
                }));
            }

            for (const correction of result.states[0]?.fuzzyCorrections ?? []) {
                const correctionKey = canonicalJson(correction);
                if (nextCorrectionKeys.has(correctionKey)) continue;
                const relatedFragmentIds = [...new Set([...correction.sourceFragmentIds, ...correction.targetFragmentIds])].sort();
                const payload = canonicalJson({
                    source: correction.source,
                    target: correction.target,
                    editDistance: correction.editDistance,
                    negativeLogLikelihood: correction.negativeLogLikelihood,
                    sourceFragmentIds: correction.sourceFragmentIds,
                    targetFragmentIds: correction.targetFragmentIds,
                });
                appendEntry(appendProvenanceEntry(previousEntry, {
                    eventType: 'FUZZY_CORRECTION',
                    fragmentId: correction.sourceFragmentIds[0] ?? 'unknown-fragment',
                    relatedFragmentIds,
                    actorId: 'system:lazarus-x',
                    receivedAt: timestamp,
                    payload,
                }));
                nextCorrectionKeys.add(correctionKey);
            }
            if (this.provenanceLedger.length + appendedEntries.length > this.maxProvenanceEntries) {
                throw new SearchSpaceLimitError(`Provenance entries exceed the configured limit of ${this.maxProvenanceEntries}.`);
            }
        } catch (error) {
            this.recomputationCount = previousRecomputations;
            throw error;
        }

        const nextProvenanceLedger = this.provenanceLedger.append(appendedEntries);
        const nextKnownFragmentIds = this.knownFragmentIds.with(stagedEvidence.map(evidence => evidence.id));
        this.evidenceGraph = stagedGraph;
        this.states = result.states;
        this.propagationDiagnostics = result.diagnostics;
        this.provenanceLedger = nextProvenanceLedger;
        this.appliedCorrectionKeys = nextCorrectionKeys;
        this.knownFragmentIds = nextKnownFragmentIds;
    }

    private validateEvidence(evidence: Evidence): void {
        if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
            throw new EvidenceValidationError('Each evidence item must be an object.');
        }
        if (typeof evidence.id !== 'string' || evidence.id.length === 0 || evidence.id.length > 256) {
            throw new EvidenceValidationError('Evidence fragment id must be a non-empty string of at most 256 characters.');
        }
        if (evidence.confidence !== undefined &&
            (typeof evidence.confidence !== 'number' || !Number.isFinite(evidence.confidence) ||
                evidence.confidence <= 0 || evidence.confidence > 1)) {
            throw new EvidenceValidationError('Evidence confidence must be a finite number greater than 0 and at most 1.');
        }
        if (!this.evidenceGraph.has(evidence.table)) {
            throw new EvidenceValidationError('Evidence references a table outside the reconstruction schema.');
        }
        if (typeof evidence.field !== 'string' || evidence.field.length === 0 || evidence.field.length > 256 || evidence.field === '_recordId') {
            throw new EvidenceValidationError('Evidence field must be a non-empty domain field of at most 256 characters; _recordId is reserved.');
        }
        if (!Number.isSafeInteger(evidence.recordId)) throw new EvidenceValidationError('Evidence recordId must be a safe integer.');
        const value = evidence.value;
        if (value !== null && typeof value !== 'string' && typeof value !== 'boolean' &&
            !(typeof value === 'number' && Number.isFinite(value))) {
            throw new EvidenceValidationError('Evidence values must be finite JSON scalar values.');
        }
        if (typeof value === 'string' && value.length > 16_384) {
            throw new EvidenceValidationError('Evidence strings may contain at most 16384 UTF-16 code units.');
        }
    }

    private materializeStates(sourceGraph: EvidenceGraph): MaterializationResult {
        const graphUnits = countGraphUnits(sourceGraph);
        if (graphUnits.units > this.maxMaterializedUnits) {
            throw new SearchSpaceLimitError(`Evidence graph uses ${graphUnits.units} units; the configured limit is ${this.maxMaterializedUnits}.`);
        }

        const fuzzyBudget = new FuzzyWorkBudget(this.maxFuzzyComparisons, this.maxEditDistance);
        const propagation = this.propagateDomains(sourceGraph, fuzzyBudget);
        const graph = propagation.graph;
        let candidateCount = 1;
        let fieldCount = 0;
        for (const table of this.schema.tables) {
            const records = graph.get(table)!;
            for (const fields of records.values()) {
                fieldCount += fields.size;
                for (const values of fields.values()) {
                    if (values.size === 0) throw new EvidenceValidationError('Propagated evidence graph contains an empty domain.');
                    if (candidateCount > this.maxMaterializedStates / values.size) {
                        throw new SearchSpaceLimitError(`Exact search exceeds the configured limit of ${this.maxMaterializedStates} candidates after propagation.`);
                    }
                    candidateCount *= values.size;
                }
            }
        }
        let constraintWorkPerCandidate = 0;
        const recordCounts = new Map<string, number>();
        for (const table of this.schema.tables) recordCounts.set(table, graph.get(table)!.size);
        for (const constraint of this.allConstraints) {
            const work = constraint.type === 'FOREIGN_KEY'
                ? (recordCounts.get(constraint.table) ?? 0) * (recordCounts.get(constraint.targetTable!) ?? 0)
                : recordCounts.get(constraint.table) ?? 0;
            if (!Number.isSafeInteger(work) || work > this.maxMaterializedUnits - constraintWorkPerCandidate) {
                throw new SearchSpaceLimitError(`Constraint evaluation work exceeds the configured limit of ${this.maxMaterializedUnits}.`);
            }
            constraintWorkPerCandidate += work;
        }
        const unitsPerCandidate = Math.max(
            1,
            graphUnits.records + fieldCount * 2 + this.allConstraints.length + constraintWorkPerCandidate
        );
        if (candidateCount > this.maxMaterializedUnits / unitsPerCandidate) {
            throw new SearchSpaceLimitError(`Exact search exceeds the configured limit of ${this.maxMaterializedUnits} materialization units after propagation.`);
        }

        const fuzzyMetrics = this.analyzeFuzzyDomains(graph, fuzzyBudget);
        const choices: Array<{ table: string; recordId: number; field: string; values: DomainEntry[]; row: RecordData }> = [];
        const data = Object.create(null) as Record<string, RecordData[]>;
        for (const table of this.schema.tables) {
            defineOwnValue(data, table, []);
            const records = graph.get(table)!;
            const orderedRecords = [...records.entries()].sort((a, b) => a[0] - b[0]);
            for (const [recordId, fields] of orderedRecords) {
                const row = Object.create(null) as RecordData;
                defineOwnValue(row, '_recordId', recordId);
                data[table].push(row);
                const orderedFields = [...fields.entries()].sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
                for (const [field, values] of orderedFields) {
                    choices.push({ table, recordId, field, values: [...values.values()].sort((a, b) => compareValues(a.value, b.value)), row });
                }
            }
        }

        const candidates: CandidateState[] = [];
        const choiceIndexes = new Uint32Array(choices.length);
        for (const choice of choices) defineOwnValue(choice.row, choice.field, choice.values[0].value);
        let hasCandidate = true;
        while (hasCandidate) {
            const snapshot = Object.create(null) as Record<string, RecordData[]>;
            for (const table of this.schema.tables) {
                const rows = data[table].map(source => {
                    const row = Object.create(null) as RecordData;
                    for (const field of Object.keys(source)) defineOwnValue(row, field, source[field]);
                    return row;
                });
                defineOwnValue(snapshot, table, rows);
            }
            const state = this.createCandidateState(snapshot, candidates.length);
            this.applyFuzzyDomainMetrics(state, fuzzyMetrics);
            this.recomputeConstraints(state, this.allConstraints, graph, fuzzyBudget);
            candidates.push(state);

            // Iterative mixed-radix enumeration avoids call-stack exhaustion when
            // a valid case contains many singleton fields.
            let choiceIndex = choices.length - 1;
            for (; choiceIndex >= 0; choiceIndex--) {
                const choice = choices[choiceIndex];
                const nextValueIndex = choiceIndexes[choiceIndex] + 1;
                if (nextValueIndex < choice.values.length) {
                    choiceIndexes[choiceIndex] = nextValueIndex;
                    defineOwnValue(choice.row, choice.field, choice.values[nextValueIndex].value);
                    break;
                }
                choiceIndexes[choiceIndex] = 0;
                defineOwnValue(choice.row, choice.field, choice.values[0].value);
            }
            if (choiceIndex < 0) hasCandidate = false;
        }

        candidates.sort((a, b) => {
            const penaltyA = a.fatalViolations * 100 + a.resolvableViolations + (a.fuzzyPenalty ?? 0) + (a.sourceReliabilityPenalty ?? 0);
            const penaltyB = b.fatalViolations * 100 + b.resolvableViolations + (b.fuzzyPenalty ?? 0) + (b.sourceReliabilityPenalty ?? 0);
            // Enumeration order is deterministic (schema/record/field/value order),
            // and stable Array#sort preserves it for tied heuristic scores.
            return penaltyA - penaltyB;
        });
        candidates.forEach((candidate, index) => { candidate.id = `S-${index}`; });
        return {
            states: candidates,
            diagnostics: { revisions: propagation.revisions, prunedValues: propagation.prunedValues, status: propagation.status },
        };
    }

    private propagateDomains(source: EvidenceGraph, budget: FuzzyWorkBudget): {
        graph: EvidenceGraph; revisions: number; prunedValues: number; status: PropagationDiagnostics['status'];
    } {
        const graph = cloneGraph(source);
        type Arc = { tail: VariableRef; revise: () => boolean };
        const arcs: Arc[] = [];
        const addArc = (tail: VariableRef, revise: () => boolean): void => {
            if (arcs.length >= this.maxPropagationRevisions) {
                throw new SearchSpaceLimitError(`Arc count exceeds the configured propagation limit of ${this.maxPropagationRevisions}.`);
            }
            arcs.push({ tail, revise });
        };
        const getDomain = (variable: VariableRef): FieldDomain | undefined =>
            graph.get(variable.table)?.get(variable.recordId)?.get(variable.field);
        const varsFor = (table: string, field: string): VariableRef[] => {
            const variables: VariableRef[] = [];
            for (const [recordId, fields] of graph.get(table)!) {
                if (fields.has(field)) variables.push({ table, recordId, field });
            }
            return variables;
        };

        for (const constraint of this.allConstraints) {
            if (constraint.type === 'NOT_NULL') {
                for (const variable of varsFor(constraint.table, constraint.field)) {
                    addArc(variable, () => {
                        const domain = getDomain(variable)!;
                        return domain.delete(valueKey(null));
                    });
                }
            } else if (constraint.type === 'UNIQUE') {
                const variables = varsFor(constraint.table, constraint.field);
                for (let i = 0; i < variables.length; i++) {
                    for (let j = i + 1; j < variables.length; j++) {
                        const left = variables[i];
                        const right = variables[j];
                        addArc(left, () => this.reviseNotEqual(getDomain(left)!, getDomain(right)!, budget));
                        addArc(right, () => this.reviseNotEqual(getDomain(right)!, getDomain(left)!, budget));
                    }
                }
            } else if (constraint.type === 'FOREIGN_KEY') {
                // Partial forensic evidence is open-world by default. FK support
                // pruning is sound only when the caller marks the target evidence
                // complete; otherwise a missing parent may arrive later.
                if (!constraint.targetEvidenceComplete) continue;
                const sourceFields = constraint.fields!;
                const targetFields = constraint.targetFields!;
                const sourceRecords = graph.get(constraint.table)!;
                for (const [sourceRecordId, sourceRecord] of sourceRecords) {
                    for (let componentIndex = 0; componentIndex < sourceFields.length; componentIndex++) {
                        const field = sourceFields[componentIndex];
                        const variable = { table: constraint.table, recordId: sourceRecordId, field };
                        if (!sourceRecord.has(field)) continue;
                        addArc(variable, () => {
                            const sourceDomains = sourceFields.map(sourceField => sourceRecord.get(sourceField));
                            const sourceDomain = sourceDomains[componentIndex]!;
                            const targetRecords = graph.get(constraint.targetTable!)!;
                            // An evidenced target row with a missing key component is
                            // still open-world. Do not prune against partial parent keys.
                            const targetTuples = [...targetRecords.values()].map(targetRecord =>
                                targetFields.map(targetField => targetRecord.get(targetField))
                            );
                            if (targetTuples.some(tuple => tuple.some(domain => !domain || domain.size === 0))) return false;
                            const targetNonNullValues = targetTuples.map(tuple => tuple.map(domain =>
                                [...domain!.values()].filter(entry => entry.value !== null)
                            ));
                            const sourceMayBeNull = sourceDomains.map(domain => !domain || domain.has(valueKey(null)));
                            const sourceNonNullValues = sourceDomains.map(domain => domain
                                ? [...domain.values()].filter(entry => entry.value !== null)
                                : undefined);

                            const simpleMatch = (constraint.match ?? 'SIMPLE') === 'SIMPLE';
                            let changed = false;
                            for (const [key, sourceEntry] of sourceDomain) {
                                const mayBeNull = sourceDomains.map((_, index) =>
                                    index === componentIndex ? sourceEntry.value === null :
                                        sourceMayBeNull[index]);
                                let supported = simpleMatch && mayBeNull.some(Boolean);
                                if (!supported && !simpleMatch && mayBeNull.every(Boolean)) supported = true;

                                // For non-NULL tuples, every known component must be
                                // supported by the same target row. Missing source
                                // evidence is open; any value can still match that row.
                                if (!supported) {
                                    for (let targetIndex = 0; targetIndex < targetTuples.length; targetIndex++) {
                                        const targetValuesByComponent = targetNonNullValues[targetIndex];
                                        let rowSupportsTuple = true;
                                        for (let index = 0; index < sourceFields.length; index++) {
                                            const targetValues = targetValuesByComponent[index];
                                            const sourceValues = index === componentIndex
                                                ? [sourceEntry]
                                                : sourceNonNullValues[index] ?? targetValues;
                                            let componentHasSupport = false;
                                            for (const sourceValue of sourceValues) {
                                                for (const targetValue of targetValues) {
                                                    if (this.valuesCompatible(sourceValue.value, targetValue.value, budget)) {
                                                        componentHasSupport = true;
                                                        break;
                                                    }
                                                }
                                                if (componentHasSupport) break;
                                            }
                                            if (!componentHasSupport) { rowSupportsTuple = false; break; }
                                        }
                                        if (rowSupportsTuple) { supported = true; break; }
                                    }
                                }
                                if (!supported) changed = sourceDomain.delete(key) || changed;
                            }
                            return changed;
                        });
                    }
                }
            }
        }

        let revisions = 0;
        let prunedValues = 0;
        const pending = new Uint8Array(arcs.length);
        const queue: number[] = [];
        const enqueueAll = (): void => {
            for (let i = 0; i < arcs.length; i++) {
                if (pending[i] === 0) { pending[i] = 1; queue.push(i); }
            }
        };
        enqueueAll();
        let head = 0;
        let contradiction = false;
        while (head < queue.length) {
            const arcIndex = queue[head++];
            pending[arcIndex] = 0;
            revisions++;
            if (revisions > this.maxPropagationRevisions) {
                throw new SearchSpaceLimitError(`Arc propagation exceeds the configured revision limit of ${this.maxPropagationRevisions}.`);
            }
            const arc = arcs[arcIndex];
            const before = getDomain(arc.tail)?.size ?? 0;
            if (!arc.revise()) continue;
            const after = getDomain(arc.tail)?.size ?? 0;
            prunedValues += before - after;
            if (after === 0) { contradiction = true; break; }
            enqueueAll();
        }

        if (contradiction) {
            // Evidence may genuinely violate hard constraints. Preserve all source
            // alternatives and let the existing violation scorer report that case.
            return { graph: source, revisions, prunedValues: 0, status: 'contradiction_fallback' };
        }
        return { graph, revisions, prunedValues, status: 'consistent' };
    }

    private reviseNotEqual(left: FieldDomain, right: FieldDomain, budget: FuzzyWorkBudget): boolean {
        let changed = false;
        for (const [key, entry] of left) {
            let hasSupport = false;
            for (const other of right.values()) {
                // Pairwise UNIQUE arcs can have large domains. Count every tuple
                // check against the same explicit propagation work budget.
                budget.consume(typeof entry.value === 'string' && typeof other.value === 'string'
                    ? 1 + Math.min(entry.value.length, other.value.length)
                    : 1);
                if (entry.value === null || other.value === null || !sameScalarValue(entry.value, other.value)) {
                    hasSupport = true;
                    break;
                }
            }
            if (!hasSupport) changed = left.delete(key) || changed;
        }
        return changed;
    }

    private valuesCompatible(a: DomainValue, b: DomainValue, budget: FuzzyWorkBudget): boolean {
        return Number.isFinite(this.valueDistance(a, b, budget));
    }

    private valueDistance(a: DomainValue, b: DomainValue, budget: FuzzyWorkBudget): number {
        if (typeof a === 'string' && typeof b === 'string') return budget.distance(a, b);
        budget.consume();
        return valueKey(a) === valueKey(b) ? 0 : Number.POSITIVE_INFINITY;
    }

    private analyzeFuzzyDomains(graph: EvidenceGraph, budget: FuzzyWorkBudget): Map<string, Map<string, FuzzyAlternativeMetrics>> {
        const analyses = new Map<string, Map<string, FuzzyAlternativeMetrics>>();
        for (const [table, records] of graph) {
            for (const [recordId, fields] of records) {
                for (const [field, domain] of fields) {
                    const strings = [...domain.entries()].filter((entry): entry is [string, DomainEntry] => typeof entry[1].value === 'string');
                    if (strings.length < 2 || this.maxEditDistance === 0) continue;
                    const pairCount = strings.length * (strings.length - 1) / 2;
                    budget.assertAvailable(pairCount);
                    const parents = strings.map((_, index) => index);
                    const find = (index: number): number => {
                        while (parents[index] !== index) { parents[index] = parents[parents[index]]; index = parents[index]; }
                        return index;
                    };
                    const union = (a: number, b: number): void => {
                        const rootA = find(a), rootB = find(b);
                        if (rootA !== rootB) parents[rootB] = rootA;
                    };
                    const distances: number[][] = Array.from({ length: strings.length }, () => Array(strings.length).fill(Number.POSITIVE_INFINITY));
                    for (let i = 0; i < strings.length; i++) {
                        distances[i][i] = 0;
                        for (let j = i + 1; j < strings.length; j++) {
                            const distance = budget.distance(strings[i][1].value as string, strings[j][1].value as string);
                            distances[i][j] = distance;
                            distances[j][i] = distance;
                            if (Number.isFinite(distance)) union(i, j);
                        }
                    }
                    const components = new Map<number, number[]>();
                    for (let i = 0; i < strings.length; i++) {
                        const root = find(i);
                        if (!components.has(root)) components.set(root, []);
                        components.get(root)!.push(i);
                    }
                    const valueMetrics = new Map<string, FuzzyAlternativeMetrics>();
                    for (const indexes of components.values()) {
                        if (indexes.length < 2) continue;
                        const counts = indexes.map(index => strings[index][1].evidenceIds.length);
                        const countTotal = counts.reduce((sum, count) => sum + count, 0);
                        let entropyNats = 0;
                        for (const count of counts) {
                            const probability = count / countTotal;
                            if (probability > 0) entropyNats -= probability * Math.log(probability);
                        }
                        const alternatives = indexes.map(index => strings[index][1].value as string).sort();
                        for (let position = 0; position < indexes.length; position++) {
                            const selectedIndex = indexes[position];
                            let weightedDistance = 0;
                            for (let other = 0; other < indexes.length; other++) {
                                const distance = distances[selectedIndex][indexes[other]];
                                weightedDistance += counts[other] * (Number.isFinite(distance) ? distance : this.maxEditDistance + 1);
                            }
                            const entry = strings[selectedIndex][1];
                            valueMetrics.set(valueKey(entry.value), {
                                entropyNats,
                                editDistanceCost: weightedDistance / countTotal,
                                alternatives,
                            });
                        }
                    }
                    if (valueMetrics.size > 0) analyses.set(variableKey({ table, recordId, field }), valueMetrics);
                }
            }
        }
        return analyses;
    }

    private applyFuzzyDomainMetrics(
        state: CandidateState,
        analyses: Map<string, Map<string, FuzzyAlternativeMetrics>>
    ): void {
        const summaries: FuzzyDomainSummary[] = [];
        let fuzzyPenalty = 0;
        for (const table of this.schema.tables) {
            for (const row of state.data[table]) {
                for (const field of Object.keys(row)) {
                    if (field === '_recordId' || typeof row[field] !== 'string') continue;
                    const metrics = analyses.get(variableKey({ table, recordId: row._recordId, field }))?.get(valueKey(row[field]));
                    if (!metrics) continue;
                    fuzzyPenalty += metrics.entropyNats + metrics.editDistanceCost;
                    summaries.push({
                        table, recordId: row._recordId, field,
                        selectedValue: row[field] as string,
                        // All states share this immutable (engine-owned) domain list.
                        alternatives: metrics.alternatives,
                        entropyNats: metrics.entropyNats,
                        editDistanceCost: metrics.editDistanceCost,
                    });
                }
            }
        }
        state.fuzzyPenalty = fuzzyPenalty;
        state.fuzzyDomains = summaries;
        state.fuzzyCorrections = [];
    }

    private createCandidateState(data: CandidateState['data'], index: number): CandidateState {
        return {
            id: `S-${index}`,
            data,
            probabilityScore: 1.0,
            isActive: true,
            globalViolations: 0,
            fatalViolations: 0,
            resolvableViolations: 0,
            fuzzyPenalty: 0,
            sourceReliabilityPenalty: 0,
            fuzzyCorrections: [],
            fuzzyDomains: [],
            constraintCache: Object.create(null),
        };
    }

    private recomputeConstraints(
        state: CandidateState,
        constraintsToEval: Constraint[],
        graph: EvidenceGraph,
        budget: FuzzyWorkBudget
    ): void {
        state.fatalViolations = 0;
        state.resolvableViolations = 0;
        state.constraintCache = Object.create(null);
        const corrections = state.fuzzyCorrections ?? (state.fuzzyCorrections = []);

        for (const constraint of constraintsToEval) {
            this.recomputationCount++;
            let newFatal = 0;
            let newResolvable = 0;
            if (constraint.type === 'NOT_NULL') {
                for (const row of state.data[constraint.table]) {
                    if (row[constraint.field] === null || row[constraint.field] === undefined) newFatal++;
                }
            } else if (constraint.type === 'FOREIGN_KEY') {
                const sourceFields = constraint.fields!;
                const targetFields = constraint.targetFields!;
                const simpleMatch = (constraint.match ?? 'SIMPLE') === 'SIMPLE';
                for (const row of state.data[constraint.table]) {
                    const sourceValues = sourceFields.map(field => row[field] as DomainValue | undefined);
                    if (sourceValues.some(value => value === undefined)) continue; // Partial source evidence is open.
                    const nullCount = sourceValues.filter(value => value === null).length;
                    if (simpleMatch && nullCount > 0) continue;
                    if (!simpleMatch && nullCount > 0) {
                        if (nullCount !== sourceFields.length) newFatal++;
                        continue;
                    }

                    let bestMatch: {
                        row: RecordData;
                        components: Array<{ sourceValue: DomainValue; targetValue: DomainValue; distance: number; sourceIds: string[]; targetIds: string[] }>;
                        distance: number;
                    } | undefined;
                    for (const targetRow of state.data[constraint.targetTable!]) {
                        const components: NonNullable<typeof bestMatch>['components'] = [];
                        let totalDistance = 0;
                        let supported = true;
                        for (let index = 0; index < sourceFields.length; index++) {
                            const sourceValue = sourceValues[index]!;
                            const targetValue = targetRow[targetFields[index]] as DomainValue | undefined;
                            if (targetValue === undefined || targetValue === null) { supported = false; break; }
                            budget.consume(typeof targetValue === 'string' ? 1 + targetValue.length : 1);
                            budget.consume(typeof sourceValue === 'string' ? 1 + sourceValue.length : 1);
                            const distance = this.valueDistance(sourceValue, targetValue, budget);
                            if (!Number.isFinite(distance)) { supported = false; break; }
                            totalDistance += distance;
                            const sourceEntry = graph.get(constraint.table)?.get(row._recordId)?.get(sourceFields[index])?.get(valueKey(sourceValue));
                            const targetEntry = graph.get(constraint.targetTable!)?.get(targetRow._recordId)?.get(targetFields[index])?.get(valueKey(targetValue));
                            components.push({
                                sourceValue,
                                targetValue,
                                distance,
                                sourceIds: sourceEntry?.evidenceIds ?? [],
                                targetIds: targetEntry?.evidenceIds ?? [],
                            });
                        }
                        if (!supported) continue;
                        if (!bestMatch || totalDistance < bestMatch.distance ||
                            (totalDistance === bestMatch.distance && targetRow._recordId < bestMatch.row._recordId)) {
                            bestMatch = { row: targetRow, components, distance: totalDistance };
                        }
                    }
                    if (!bestMatch) {
                        newResolvable++;
                    } else {
                        for (let index = 0; index < bestMatch.components.length; index++) {
                            const component = bestMatch.components[index];
                            if (component.distance === 0) continue;
                            const correction: FuzzyCorrection = {
                                source: { table: constraint.table, recordId: row._recordId, field: sourceFields[index], value: String(component.sourceValue) },
                                target: { table: constraint.targetTable!, recordId: bestMatch.row._recordId, field: targetFields[index], value: String(component.targetValue) },
                                editDistance: component.distance,
                                // exp(-distance) is the bounded edit likelihood; its negative log is distance nats.
                                negativeLogLikelihood: component.distance,
                                sourceFragmentIds: [...component.sourceIds].sort(),
                                targetFragmentIds: [...component.targetIds].sort(),
                            };
                            corrections.push(correction);
                            state.fuzzyPenalty = (state.fuzzyPenalty ?? 0) + correction.negativeLogLikelihood;
                        }
                    }
                }
            } else if (constraint.type === 'UNIQUE') {
                const seen = new Set<DomainValue>();
                for (const row of state.data[constraint.table]) {
                    const value = row[constraint.field];
                    if (value !== undefined && value !== null) {
                        budget.consume(typeof value === 'string' ? 1 + value.length : 1);
                        if (seen.has(value)) newFatal++;
                        seen.add(value);
                    }
                }
            }
            const constraintId = constraint.id!;
            state.fatalViolations += newFatal;
            state.resolvableViolations += newResolvable;
            state.constraintCache[constraintId] = { fatal: newFatal, resolvable: newResolvable };
        }

        state.fuzzyCorrections = corrections;
        state.globalViolations = state.fatalViolations + state.resolvableViolations;
        let sourceReliabilityPenalty = 0;
        for (const table of this.schema.tables) {
            for (const row of state.data[table]) {
                const fields = graph.get(table)?.get(row._recordId);
                if (!fields) continue;
                for (const [field, domain] of fields) {
                    const totalConfidence = [...domain.values()].reduce((sum, entry) =>
                        sum + entry.evidenceConfidences.reduce((fieldSum, confidence) => fieldSum + confidence, 0), 0);
                    if (totalConfidence <= 0) continue;
                    const selected = domain.get(valueKey(row[field] as DomainValue));
                    const selectedConfidence = selected?.evidenceConfidences.reduce((sum, confidence) => sum + confidence, 0) ?? 0;
                    // Normalize dissenting-source confidence per field so a high
                    // volume of repeated observations cannot dominate unrelated constraints.
                    sourceReliabilityPenalty += Math.max(0, totalConfidence - selectedConfidence) / totalConfidence;
                }
            }
        }
        state.sourceReliabilityPenalty = sourceReliabilityPenalty;
        const totalPenalty = state.fatalViolations * 100 + state.resolvableViolations +
            (state.fuzzyPenalty ?? 0) + sourceReliabilityPenalty;
        state.probabilityScore = 1.0 / (1.0 + totalPenalty);
    }

    public getProvenanceEntries(): ProvenanceEntry[] {
        return this.provenanceLedger.all().map(entry => ({ ...entry, relatedFragmentIds: [...entry.relatedFragmentIds] }));
    }

    public getProvenanceEntriesSince(sequence: number): ProvenanceEntry[] {
        if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence > this.provenanceLedger.length) {
            throw new RangeError('Provenance sequence must be a valid prefix length.');
        }
        return this.provenanceLedger.since(sequence).map(entry => ({ ...entry, relatedFragmentIds: [...entry.relatedFragmentIds] }));
    }

    public getProvenanceHead(): { sequence: number; hash: string } {
        const last = this.provenanceLedger.last();
        return { sequence: last?.sequence ?? 0, hash: last?.hash ?? PROVENANCE_GENESIS_HASH };
    }

    public getSearchDiagnostics(): PropagationDiagnostics {
        return { ...this.propagationDiagnostics };
    }

    public rankNextEvidence(limit = 5): ForensicEvidenceRecommendation[] {
        if (!Number.isSafeInteger(limit) || limit < 1) limit = 5;
        if (this.states.length <= 1) return [];

        let sumScores = 0;
        for (const state of this.states) sumScores += state.probabilityScore;
        if (sumScores <= 0) return [];

        let baseEntropy = 0;
        for (const state of this.states) {
            const probability = state.probabilityScore / sumScores;
            if (probability > 0) baseEntropy -= probability * Math.log2(probability);
        }
        if (baseEntropy <= 1e-9) return [];

        type AttributeKey = string;
        interface AttributeGroup {
            table: string;
            recordId: number;
            field: string;
            valueGroups: Map<string, { value: unknown; totalWeight: number; candidateCount: number; stateWeights: number[] }>;
        }
        const attributes = new Map<AttributeKey, AttributeGroup>();

        for (const state of this.states) {
            for (const table of this.schema.tables) {
                const records = state.data[table] || [];
                for (const record of records) {
                    const recordId = record._recordId;
                    for (const field of Object.keys(record)) {
                        if (field === '_recordId') continue;
                        const key = JSON.stringify([table, recordId, field]);
                        if (!attributes.has(key)) {
                            attributes.set(key, { table, recordId, field, valueGroups: new Map() });
                        }
                    }
                }
            }
        }

        const recommendations: ForensicEvidenceRecommendation[] = [];

        for (const attr of attributes.values()) {
            const { table, recordId, field, valueGroups } = attr;

            for (const state of this.states) {
                const records = state.data[table] || [];
                const record = records.find(r => r._recordId === recordId);
                const val = (record && Object.prototype.hasOwnProperty.call(record, field)) ? record[field] : undefined;
                const vKey = valueKey(val as DomainValue);

                let group = valueGroups.get(vKey);
                if (!group) {
                    group = { value: val, totalWeight: 0, candidateCount: 0, stateWeights: [] };
                    valueGroups.set(vKey, group);
                }
                group.totalWeight += state.probabilityScore;
                group.candidateCount += 1;
                group.stateWeights.push(state.probabilityScore);
            }

            if (valueGroups.size <= 1) continue;

            let expectedConditionalEntropy = 0;
            const candidateValues: CandidateValuePrediction[] = [];

            for (const group of valueGroups.values()) {
                if (group.totalWeight <= 0) continue;
                const pVal = group.totalWeight / sumScores;

                let branchEntropy = 0;
                for (const w of group.stateWeights) {
                    const pStateGivenVal = w / group.totalWeight;
                    if (pStateGivenVal > 0) {
                        branchEntropy -= pStateGivenVal * Math.log2(pStateGivenVal);
                    }
                }
                expectedConditionalEntropy += pVal * branchEntropy;

                candidateValues.push({
                    value: group.value,
                    probability: pVal,
                    candidateCount: group.candidateCount,
                });
            }

            const expectedInformationGain = Math.max(0, baseEntropy - expectedConditionalEntropy);
            if (expectedInformationGain < 1e-9) continue;

            candidateValues.sort((a, b) => {
                if (Math.abs(b.probability - a.probability) > 1e-9) {
                    return b.probability - a.probability;
                }
                return String(a.value).localeCompare(String(b.value));
            });

            const topPredicted = candidateValues.slice(0, 3)
                .map(c => `'${String(c.value)}' (${(c.probability * 100).toFixed(0)}%)`)
                .join(', ');
            const explanation = `Querying ${table}[${recordId}].${field} partitions ${candidateValues.length} competing hypotheses (top: ${topPredicted}), reducing entropy by ${expectedInformationGain.toFixed(2)} bits (from ${baseEntropy.toFixed(2)} to ${Math.max(0, expectedConditionalEntropy).toFixed(2)} bits).`;

            recommendations.push({
                table,
                recordId,
                field,
                expectedInformationGain,
                currentEntropy: baseEntropy,
                expectedRemainingEntropy: Math.max(0, expectedConditionalEntropy),
                candidateValues,
                explanation,
            });
        }

        recommendations.sort((a, b) => {
            const gainDiff = b.expectedInformationGain - a.expectedInformationGain;
            if (Math.abs(gainDiff) > 1e-9) return gainDiff;
            const tableCmp = a.table.localeCompare(b.table);
            if (tableCmp !== 0) return tableCmp;
            if (a.recordId !== b.recordId) return a.recordId - b.recordId;
            return a.field.localeCompare(b.field);
        });

        return recommendations.slice(0, limit);
    }

    public recommendNextEvidence(): ForensicEvidenceRecommendation | null {
        const ranked = this.rankNextEvidence(1);
        return ranked[0] ?? null;
    }

    public getBranchingDiagnostics(): BranchingDiagnostics {
        let sumScores = 0;
        for (const state of this.states) sumScores += state.probabilityScore;
        let baseEntropy = 0;
        if (sumScores > 0) {
            for (const state of this.states) {
                const probability = state.probabilityScore / sumScores;
                if (probability > 0) baseEntropy -= probability * Math.log2(probability);
            }
        }
        const recommendations = this.rankNextEvidence(100);
        return {
            totalCandidateStates: this.states.length,
            priorEntropyBits: baseEntropy,
            disputedAttributesCount: recommendations.length,
            recommendationsCount: recommendations.length,
            exhausted: this.states.length <= 1 || recommendations.length === 0,
            contradictionFallback: this.propagationDiagnostics.status === 'contradiction_fallback',
        };
    }

    public getBestState(): CandidateState { return this.states[0]!; }
}
