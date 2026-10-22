import { Schema, Evidence, CandidateState } from './types';

export class BaselineFullRecomputation {
    private schema: Schema;
    private states: CandidateState[] = [];
    public recomputationCount = 0;

    constructor(schema: Schema, public topK: number = 5) {
        this.schema = schema;
        const initialData: any = {};
        for (const t of schema.tables) initialData[t] = [];
        this.states.push({ 
            id: 'S1', 
            data: initialData, 
            probabilityScore: 1.0, 
            isActive: true,
            globalViolations: 0,
            fatalViolations: 0,
            resolvableViolations: 0,
            constraintCache: {}
        });
    }

    public processEvidence(evidence: Evidence[]) {
        for (const ev of evidence) {
            this.applyEvidence(ev);
            this.recomputeAll();
        }
    }

    private applyEvidence(ev: Evidence) {
        const newStates: CandidateState[] = [];
        
        for (const state of this.states) {
            if (!state.isActive) continue;

            const tableData = state.data[ev.table];
            const existingRecord = tableData.find(r => r._recordId === ev.recordId);

            if (!existingRecord) {
                const stateClone = this.cloneState(state);
                stateClone.id = state.id + '-A';
                stateClone.data[ev.table].push({ _recordId: ev.recordId, [ev.field]: ev.value });
                newStates.push(stateClone);
            } else if (existingRecord[ev.field] === undefined) {
                existingRecord[ev.field] = ev.value;
                newStates.push(state);
            } else if (existingRecord[ev.field] !== ev.value) {
                const stateClone = this.cloneState(state);
                stateClone.id = state.id + '-B';
                
                const recToUpdate = stateClone.data[ev.table].find(r => r._recordId === ev.recordId)!;
                recToUpdate[ev.field] = ev.value;
                
                newStates.push(state); 
                newStates.push(stateClone); 
            } else {
                newStates.push(state); 
            }
        }
        
        const uniqueStates = new Map<string, CandidateState>();
        for (const s of newStates) {
            const hash = JSON.stringify(s.data);
            if (!uniqueStates.has(hash)) {
                uniqueStates.set(hash, s);
            }
        }
        this.states = Array.from(uniqueStates.values());
    }

    private recomputeAll() {
        for (const state of this.states) {
            if (!state.isActive) continue;
            let fatal = 0;
            let resolvable = 0;

            for (const constraint of this.schema.constraints) {
                this.recomputationCount++; 
                if (constraint.type === 'NOT_NULL') {
                    for (const row of state.data[constraint.table]) {
                        if (row[constraint.field] === null || row[constraint.field] === undefined) fatal++;
                    }
                } else if (constraint.type === 'FOREIGN_KEY') {
                    const targetTableData = state.data[constraint.targetTable!];
                    for (const row of state.data[constraint.table]) {
                        if (row[constraint.field] !== undefined && row[constraint.field] !== null) {
                            const exists = targetTableData.find(tr => tr[constraint.targetField!] === row[constraint.field]);
                            if (!exists) resolvable++;
                        }
                    }
                } else if (constraint.type === 'UNIQUE') {
                    const seen = new Set();
                    for (const row of state.data[constraint.table]) {
                        const val = row[constraint.field];
                        if (val !== undefined && val !== null) {
                            if (seen.has(val)) fatal++;
                            seen.add(val);
                        }
                    }
                }
            }
            state.fatalViolations = fatal;
            state.resolvableViolations = resolvable;
            state.globalViolations = fatal + resolvable;
            state.probabilityScore = 1.0 / (1.0 + (fatal * 100) + resolvable);
        }
        
        // Exact same Delayed Pruning logic as Lazarus-X for fair comparison
        const sortedStates = this.states.sort((a, b) => {
            if (a.fatalViolations !== b.fatalViolations) {
                return a.fatalViolations - b.fatalViolations;
            }
            return a.resolvableViolations - b.resolvableViolations;
        });

        const SOFT_BOUND = Math.max(this.topK * 4, 20);
        let retained = [];
        for (let i = 0; i < sortedStates.length; i++) {
            if (i < this.topK) {
                retained.push(sortedStates[i]);
            } else if (sortedStates[i].fatalViolations === 0 && i < SOFT_BOUND) {
                retained.push(sortedStates[i]);
            } else {
                break;
            }
        }
        this.states = retained;
    }

    private cloneState(state: CandidateState): CandidateState {
        return JSON.parse(JSON.stringify(state));
    }

    public getBestState() {
        return this.states.sort((a, b) => b.probabilityScore - a.probabilityScore)[0];
    }
}
