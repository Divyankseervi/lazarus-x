import type { Constraint, Schema, TableDefinition, ColumnDefinition } from './types';

export const LEGACY_DEMO_SCHEMA: Schema = {
    name: 'Workforce and orders demo',
    preset: 'legacy-workforce',
    tables: ['Department', 'Employee', 'Order'],
    tableDefinitions: [
        { name: 'Department', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'name', type: 'TEXT', required: true }] },
        { name: 'Employee', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'name', type: 'TEXT', required: true }, { name: 'departmentId', type: 'NUMBER' }] },
        { name: 'Order', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'amount', type: 'NUMBER', required: true }, { name: 'employeeId', type: 'NUMBER' }] },
    ],
    constraints: [
        { type: 'UNIQUE', table: 'Department', field: 'id' },
        { type: 'UNIQUE', table: 'Employee', field: 'id' },
        { type: 'UNIQUE', table: 'Order', field: 'id' },
        { type: 'NOT_NULL', table: 'Department', field: 'name' },
        { type: 'NOT_NULL', table: 'Employee', field: 'name' },
        { type: 'NOT_NULL', table: 'Order', field: 'amount' },
        { type: 'FOREIGN_KEY', table: 'Employee', field: 'departmentId', targetTable: 'Department', targetField: 'id' },
        { type: 'FOREIGN_KEY', table: 'Order', field: 'employeeId', targetTable: 'Employee', targetField: 'id' },
    ],
};

export const INCIDENT_RESPONSE_SCHEMA: Schema = {
    name: 'Incident response records',
    preset: 'incident-response',
    tables: ['Person', 'Device', 'Incident', 'Artifact', 'Observation'],
    tableDefinitions: [
        { name: 'Person', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'name', type: 'TEXT', required: true }, { name: 'role', type: 'TEXT' }] },
        { name: 'Device', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'hostname', type: 'TEXT', required: true }, { name: 'ownerId', type: 'NUMBER' }] },
        { name: 'Incident', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'title', type: 'TEXT', required: true }, { name: 'severity', type: 'TEXT', required: true }, { name: 'reportedBy', type: 'NUMBER' }] },
        { name: 'Artifact', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'sha256', type: 'TEXT', required: true }, { name: 'incidentId', type: 'NUMBER' }] },
        { name: 'Observation', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'artifactId', type: 'NUMBER' }, { name: 'analystId', type: 'NUMBER' }, { name: 'finding', type: 'TEXT', required: true }] },
    ],
    constraints: [
        { type: 'UNIQUE', table: 'Person', field: 'id' }, { type: 'NOT_NULL', table: 'Person', field: 'name' },
        { type: 'UNIQUE', table: 'Device', field: 'id' }, { type: 'NOT_NULL', table: 'Device', field: 'hostname' },
        { type: 'UNIQUE', table: 'Incident', field: 'id' }, { type: 'NOT_NULL', table: 'Incident', field: 'title' }, { type: 'NOT_NULL', table: 'Incident', field: 'severity' },
        { type: 'UNIQUE', table: 'Artifact', field: 'id' }, { type: 'NOT_NULL', table: 'Artifact', field: 'sha256' },
        { type: 'UNIQUE', table: 'Observation', field: 'id' }, { type: 'NOT_NULL', table: 'Observation', field: 'finding' },
        { type: 'FOREIGN_KEY', table: 'Device', field: 'ownerId', targetTable: 'Person', targetField: 'id' },
        { type: 'FOREIGN_KEY', table: 'Incident', field: 'reportedBy', targetTable: 'Person', targetField: 'id' },
        { type: 'FOREIGN_KEY', table: 'Artifact', field: 'incidentId', targetTable: 'Incident', targetField: 'id' },
        { type: 'FOREIGN_KEY', table: 'Observation', field: 'artifactId', targetTable: 'Artifact', targetField: 'id' },
        { type: 'FOREIGN_KEY', table: 'Observation', field: 'analystId', targetTable: 'Person', targetField: 'id' },
    ],
};


/** Schema used to rehydrate pre-schema-studio cases. It deliberately permits legacy
 * undeclared fields so existing ledgers replay without changing their semantics. */
export const LEGACY_COMPAT_SCHEMA: Schema = {
    name: 'Legacy workforce/orders schema',
    preset: 'legacy-compat',
    tables: ['Department', 'Employee', 'Order'],
    constraints: [
        { type: 'UNIQUE', table: 'Department', field: 'id' },
        { type: 'UNIQUE', table: 'Employee', field: 'id' },
        { type: 'UNIQUE', table: 'Order', field: 'id' },
        { type: 'NOT_NULL', table: 'Department', field: 'name' },
        { type: 'NOT_NULL', table: 'Employee', field: 'name' },
        { type: 'FOREIGN_KEY', table: 'Employee', field: 'departmentId', targetTable: 'Department', targetField: 'id' },
        { type: 'FOREIGN_KEY', table: 'Order', field: 'employeeId', targetTable: 'Employee', targetField: 'id' },
    ],
};

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;
const COLUMN_TYPES = new Set(['TEXT', 'NUMBER', 'BOOLEAN', 'ANY']);

export function normalizeSchemaDefinition(input: unknown, fallback: Schema = LEGACY_DEMO_SCHEMA): Schema {
    if (input === undefined || input === null) return cloneSchema(fallback);
    if (typeof input !== 'object' || Array.isArray(input)) throw new Error('Schema definition must be an object.');
    const raw = input as Record<string, unknown>;
    if (raw.tableDefinitions === undefined) {
        // Backward compatibility for older saved cases and API clients.
        if (raw.tables === undefined && raw.constraints === undefined) return cloneSchema(fallback);
        if (!Array.isArray(raw.tables) || !Array.isArray(raw.constraints)) throw new Error('Legacy schema must include tables and constraints arrays.');
        const candidate: Schema = { tables: raw.tables as string[], constraints: raw.constraints as Constraint[], name: typeof raw.name === 'string' ? raw.name : 'Legacy reconstruction schema' };
        assertSchema(candidate, false);
        return candidate;
    }
    if (!Array.isArray(raw.tableDefinitions) || raw.tableDefinitions.length < 1 || raw.tableDefinitions.length > 20) {
        throw new Error('A schema must define between 1 and 20 tables.');
    }
    const tableDefinitions: TableDefinition[] = raw.tableDefinitions.map((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`Table definition ${i + 1} must be an object.`);
        const table = item as Record<string, unknown>;
        if (typeof table.name !== 'string' || !IDENTIFIER.test(table.name)) throw new Error(`Table ${i + 1} needs a SQL-safe name (letters, digits, underscores; start with a letter).`);
        if (!Array.isArray(table.columns) || table.columns.length < 1 || table.columns.length > 80) throw new Error(`Table ${table.name} must contain 1 to 80 columns.`);
        const columns: ColumnDefinition[] = table.columns.map((columnItem, j) => {
            if (!columnItem || typeof columnItem !== 'object' || Array.isArray(columnItem)) throw new Error(`${table.name}: column ${j + 1} must be an object.`);
            const column = columnItem as Record<string, unknown>;
            if (typeof column.name !== 'string' || !IDENTIFIER.test(column.name) || column.name === '_recordId') throw new Error(`${table.name}: column ${j + 1} has an invalid/reserved name.`);
            if (typeof column.type !== 'string' || !COLUMN_TYPES.has(column.type)) throw new Error(`${table.name}.${column.name}: type must be TEXT, NUMBER, BOOLEAN or ANY.`);
            if (column.required !== undefined && typeof column.required !== 'boolean') throw new Error(`${table.name}.${column.name}: required must be a boolean.`);
            if (column.unique !== undefined && typeof column.unique !== 'boolean') throw new Error(`${table.name}.${column.name}: unique must be a boolean.`);
            return { name: column.name, type: column.type as ColumnDefinition['type'], ...(column.required === true ? { required: true } : {}), ...(column.unique === true ? { unique: true } : {}) };
        });
        if (new Set(columns.map(column => column.name)).size !== columns.length) throw new Error(`${table.name} contains duplicate column names.`);
        return { name: table.name, columns };
    });
    const tables = tableDefinitions.map(table => table.name);
    if (new Set(tables).size !== tables.length) throw new Error('Table names must be unique.');
    if (Array.isArray(raw.tables) && (raw.tables.length !== tables.length || raw.tables.some((table, i) => table !== tables[i]))) {
        throw new Error('The tables list must match the table definitions and their order.');
    }
    const constraints = Array.isArray(raw.constraints) ? [...raw.constraints as Constraint[]] : [];
    for (const table of tableDefinitions) for (const column of table.columns) {
        if (column.required && !constraints.some(c => c.type === 'NOT_NULL' && c.table === table.name && c.field === column.name)) {
            constraints.push({ type: 'NOT_NULL', table: table.name, field: column.name });
        }
        if (column.unique && !constraints.some(c => c.type === 'UNIQUE' && c.table === table.name && c.field === column.name)) {
            constraints.push({ type: 'UNIQUE', table: table.name, field: column.name });
        }
    }
    const schema: Schema = {
        name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 100) : 'Custom reconstruction schema',
        preset: typeof raw.preset === 'string' ? raw.preset.slice(0, 64) : 'custom',
        tables,
        tableDefinitions,
        constraints,
    };
    assertSchema(schema, true);
    return schema;
}

function assertSchema(schema: Schema, requireDeclaredColumns: boolean): void {
    if (!Array.isArray(schema.tables) || schema.tables.length < 1 || schema.tables.length > 20 || schema.tables.some(t => typeof t !== 'string' || !IDENTIFIER.test(t))) {
        throw new Error('Schema tables are invalid; use 1 to 20 unique SQL-safe table names.');
    }
    if (new Set(schema.tables).size !== schema.tables.length) throw new Error('Table names must be unique.');
    if (!Array.isArray(schema.constraints) || schema.constraints.length > 500) throw new Error('Schema constraints must be an array of at most 500 items.');
    if (schema.tableDefinitions && requireDeclaredColumns) {
        const defNames = schema.tableDefinitions.map(table => table.name);
        if (defNames.length !== schema.tables.length || defNames.some((name, index) => name !== schema.tables[index])) throw new Error('Table definitions do not match schema tables.');
        for (const table of schema.tableDefinitions) if (!table.columns.some(column => column.unique) && !schema.constraints.some(constraint => constraint.type === 'UNIQUE' && constraint.table === table.name)) throw new Error(`${table.name} must declare at least one unique key field.`);
    }
    const defined = new Map((schema.tableDefinitions ?? []).map(table => [table.name, new Set(table.columns.map(column => column.name))]));
    const ids = new Set<string>();
    for (const [index, constraint] of schema.constraints.entries()) {
        if (!constraint || !['UNIQUE', 'NOT_NULL', 'FOREIGN_KEY'].includes(constraint.type) || !schema.tables.includes(constraint.table) || typeof constraint.field !== 'string' || !IDENTIFIER.test(constraint.field)) {
            throw new Error(`Constraint ${index + 1} is invalid.`);
        }
        if (requireDeclaredColumns && !defined.get(constraint.table)?.has(constraint.field)) throw new Error(`Constraint refers to unknown field ${constraint.table}.${constraint.field}.`);
        const id = constraint.id || `${constraint.type}:${constraint.table}:${constraint.field}:${constraint.targetTable ?? ''}:${constraint.targetField ?? ''}`;
        if (ids.has(id)) throw new Error(`Duplicate constraint: ${id}`);
        ids.add(id);
        if (constraint.type === 'FOREIGN_KEY') {
            if (!constraint.targetTable || !schema.tables.includes(constraint.targetTable) || !constraint.targetField || !IDENTIFIER.test(constraint.targetField)) throw new Error(`Foreign key ${id} needs a valid target table and target field.`);
            if (requireDeclaredColumns && !defined.get(constraint.targetTable)?.has(constraint.targetField)) throw new Error(`Foreign key target ${constraint.targetTable}.${constraint.targetField} is not defined.`);
            if (requireDeclaredColumns) {
                const sourceColumn = schema.tableDefinitions?.find(table => table.name === constraint.table)?.columns.find(column => column.name === constraint.field);
                const targetColumn = schema.tableDefinitions?.find(table => table.name === constraint.targetTable)?.columns.find(column => column.name === constraint.targetField);
                if (!targetColumn?.unique && !schema.constraints.some(item => item.type === 'UNIQUE' && item.table === constraint.targetTable && item.field === constraint.targetField)) throw new Error(`Foreign key target ${constraint.targetTable}.${constraint.targetField} must be marked unique.`);
                if (sourceColumn && targetColumn && sourceColumn.type !== 'ANY' && targetColumn.type !== 'ANY' && sourceColumn.type !== targetColumn.type) {
                    throw new Error(`Foreign key type mismatch: ${constraint.table}.${constraint.field} does not match ${constraint.targetTable}.${constraint.targetField}.`);
                }
            }
        }
    }
}

function cloneSchema(schema: Schema): Schema {
    return JSON.parse(JSON.stringify(schema)) as Schema;
}
