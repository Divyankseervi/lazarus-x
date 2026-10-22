import { Simulator } from './simulator';
import { BaselineFullRecomputation } from './baselines';
import { LazarusXEngine } from './lazarus';
import { Evidence } from './types';

let passCount = 0;
let failCount = 0;

function runTest(name: string, fn: () => void) {
    try {
        fn();
        console.log(`[PASS] ${name}`);
        passCount++;
    } catch (e: any) {
        console.error(`[FAIL] ${name}: ${e.message}`);
        failCount++;
    }
}

function assertEq(actual: any, expected: any, msg: string) {
    if (actual !== expected) throw new Error(`${msg} (Expected ${expected}, got ${actual})`);
}

function assert(condition: boolean, msg: string) {
    if (!condition) throw new Error(msg);
}

const schema = {
    tables: ['T1', 'T2'],
    constraints: [
        { type: 'UNIQUE' as const, table: 'T1', field: 'val' },
        { type: 'FOREIGN_KEY' as const, table: 'T2', field: 't1_id', targetTable: 'T1', targetField: 'id' },
        { type: 'NOT_NULL' as const, table: 'T1', field: 'name' }
    ]
};

runTest('Mathematical Equivalence: Delta Tracking vs Full Recomputation', () => {
    // Generate complex random evidence
    const sim = new Simulator(105);
    sim.generateGroundTruth(1, 2, 1);
    const evidence = sim.degradeAndGenerateEvidence(0.4);
    
    // We must test scoring separately from pruning to avoid circular candidate drops
    // So we use topK = 1000 (virtually infinite) so no pruning occurs in this test
    const base = new BaselineFullRecomputation(sim.schema, 1000);
    const laz = new LazarusXEngine(sim.schema, 1000);
    
    base.processEvidence(evidence);
    laz.processEvidence(evidence);
    
    const baseBest = base.getBestState();
    const lazBest = laz.getBestState();
    
    // The simple full-recomputation baseline models only constraint penalties;
    // the production engine also applies bounded fuzzy and source-confidence costs.
    // Compare the shared constraint metrics, then independently check the richer score.
    assertEq(lazBest.fatalViolations, baseBest.fatalViolations, 'Fatal violation count mismatch');
    assertEq(lazBest.resolvableViolations, baseBest.resolvableViolations, 'Resolvable violation count mismatch');
    const expectedEngineScore = 1.0 / (1.0 + lazBest.fatalViolations * 100 + lazBest.resolvableViolations +
        (lazBest.fuzzyPenalty ?? 0) + (lazBest.sourceReliabilityPenalty ?? 0));
    assertEq(lazBest.probabilityScore.toFixed(6), expectedEngineScore.toFixed(6), 'Enhanced heuristic score mismatch');

    // Also verify that the baseline calculation of global violations matches lazarus
    const lazViolations = lazBest.globalViolations;
    const baseViolations = baseBest.fatalViolations + baseBest.resolvableViolations;
    
    assertEq(lazViolations, baseViolations, 'Global Violations count mismatch');
});

runTest('Cross-table constraint isolated update', () => {
    const engine = new LazarusXEngine(schema, 10);
    // Insert into T2 first (causes FK violation)
    engine.processEvidence([ { id: 'e1', table: 'T2', recordId: 1, field: 't1_id', value: 99 } ]);
    const s1 = engine.getBestState();
    assertEq(s1.globalViolations, 1, 'FK should be violated');
    
    // Insert matching parent into T1 (resolves FK violation)
    engine.processEvidence([ { id: 'e2', table: 'T1', recordId: 99, field: 'id', value: 99 } ]);
    const s2 = engine.getBestState();
    // T1 has NOT_NULL name, so it creates 1 NOT_NULL violation, but resolves 1 FK violation. 
    // Wait, T1 `id` is primary, `name` is NOT_NULL. We didn't supply `name`, so it is missing.
    // FK resolved (-1), NOT_NULL added (+1) => total 1
    assertEq(s2.globalViolations, 1, 'FK resolved, NOT_NULL active');
});

runTest('State Deduplication', () => {
    const engine = new LazarusXEngine(schema, 5);
    const ev: Evidence[] = [
        { id: '1', table: 'T1', recordId: 1, field: 'val', value: 'A' },
        { id: '2', table: 'T1', recordId: 1, field: 'val', value: 'CONFLICT' },
        { id: '3', table: 'T1', recordId: 1, field: 'val', value: 'A' }, 
    ];
    engine.processEvidence(ev);
    // @ts-ignore
    const numStates = engine.states.length;
    assertEq(numStates, 2, 'Duplicate states were not pruned correctly');
});

console.log(`\nTest Summary: ${passCount} Passed, ${failCount} Failed.`);
if (failCount > 0) process.exitCode = 1;
