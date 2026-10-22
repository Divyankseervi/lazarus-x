import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { LazarusXEngine, SearchSpaceLimitError } from './lazarus';
import { verifyProvenanceChain } from './provenance';
import { Evidence, Schema } from './types';

interface WorkloadResult {
    employees: number;
    departments: number;
    evidenceFragments: number;
    runs: number;
    p50Ms: number;
    p95Ms: number;
    p50FragmentsPerSecond: number;
    candidateStates: number;
    propagationRevisions: number;
    provenanceVerified: boolean;
}

function buildRelationWorkload(employeeCount: number): { schema: Schema; evidence: Evidence[]; departments: number } {
    const departmentCount = Math.max(1, Math.ceil(employeeCount / 10));
    const schema: Schema = {
        tables: ['Employee', 'Department'],
        constraints: [{
            type: 'FOREIGN_KEY',
            table: 'Employee',
            field: 'departmentId',
            targetTable: 'Department',
            targetField: 'id',
            targetEvidenceComplete: true,
        }],
    };
    const evidence: Evidence[] = [];

    // Deliberately place child evidence before parent key evidence. Each record
    // contains independent identifying facts and a reference into the parent set.
    for (let id = 0; id < employeeCount; id++) {
        evidence.push(
            { id: `employee-${id}-name`, table: 'Employee', recordId: id, field: 'name', value: `Investigator ${id}` },
            { id: `employee-${id}-email`, table: 'Employee', recordId: id, field: 'email', value: `investigator-${id}@example.test` },
            { id: `employee-${id}-department`, table: 'Employee', recordId: id, field: 'departmentId', value: id % departmentCount },
        );
    }
    for (let id = 0; id < departmentCount; id++) {
        evidence.push({ id: `department-${id}-id`, table: 'Department', recordId: id, field: 'id', value: id });
    }
    return { schema, evidence, departments: departmentCount };
}

function runWorkload(employeeCount: number): Omit<WorkloadResult, 'runs' | 'p50Ms' | 'p95Ms' | 'p50FragmentsPerSecond'> & { elapsedMs: number } {
    const workload = buildRelationWorkload(employeeCount);
    const engine = new LazarusXEngine(workload.schema);
    const start = performance.now();
    engine.processEvidence(workload.evidence, { actorId: 'load-harness', receivedAt: new Date('2026-01-01T00:00:00.000Z') });
    const elapsedMs = performance.now() - start;
    const provenance = engine.getProvenanceEntries();
    const head = engine.getProvenanceHead();
    const verification = verifyProvenanceChain(provenance, head.hash, head.sequence);
    const best = engine.getBestState();

    assert.equal(engine.states.length, 1, 'single-valued evidence should materialize exactly one candidate');
    assert.equal(best.fatalViolations, 0, 'all generated foreign keys should be supported');
    assert.equal(best.resolvableViolations, 0, 'all generated foreign keys should be supported');
    assert.equal(engine.getSearchDiagnostics().status, 'consistent', 'propagation should reach a consistent fixed point');
    assert.equal(provenance.length, workload.evidence.length, 'every accepted fragment should produce provenance');
    assert.equal(verification.valid, true, verification.error ?? 'provenance chain should verify');

    return {
        employees: employeeCount,
        departments: workload.departments,
        evidenceFragments: workload.evidence.length,
        elapsedMs: Number(elapsedMs.toFixed(2)),
        candidateStates: engine.states.length,
        propagationRevisions: engine.getSearchDiagnostics().revisions,
        provenanceVerified: verification.valid,
    };
}

function measureWorkload(employeeCount: number, runs = 5): WorkloadResult {
    const samples = Array.from({ length: runs }, () => runWorkload(employeeCount));
    const sortedTimes = samples.map(sample => sample.elapsedMs).sort((a, b) => a - b);
    const percentile = (fraction: number) => sortedTimes[Math.max(0, Math.ceil(sortedTimes.length * fraction) - 1)]!;
    const sample = samples[0]!;
    const p50Ms = percentile(0.5);
    return {
        employees: sample.employees,
        departments: sample.departments,
        evidenceFragments: sample.evidenceFragments,
        runs,
        p50Ms: Number(p50Ms.toFixed(2)),
        p95Ms: Number(percentile(0.95).toFixed(2)),
        p50FragmentsPerSecond: p50Ms === 0 ? 0 : Math.round(sample.evidenceFragments / (p50Ms / 1000)),
        candidateStates: sample.candidateStates,
        propagationRevisions: sample.propagationRevisions,
        provenanceVerified: samples.every(result => result.provenanceVerified),
    };
}

function verifyOverloadIsAtomic(): void {
    const engine = new LazarusXEngine({ tables: ['Person'], constraints: [] }, 5, 100);
    engine.processEvidence([{ id: 'anchor', table: 'Person', recordId: 1, field: 'id', value: 1 }]);
    const before = {
        states: engine.states.length,
        head: engine.getProvenanceHead(),
        entries: engine.getProvenanceEntries().length,
    };
    const overLimit: Evidence[] = [];
    for (let index = 0; index < 7; index++) {
        overLimit.push(
            { id: `over-${index}-a`, table: 'Person', recordId: 1, field: `ambiguous-${index}`, value: 'A' },
            { id: `over-${index}-b`, table: 'Person', recordId: 1, field: `ambiguous-${index}`, value: 'B' },
        );
    }

    assert.throws(() => engine.processEvidence(overLimit), SearchSpaceLimitError);
    assert.equal(engine.states.length, before.states, 'over-limit materialization must preserve the published candidate set');
    assert.deepEqual(engine.getProvenanceHead(), before.head, 'over-limit materialization must preserve the committed ledger head');
    assert.equal(engine.getProvenanceEntries().length, before.entries, 'over-limit materialization must not append partial provenance');
}

// Warm up V8 separately so the reported scenarios include less first-run JIT noise.
runWorkload(50);
const results = [100, 250, 500].map(employeeCount => measureWorkload(employeeCount));
verifyOverloadIsAtomic();
process.stdout.write(`${JSON.stringify({ note: 'Synthetic engine microbenchmark; timings are observational and are not production SLA claims.', scenarios: results, overload: { rejectedAtomically: true, candidateLimit: 100 } }, null, 2)}\n`);
