declare var process: any;
import { LazarusXEngine } from './lazarus';
import { BaselineFullRecomputation } from './baselines';
import { Schema } from './types';

const testSchema: Schema = {
    tables: ['Parent', 'Child'],
    constraints: [
        { type: 'UNIQUE', table: 'Parent', field: 'id' },
        { type: 'NOT_NULL', table: 'Child', field: 'name' },
        { type: 'FOREIGN_KEY', table: 'Child', field: 'parentId', targetTable: 'Parent', targetField: 'id' }
    ]
};

let failCount = 0;

function runTest() {
    console.log("=== LAZARUS-X INDEPENDENT CORRECTNESS AUDIT ===");

    const laz = new LazarusXEngine(testSchema, 10);
    const base = new BaselineFullRecomputation(testSchema, 10);

    // 1. Out of order evidence (Child arrives before Parent)
    console.log("\nTEST 1: Out of order evidence (Child before Parent)");
    const ev1 = { id: '1', table: 'Child', recordId: 101, field: 'parentId', value: 1 };
    laz.processEvidence([ev1]);
    base.processEvidence([ev1]);

    const lazState1 = laz.getBestState();
    const baseState1 = base.getBestState();

    console.log(`Lazarus Fatal: ${lazState1.fatalViolations}, Resolvable: ${lazState1.resolvableViolations}, Score: ${lazState1.probabilityScore}`);
    console.log(`Baseline Fatal: ${baseState1.fatalViolations}, Resolvable: ${baseState1.resolvableViolations}, Score: ${baseState1.probabilityScore}`);

    if (lazState1.resolvableViolations !== baseState1.resolvableViolations || lazState1.probabilityScore !== baseState1.probabilityScore) {
        failCount++;
        console.error("❌ TEST 1 FAILED: Delta-tracking does not match Full Recomputation.");
    } else {
        console.log("✅ TEST 1 PASSED: Selected metrics match (resolvable violations and score).");
    }

    // 2. Parent arrives (resolving the missing FK)
    console.log("\nTEST 2: Missing Parent arrives, resolving constraint");

    const ev2 = { id: '2', table: 'Parent', recordId: 1, field: 'id', value: 1 };
    const ev2Name = { id: '2-name', table: 'Parent', recordId: 1, field: 'name', value: 'Alpha' };

    laz.processEvidence([ev2, ev2Name]);
    base.processEvidence([ev2, ev2Name]);



    const lazState2 = laz.getBestState();
    const baseState2 = base.getBestState();
    console.log(`Lazarus Resolvable: ${lazState2.resolvableViolations}`);
    console.log(`Baseline Resolvable: ${baseState2.resolvableViolations}`);
    if (lazState2.resolvableViolations !== 0) {
        failCount++;
        console.error("❌ TEST 2 FAILED: Engine failed to resolve foreign key dynamically.");
    }
    else console.log("✅ TEST 2 PASSED: Foreign Key constraint resolved correctly.");

    // 3. Contradictory Evidence (UNIQUE violation)
    console.log("\nTEST 3: Contradictory Evidence (UNIQUE violation)");
    const ev3 = { id: '3', table: 'Parent', recordId: 1, field: 'id', value: 2 }; // This violates uniqueness because recordId 1 is already bound to Parent ID 1 conceptually? No, wait. 
    // In our evidence model, recordId is the internal PK. If we insert two different 'id' values for the same record? No, if we insert the same 'id' for two different recordIds!
    const ev4a = { id: '4a', table: 'Parent', recordId: 2, field: 'id', value: 99 };
    const ev4b = { id: '4b', table: 'Parent', recordId: 3, field: 'id', value: 99 };
    laz.processEvidence([ev4a]);
    laz.processEvidence([ev4b]);
    const lazState3 = laz.getBestState();
    console.log(`Lazarus Fatal: ${lazState3.fatalViolations}`);
    if (lazState3.fatalViolations > 0) console.log("✅ TEST 3 PASSED: Unique collision successfully flagged as Fatal.");
    else {
        failCount++;
        console.error("❌ TEST 3 FAILED: Unique collision ignored.");
    }

    // 4. Heuristic vs Probability
    console.log("\nTEST 4: Candidate Score Interpretation");
    console.log("Candidate scores are heuristic penalties, not calibrated Bayesian probabilities. Ambiguity Reduction uses relative entropy across the heuristic weights.");
    console.log("✅ TEST 4 CONCLUDED: Scores are heuristics.");

    // 5. Ambiguity Reduction (Info Gain)
    console.log("\nTEST 5: Ambiguity Reduction on Contradictory Child Name");
    const ev5a = { id: '5a', table: 'Child', recordId: 102, field: 'name', value: 'Alice' };
    const ev5b = { id: '5b', table: 'Child', recordId: 102, field: 'name', value: 'Bob' };
    laz.processEvidence([ev5a, ev5b]);

    const rec = laz.recommendNextEvidence();
    if (rec && rec.table === 'Child' && rec.recordId === 102 && rec.field === 'name') {
        console.log(`✅ TEST 5 PASSED: Ambiguity Reduction correctly isolated disputed field with expected gain: ${rec.expectedInformationGain} bits.`);
    } else {
        failCount++;
        console.error("❌ TEST 5 FAILED: Ambiguity reduction failed to target the contradiction.", rec);
    }

    console.log(`\nAudit Summary: ${failCount === 0 ? 'passed' : 'failed'} (${failCount} failed checks).`);
    if (failCount > 0) process.exitCode = 1;
}
runTest();
