import { Schema, DomainRecord, Evidence } from './types';

export class Simulator {
    public schema: Schema;
    private groundTruth: Record<string, DomainRecord[]> = {};
    private seed: number;

    constructor(seed: number = 42) {
        this.seed = seed;
        this.schema = {
            tables: ['Departments', 'Employees', 'Orders'],
            constraints: [
                { type: 'UNIQUE', table: 'Departments', field: 'id' },
                { type: 'UNIQUE', table: 'Employees', field: 'id' },
                { type: 'UNIQUE', table: 'Orders', field: 'id' },
                { type: 'FOREIGN_KEY', table: 'Employees', field: 'departmentId', targetTable: 'Departments', targetField: 'id' },
                { type: 'FOREIGN_KEY', table: 'Orders', field: 'employeeId', targetTable: 'Employees', targetField: 'id' },
                { type: 'NOT_NULL', table: 'Employees', field: 'name' }
            ]
        };
    }

    private random(): number {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    public generateGroundTruth(numDepartments = 5, employeesPerDept = 10, ordersPerEmployee = 5) {
        this.groundTruth['Departments'] = [];
        this.groundTruth['Employees'] = [];
        this.groundTruth['Orders'] = [];
        
        let empId = 1;
        let orderId = 1;

        for (let d = 1; d <= numDepartments; d++) {
            this.groundTruth['Departments'].push({ id: d, name: `Dept ${d}` });
            for (let e = 1; e <= employeesPerDept; e++) {
                this.groundTruth['Employees'].push({ id: empId, name: `Emp ${empId}`, departmentId: d });
                for (let o = 1; o <= ordersPerEmployee; o++) {
                    this.groundTruth['Orders'].push({ id: orderId, employeeId: empId, amount: Math.floor(this.random() * 100) });
                    orderId++;
                }
                empId++;
            }
        }
    }

    public degradeAndGenerateEvidence(corruptionRate: number): Evidence[] {
        const evidence: Evidence[] = [];
        let evId = 1;

        for (const table of this.schema.tables) {
            for (const record of this.groundTruth[table]) {
                for (const field of Object.keys(record)) {
                    if (field === 'id') continue; 

                    let value = record[field];
                    if (this.random() < corruptionRate) {
                        value = this.random() < 0.5 ? null : (typeof value === 'number' ? -1 : 'CORRUPTED');
                    }
                    evidence.push({ id: `EV-${evId++}`, table, recordId: record.id, field, value });

                    if (this.random() < corruptionRate / 2) {
                        evidence.push({ id: `EV-${evId++}`, table, recordId: record.id, field, value: 'CONFLICT' });
                    }
                }
            }
        }
        
        return evidence.sort(() => this.random() - 0.5);
    }

    public getGroundTruth() {
        return this.groundTruth;
    }
}
