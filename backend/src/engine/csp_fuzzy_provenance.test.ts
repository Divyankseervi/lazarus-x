import { LazarusXEngine, SearchSpaceLimitError } from './lazarus';
import {
    appendPublicProvenanceEnvelope,
    createProvenanceDisclosure,
    deriveEventCommitmentKey,
    PUBLIC_ENVELOPE_GENESIS_HASH,
    verifyProvenanceChain,
    verifyProvenanceDisclosure,
    verifyPublicProvenanceEnvelope,
} from './provenance';
import { Evidence, Schema } from './types';

declare const process: { exitCode?: number };

let passed = 0;
let failed = 0;
function test(name: string, run: () => void): void {
    try { run(); console.log(`[PASS] ${name}`); passed++; }
    catch (error) { console.error(`[FAIL] ${name}: ${(error as Error).message}`); failed++; }
}
function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
}
function evidence(id: string, table: string, recordId: number, field: string, value: unknown): Evidence {
    return { id, table, recordId, field, value };
}

const uniqueSchema: Schema = {
    tables: ['Item'],
    constraints: [{ id: 'item-code-unique', type: 'UNIQUE', table: 'Item', field: 'code' }],
};

test('AC-3 prunes values with no inequality support before enumeration', () => {
    const engine = new LazarusXEngine(uniqueSchema);
    engine.processEvidence([
        evidence('one-a', 'Item', 1, 'code', 1),
        evidence('one-b', 'Item', 1, 'code', 2),
        evidence('two-a', 'Item', 2, 'code', 1),
    ]);
    assert(engine.states.length === 1, `expected one state after pruning, got ${engine.states.length}`);
    assert(engine.getBestState().data.Item.find(row => row._recordId === 1)?.code === 2, 'unsupported duplicate value was not removed');
    const diagnostics = engine.getSearchDiagnostics();
    assert(diagnostics.status === 'consistent' && diagnostics.prunedValues === 1, 'expected one value pruned by consistent propagation');
});

test('contradictory UNIQUE evidence falls back to scored candidates instead of deleting source evidence', () => {
    const engine = new LazarusXEngine(uniqueSchema);
    engine.processEvidence([
        evidence('same-a', 'Item', 1, 'code', 7),
        evidence('same-b', 'Item', 2, 'code', 7),
    ]);
    assert(engine.getSearchDiagnostics().status === 'contradiction_fallback', 'expected explicit contradiction fallback');
    assert(engine.states.length === 1 && engine.getBestState().fatalViolations === 1, 'expected the duplicate to remain visible as a fatal violation');
});

test('Jon and John form a bounded fuzzy domain with a finite entropy penalty', () => {
    const engine = new LazarusXEngine({ tables: ['Person'], constraints: [] });
    engine.processEvidence([
        evidence('jon-fragment', 'Person', 1, 'name', 'Jon'),
        evidence('john-fragment', 'Person', 1, 'name', 'John'),
    ]);
    assert(engine.states.length === 2, 'both observed spellings should remain as alternatives');
    const best = engine.getBestState();
    assert(best.fatalViolations === 0, 'fuzzy alternatives must not create a fatal constraint conflict');
    assert((best.fuzzyPenalty ?? 0) > 1, 'expected entropy and edit-distance cost');
    const fuzzy = best.fuzzyDomains?.[0];
    assert(fuzzy?.alternatives.length === 2, 'expected a two-value fuzzy domain');
    assert(Math.abs((fuzzy?.entropyNats ?? 0) - Math.log(2)) < 1e-12, 'expected binary Shannon entropy in nats');
});

test('investigator-assessed source confidence changes heuristic ranking and is replayable', () => {
    const engine = new LazarusXEngine({ tables: ['Record'], constraints: [] });
    engine.processEvidence([
        { ...evidence('high-confidence', 'Record', 1, 'code', 10), confidence: 0.9 },
        { ...evidence('low-confidence', 'Record', 1, 'code', 20), confidence: 0.1 },
    ]);
    assert(engine.states.length === 2, 'both contradictory values should remain as interpretations');
    assert(engine.getBestState().data.Record[0]?.code === 10, 'the higher-confidence observation should rank first');
    assert((engine.getBestState().sourceReliabilityPenalty ?? 0) < (engine.states[1]?.sourceReliabilityPenalty ?? 0),
        'selected state should incur less dissenting-confidence penalty');
    assert(JSON.parse(engine.getProvenanceEntries()[0]!.payload).confidence === 0.9,
        'confidence should be committed into provenance so replay preserves scoring inputs');
    let rejected = false;
    try {
        engine.processEvidence([{ ...evidence('invalid-confidence', 'Record', 2, 'code', 30), confidence: 0 }]);
    } catch {
        rejected = true;
    }
    assert(rejected, 'zero confidence must be rejected');
});

const fuzzyForeignKeySchema: Schema = {
    tables: ['Parent', 'Child'],
    constraints: [{
        id: 'child-parent-name', type: 'FOREIGN_KEY', table: 'Child', field: 'parentName',
        targetTable: 'Parent', targetField: 'name', targetEvidenceComplete: true,
    }],
};

test('fuzzy FK compatibility participates in propagation and records correction provenance', () => {
    const engine = new LazarusXEngine(fuzzyForeignKeySchema);
    engine.processEvidence([
        evidence('parent-name-fragment', 'Parent', 1, 'name', 'John'),
        evidence('child-name-fragment', 'Child', 10, 'parentName', 'Jon'),
        evidence('unsupported-child-name', 'Child', 10, 'parentName', 'Xyz'),
    ], { actorId: 'investigator-7', receivedAt: new Date('2026-10-11T10:00:00.000Z') });
    const best = engine.getBestState();
    assert(engine.states.length === 1 && engine.getSearchDiagnostics().prunedValues === 1,
        'fuzzy FK arc support should prune the beyond-cutoff alternative before enumeration');
    assert(best.resolvableViolations === 0, 'edit-distance-one foreign key should be supported');
    assert(best.fuzzyCorrections?.length === 1, 'expected one fuzzy correction on the selected reconstruction');
    const correction = best.fuzzyCorrections![0];
    assert(correction.editDistance === 1, 'expected edit distance one');
    assert(correction.sourceFragmentIds.includes('child-name-fragment'), 'correction must identify the source fragment');
    assert(correction.targetFragmentIds.includes('parent-name-fragment'), 'correction must identify the matching target fragment');
    assert(best.fuzzyPenalty === 1, 'negative log likelihood should equal the bounded edit distance');
    const entries = engine.getProvenanceEntries();
    assert(entries.length === 4 && entries[3].eventType === 'FUZZY_CORRECTION', 'expected accepted-fragment entries followed by correction entry');
    assert(entries[3].receivedAt === '2026-10-11T10:00:00.000Z', 'correction time must be bound into the ledger');
    assert(entries[3].relatedFragmentIds.includes('child-name-fragment') && entries[3].relatedFragmentIds.includes('parent-name-fragment'), 'ledger entry must bind both fragments');
    const head = engine.getProvenanceHead();
    assert(verifyProvenanceChain(entries, head.hash, head.sequence).valid, 'new provenance chain should verify');
});

test('bounded restricted Damerau-Levenshtein handles transpositions, Unicode, and cutoff pairs', () => {
    const cases: Array<{ target: string; source: string; supported: boolean }> = [
        { target: '', source: 'a', supported: true },
        { target: '😀', source: '😃', supported: true },
        { target: 'form', source: 'from', supported: true },
        { target: 'ab', source: 'ba', supported: true },
        { target: 'kitten', source: 'sitting', supported: false },
    ];
    for (const [index, scenario] of cases.entries()) {
        const engine = new LazarusXEngine(fuzzyForeignKeySchema);
        engine.processEvidence([
            evidence(`distance-parent-${index}`, 'Parent', 1, 'name', scenario.target),
            evidence(`distance-child-${index}`, 'Child', 1, 'parentName', scenario.source),
        ]);
        const expectedResolvable = scenario.supported ? 0 : 1;
        assert(engine.getBestState().resolvableViolations === expectedResolvable,
            `unexpected support result for ${JSON.stringify(scenario)}`);
    }
});

test('open-world FK evidence remains unpruned until target completeness is asserted', () => {
    const schema: Schema = {
        tables: ['Parent', 'Child'],
        constraints: [{ type: 'FOREIGN_KEY', table: 'Child', field: 'parentId', targetTable: 'Parent', targetField: 'id' }],
    };
    const engine = new LazarusXEngine(schema);
    engine.processEvidence([
        evidence('known-parent', 'Parent', 1, 'id', 10),
        evidence('possible-a', 'Child', 5, 'parentId', 10),
        evidence('possible-b', 'Child', 5, 'parentId', 99),
    ]);
    assert(engine.states.length === 2, 'a not-yet-arrived parent must remain a possible interpretation');
});

test('a tampered payload is detected by chain verification', () => {
    const engine = new LazarusXEngine({ tables: ['T'], constraints: [] });
    engine.processEvidence([evidence('fragment', 'T', 1, 'value', 'safe')]);
    const tampered = engine.getProvenanceEntries();
    tampered[0].payload = '{"value":"changed"}';
    assert(!verifyProvenanceChain(tampered).valid, 'payload mutation must break the hash chain');
});

test('public provenance envelope hides payloads and has an independently verifiable commitment chain', () => {
    const engine = new LazarusXEngine({ tables: ['Person'], constraints: [] });
    engine.processEvidence([evidence('private-fragment', 'Person', 1, 'name', 'Private Person')], {
        actorId: 'private-investigator', receivedAt: new Date('2026-10-11T10:00:00.000Z'),
    });
    const entries = engine.getProvenanceEntries();
    const caseSalt = Buffer.alloc(32, 31);
    const publicEntries = [];
    let publicHead = PUBLIC_ENVELOPE_GENESIS_HASH;
    for (const entry of entries) {
        const eventKey = deriveEventCommitmentKey(caseSalt, entry.sequence);
        const envelope = appendPublicProvenanceEnvelope(entry, publicHead, eventKey);
        publicHead = envelope.envelopeHash;
        publicEntries.push(envelope);
    }
    assert(!JSON.stringify(publicEntries).includes('Private Person'), 'public envelope must not disclose field values');
    assert(!JSON.stringify(publicEntries).includes('private-investigator'), 'public envelope must not disclose actor IDs');
    assert(verifyPublicProvenanceEnvelope(publicEntries, publicHead).valid, 'public envelope should verify against its retained head');
    assert(!('ledgerHash' in publicEntries[0]) && !('ledgerPreviousHash' in publicEntries[0]),
        'public envelope must not expose unsalted internal ledger digests');
    const disclosure = createProvenanceDisclosure(entries[0], deriveEventCommitmentKey(caseSalt, entries[0].sequence));
    assert(verifyProvenanceDisclosure(disclosure, publicEntries[0]), 'a selectively disclosed event should verify against its envelope');
    const wrongSequenceKey = deriveEventCommitmentKey(caseSalt, entries[0].sequence + 1);
    assert(!verifyProvenanceDisclosure(createProvenanceDisclosure(entries[0], wrongSequenceKey), publicEntries[0]),
        'event-scoped disclosure salts must not verify another event');
    const tampered = publicEntries.map(entry => ({ ...entry }));
    tampered[0]!.payloadCommitment = '0'.repeat(64);
    assert(!verifyPublicProvenanceEnvelope(tampered, publicHead).valid, 'commitment mutation should invalidate the public envelope');
});

test('chunked provenance ledger preserves sequence checkpoints across chunk boundaries', () => {
    const engine = new LazarusXEngine({ tables: ['T'], constraints: [] }, 5, 1000, 100_000, 500);
    const batch = Array.from({ length: 300 }, (_, index) => evidence(`fragment-${index}`, 'T', index, 'value', index));
    engine.processEvidence(batch);
    const head = engine.getProvenanceHead();
    const tail = engine.getProvenanceEntriesSince(256);
    assert(head.sequence === 300 && tail.length === 44, 'expected stable chunk boundary and tail length');
    assert(tail[0].sequence === 257 && verifyProvenanceChain(engine.getProvenanceEntries(), head.hash, head.sequence).valid,
        'chunked ledger must retain a verifiable ordered chain');
});

test('provenance byte limits reject atomically', () => {
    const engine = new LazarusXEngine({ tables: ['T'], constraints: [] }, 5, 100, 1000, 10, 100, 1, 1000, 100, 1);
    let error: unknown;
    try { engine.processEvidence([evidence('too-large', 'T', 1, 'value', 'safe')]); }
    catch (caught) { error = caught; }
    assert(error instanceof SearchSpaceLimitError, 'expected provenance byte budget rejection');
    assert(engine.getBestState().data.T.length === 0 && engine.getProvenanceHead().sequence === 0,
        'byte-budget rejection must not commit graph state or ledger entries');
});

test('propagation work limits reject atomically', () => {
    const engine = new LazarusXEngine(uniqueSchema, 5, 100, 1000, 100, 1);
    let error: unknown;
    try {
        engine.processEvidence([
            evidence('limit-a', 'Item', 1, 'code', 1),
            evidence('limit-b', 'Item', 2, 'code', 2),
        ]);
    } catch (caught) { error = caught; }
    assert(error instanceof SearchSpaceLimitError, 'expected a bounded propagation rejection');
    assert(engine.getBestState().data.Item.length === 0, 'rejected propagation must not commit evidence');
    assert(engine.getProvenanceHead().sequence === 0, 'rejected propagation must not append provenance');
});

test('Bugfix: AC-3 prunes child when targetEvidenceComplete is true but target table is empty', () => {
    const engine = new LazarusXEngine({
        tables: ['Child', 'Parent'],
        constraints: [{ type: 'FOREIGN_KEY', table: 'Child', field: 'parentId', targetTable: 'Parent', targetField: 'id', targetEvidenceComplete: true }]
    });
    engine.processEvidence([
        evidence('child-1', 'Child', 1, 'parentId', 99)
    ]);
    assert(engine.getSearchDiagnostics().status === 'contradiction_fallback', 'expected contradiction because parent table is empty but marked complete');
});

test('cyclic foreign keys propagate monotonically and preserve mutually supported values', () => {
    const engine = new LazarusXEngine({
        tables: ['A', 'B'],
        constraints: [
            { type: 'FOREIGN_KEY', table: 'A', field: 'bId', targetTable: 'B', targetField: 'id', targetEvidenceComplete: true },
            { type: 'FOREIGN_KEY', table: 'B', field: 'aId', targetTable: 'A', targetField: 'id', targetEvidenceComplete: true },
        ],
    });
    engine.processEvidence([
        evidence('a-id', 'A', 1, 'id', 1),
        evidence('a-b-good', 'A', 1, 'bId', 10), evidence('a-b-bad', 'A', 1, 'bId', 99),
        evidence('b-id', 'B', 1, 'id', 10),
        evidence('b-a-good', 'B', 1, 'aId', 1), evidence('b-a-bad', 'B', 1, 'aId', 99),
    ]);
    assert(engine.states.length === 1, 'mutually supported cyclic keys should leave one candidate');
    assert(engine.getBestState().data.A[0].bId === 10 && engine.getBestState().data.B[0].aId === 1,
        'cycle propagation should retain the supported key pair');
    assert(engine.getSearchDiagnostics().status === 'consistent' && engine.getSearchDiagnostics().prunedValues === 2,
        'finite cyclic propagation should reach a fixed point and prune only unsupported values');
});

test('self-referential nullable foreign keys preserve NULL and valid references', () => {
    const engine = new LazarusXEngine({
        tables: ['Node'],
        constraints: [{ type: 'FOREIGN_KEY', table: 'Node', field: 'parentId', targetTable: 'Node', targetField: 'id', targetEvidenceComplete: true }],
    });
    engine.processEvidence([
        evidence('node-1-id', 'Node', 1, 'id', 1), evidence('node-2-id', 'Node', 2, 'id', 2),
        evidence('node-null-parent', 'Node', 1, 'parentId', null),
        evidence('node-valid-parent', 'Node', 1, 'parentId', 2),
        evidence('node-invalid-parent', 'Node', 1, 'parentId', 99),
    ]);
    const values = engine.states.map(state => state.data.Node.find(row => row._recordId === 1)?.parentId);
    assert(values.includes(null) && values.includes(2) && !values.includes(99),
        'nullable and self-referential key values should survive while unsupported values are pruned');
    assert(engine.getSearchDiagnostics().status === 'consistent', 'nullable self-reference should not trigger fallback');
});

test('composite foreign keys require support from one matching parent row', () => {
    const engine = new LazarusXEngine({
        tables: ['Parent', 'Child'],
        constraints: [{
            type: 'FOREIGN_KEY', table: 'Child', field: 'tenantId', fields: ['tenantId', 'parentKey'],
            targetTable: 'Parent', targetField: 'tenantId', targetFields: ['tenantId', 'key'], targetEvidenceComplete: true,
        }],
    });
    engine.processEvidence([
        evidence('parent-1-tenant', 'Parent', 1, 'tenantId', 1), evidence('parent-1-key', 'Parent', 1, 'key', 'North'),
        evidence('parent-2-tenant', 'Parent', 2, 'tenantId', 2), evidence('parent-2-key', 'Parent', 2, 'key', 'South'),
        evidence('child-tenant-1', 'Child', 7, 'tenantId', 1), evidence('child-tenant-2', 'Child', 7, 'tenantId', 2),
        evidence('child-key', 'Child', 7, 'parentKey', 'North'),
    ]);
    assert(engine.states.length === 1, 'composite propagation should remove tenant 2 because no same row has (2, North)');
    assert(engine.getBestState().data.Child[0].tenantId === 1, 'the surviving source tuple should match parent row (1, North)');
    assert(engine.getBestState().resolvableViolations === 0, 'composite scoring should accept a match on the same parent row');
});

test('nullable simple foreign-key domains retain NULL when the complete target relation is empty', () => {
    const engine = new LazarusXEngine({
        tables: ['Child', 'Parent'],
        constraints: [{ type: 'FOREIGN_KEY', table: 'Child', field: 'parentId', targetTable: 'Parent', targetField: 'id', targetEvidenceComplete: true }],
    });
    engine.processEvidence([
        evidence('nullable-parent-null', 'Child', 1, 'parentId', null),
        evidence('nullable-parent-value', 'Child', 1, 'parentId', 99),
    ]);
    assert(engine.states.length === 1 && engine.getBestState().data.Child[0].parentId === null,
        'a nullable FK must retain NULL even when the complete referenced table has no rows');
    assert(engine.getSearchDiagnostics().status === 'consistent' && engine.getBestState().resolvableViolations === 0,
        'valid NULL should not be scored as a missing-parent violation');
});

test('composite MATCH FULL accepts all-NULL keys and scores partial-NULL keys as fatal', () => {
    const engine = new LazarusXEngine({
        tables: ['Parent', 'Child'],
        constraints: [{
            type: 'FOREIGN_KEY', table: 'Child', field: 'tenantId', fields: ['tenantId', 'parentKey'],
            targetTable: 'Parent', targetField: 'tenantId', targetFields: ['tenantId', 'key'],
            match: 'FULL', targetEvidenceComplete: true,
        }],
    });
    engine.processEvidence([
        evidence('full-parent-tenant', 'Parent', 1, 'tenantId', 1), evidence('full-parent-key', 'Parent', 1, 'key', 'North'),
        evidence('full-child-tenant', 'Child', 7, 'tenantId', 1), evidence('full-child-tenant-null', 'Child', 7, 'tenantId', null),
        evidence('full-child-key', 'Child', 7, 'parentKey', 'North'), evidence('full-child-key-null', 'Child', 7, 'parentKey', null),
    ]);
    assert(engine.states.length === 4 && engine.states.filter(state => state.fatalViolations === 0).length === 2,
        'MATCH FULL should preserve supported all-NULL and non-NULL tuples while scoring partial NULL combinations');
    const partialNullEngine = new LazarusXEngine({
        tables: ['Parent', 'Child'],
        constraints: [{
            type: 'FOREIGN_KEY', table: 'Child', field: 'tenantId', fields: ['tenantId', 'parentKey'],
            targetTable: 'Parent', targetField: 'tenantId', targetFields: ['tenantId', 'key'],
            match: 'FULL', targetEvidenceComplete: true,
        }],
    });
    partialNullEngine.processEvidence([
        evidence('partial-parent-tenant', 'Parent', 1, 'tenantId', 1), evidence('partial-parent-key', 'Parent', 1, 'key', 'North'),
        evidence('partial-child-tenant', 'Child', 7, 'tenantId', 1), evidence('partial-child-key', 'Child', 7, 'parentKey', null),
    ]);
    assert(partialNullEngine.getBestState().fatalViolations === 1,
        'MATCH FULL should score a partially NULL composite key as a fatal violation');
});

test('deep foreign-key chain resolves reverse-order evidence through a partially evidenced bridge row', () => {
    const engine = new LazarusXEngine({
        tables: ['Order', 'Employee', 'Department'],
        constraints: [
            { type: 'FOREIGN_KEY', table: 'Order', field: 'employeeId', targetTable: 'Employee', targetField: 'id', targetEvidenceComplete: true },
            { type: 'FOREIGN_KEY', table: 'Employee', field: 'departmentId', targetTable: 'Department', targetField: 'id', targetEvidenceComplete: true },
        ],
    });

    // Parent evidence intentionally arrives after the child. Employee.name is
    // absent: both FK arcs must use their actual key fields, not require a full row.
    engine.processEvidence([
        evidence('order-employee-supported', 'Order', 90, 'employeeId', 22),
        evidence('order-employee-unsupported', 'Order', 90, 'employeeId', 999),
    ]);
    engine.processEvidence([
        evidence('employee-id', 'Employee', 22, 'id', 22),
        evidence('employee-department-supported', 'Employee', 22, 'departmentId', 7),
        evidence('employee-department-unsupported', 'Employee', 22, 'departmentId', 99),
    ]);
    engine.processEvidence([evidence('department-id', 'Department', 7, 'id', 7)]);

    const best = engine.getBestState();
    assert(engine.getSearchDiagnostics().status === 'consistent', 'the final complete chain should reach a consistent propagation fixed point');
    assert(engine.states.length === 1, `expected unsupported values to be pruned across both hops, got ${engine.states.length} states`);
    assert(best.data.Order.find(row => row._recordId === 90)?.employeeId === 22,
        'the order must remain attached to the evidenced employee');
    assert(best.data.Employee.find(row => row._recordId === 22)?.departmentId === 7,
        'the bridge employee must retain its supported department key');
    assert(!('name' in best.data.Employee.find(row => row._recordId === 22)!),
        'a missing non-key bridge attribute must not make the employee look orphaned');
    assert(best.resolvableViolations === 0 && best.fatalViolations === 0,
        'a valid multi-hop chain must not be scored as an orphan');
});

test('deep foreign-key chain reaches the same valid fixed point for every table arrival order', () => {
    const batches = [
        [
            evidence('perm-order-22', 'Order', 90, 'employeeId', 22),
            evidence('perm-order-999', 'Order', 90, 'employeeId', 999),
        ],
        [
            evidence('perm-employee-id', 'Employee', 22, 'id', 22),
            evidence('perm-employee-dept-7', 'Employee', 22, 'departmentId', 7),
            evidence('perm-employee-dept-99', 'Employee', 22, 'departmentId', 99),
        ],
        [evidence('perm-department-id', 'Department', 7, 'id', 7)],
    ];
    const arrivalOrders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

    for (const arrivalOrder of arrivalOrders) {
        const engine = new LazarusXEngine({
            tables: ['Order', 'Employee', 'Department'],
            constraints: [
                { type: 'FOREIGN_KEY', table: 'Order', field: 'employeeId', targetTable: 'Employee', targetField: 'id', targetEvidenceComplete: true },
                { type: 'FOREIGN_KEY', table: 'Employee', field: 'departmentId', targetTable: 'Department', targetField: 'id', targetEvidenceComplete: true },
            ],
        });
        for (const batchIndex of arrivalOrder) engine.processEvidence(batches[batchIndex]!);

        const state = engine.getBestState();
        assert(engine.getSearchDiagnostics().status === 'consistent', `arrival order ${arrivalOrder.join('→')} should converge`);
        assert(engine.states.length === 1, `arrival order ${arrivalOrder.join('→')} should prune both unsupported keys`);
        assert(state.data.Order.find(row => row._recordId === 90)?.employeeId === 22,
            `arrival order ${arrivalOrder.join('→')} must preserve the valid order→employee edge`);
        assert(state.data.Employee.find(row => row._recordId === 22)?.departmentId === 7,
            `arrival order ${arrivalOrder.join('→')} must preserve the valid employee→department edge`);
        assert(state.resolvableViolations === 0 && state.fatalViolations === 0,
            `arrival order ${arrivalOrder.join('→')} must not create a false orphan violation`);
    }
});

console.log(`CSP/fuzzy/provenance checks: ${passed} passed, ${failed} failed.`);
if (failed > 0) process.exitCode = 1;
