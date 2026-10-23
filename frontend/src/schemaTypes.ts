export type ColumnType = 'TEXT' | 'NUMBER' | 'BOOLEAN' | 'ANY';
export interface ColumnDefinition {
  name: string;
  type: ColumnType;
  required?: boolean;
  unique?: boolean;
}
export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
}
export interface ForeignKeyDefinition {
  id?: string;
  type: 'FOREIGN_KEY';
  table: string;
  field: string;
  targetTable: string;
  targetField: string;
  match?: 'SIMPLE' | 'FULL';
}
export interface CaseSchema {
  name: string;
  preset: string;
  tables: string[];
  tableDefinitions: TableDefinition[];
  constraints: Array<{
    id?: string;
    type: 'UNIQUE' | 'NOT_NULL' | 'FOREIGN_KEY';
    table: string;
    field: string;
    targetTable?: string;
    targetField?: string;
    fields?: string[];
    targetFields?: string[];
    match?: 'SIMPLE' | 'FULL';
  }>;
}

function build(name: string, preset: string, tableDefinitions: TableDefinition[], foreignKeys: ForeignKeyDefinition[]): CaseSchema {
  const constraints: CaseSchema['constraints'] = [];
  for (const table of tableDefinitions) for (const column of table.columns) {
    if (column.required) constraints.push({ type: 'NOT_NULL', table: table.name, field: column.name });
    if (column.unique) constraints.push({ type: 'UNIQUE', table: table.name, field: column.name });
  }
  constraints.push(...foreignKeys.map(({ id, type, table, field, targetTable, targetField, match }) => ({ id, type, table, field, targetTable, targetField, match })));
  return { name, preset, tables: tableDefinitions.map(table => table.name), tableDefinitions, constraints };
}

export function createPresetSchema(preset: 'incident-response' | 'workforce-orders' | 'blank'): CaseSchema {
  if (preset === 'workforce-orders') return build('Workforce and orders', preset, [
    { name: 'Department', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'name', type: 'TEXT', required: true }] },
    { name: 'Employee', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'name', type: 'TEXT', required: true }, { name: 'departmentId', type: 'NUMBER' }] },
    { name: 'Order', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'amount', type: 'NUMBER', required: true }, { name: 'employeeId', type: 'NUMBER' }] },
  ], [
    { type: 'FOREIGN_KEY', table: 'Employee', field: 'departmentId', targetTable: 'Department', targetField: 'id' },
    { type: 'FOREIGN_KEY', table: 'Order', field: 'employeeId', targetTable: 'Employee', targetField: 'id' },
  ]);
  if (preset === 'blank') return build('Custom relational reconstruction', preset, [
    { name: 'Record', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'value', type: 'TEXT' }] },
  ], []);
  return build('Incident response records', 'incident-response', [
    { name: 'Person', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'name', type: 'TEXT', required: true }, { name: 'role', type: 'TEXT' }] },
    { name: 'Device', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'hostname', type: 'TEXT', required: true }, { name: 'ownerId', type: 'NUMBER' }] },
    { name: 'Incident', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'title', type: 'TEXT', required: true }, { name: 'severity', type: 'TEXT', required: true }, { name: 'reportedBy', type: 'NUMBER' }] },
    { name: 'Artifact', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'sha256', type: 'TEXT', required: true }, { name: 'incidentId', type: 'NUMBER' }] },
    { name: 'Observation', columns: [{ name: 'id', type: 'NUMBER', required: true, unique: true }, { name: 'artifactId', type: 'NUMBER' }, { name: 'analystId', type: 'NUMBER' }, { name: 'finding', type: 'TEXT', required: true }] },
  ], [
    { type: 'FOREIGN_KEY', table: 'Device', field: 'ownerId', targetTable: 'Person', targetField: 'id' },
    { type: 'FOREIGN_KEY', table: 'Incident', field: 'reportedBy', targetTable: 'Person', targetField: 'id' },
    { type: 'FOREIGN_KEY', table: 'Artifact', field: 'incidentId', targetTable: 'Incident', targetField: 'id' },
    { type: 'FOREIGN_KEY', table: 'Observation', field: 'artifactId', targetTable: 'Artifact', targetField: 'id' },
    { type: 'FOREIGN_KEY', table: 'Observation', field: 'analystId', targetTable: 'Person', targetField: 'id' },
  ]);
}

export function schemaWithConstraints(name: string, preset: string, tables: TableDefinition[], foreignKeys: ForeignKeyDefinition[]): CaseSchema {
  return build(name, preset, tables, foreignKeys);
}

export function validateCaseSchema(schema: CaseSchema): string | null {
  const identifier = /^[A-Za-z][A-Za-z0-9_]{0,62}$/;
  if (!schema.name.trim()) return 'Give this reconstruction a name.';
  if (schema.name.length > 100) return 'Case name must be 100 characters or fewer.';
  if (schema.tableDefinitions.length < 1 || schema.tableDefinitions.length > 20) return 'Define between 1 and 20 relations.';
  const names = schema.tableDefinitions.map(table => table.name);
  if (names.some(name => !identifier.test(name))) return 'Relation names must start with a letter and contain only letters, numbers or underscores.';
  if (new Set(names).size !== names.length) return 'Relation names must be unique.';
  for (const table of schema.tableDefinitions) {
    if (table.columns.length < 1 || table.columns.length > 80) return `${table.name} needs 1–80 fields.`;
    const columns = table.columns.map(column => column.name);
    if (columns.some(name => !identifier.test(name) || name === '_recordId')) return `${table.name} contains an invalid or reserved field name.`;
    if (new Set(columns).size !== columns.length) return `${table.name} contains duplicate field names.`;
    if (!table.columns.some(column => column.unique) && !schema.constraints.some(constraint => constraint.type === 'UNIQUE' && constraint.table === table.name)) return `${table.name} must declare at least one unique key field.`;
  }
  for (const foreignKey of schema.constraints.filter(constraint => constraint.type === 'FOREIGN_KEY')) {
    const source = schema.tableDefinitions.find(table => table.name === foreignKey.table);
    const target = schema.tableDefinitions.find(table => table.name === foreignKey.targetTable);
    const sourceColumn = source?.columns.find(column => column.name === foreignKey.field);
    const targetColumn = target?.columns.find(column => column.name === foreignKey.targetField);
    if (!sourceColumn) return `Foreign key source ${foreignKey.table}.${foreignKey.field} is not defined.`;
    if (!targetColumn) return `Foreign key target ${foreignKey.targetTable}.${foreignKey.targetField} is not defined.`;
    if (!targetColumn.unique && !schema.constraints.some(constraint => constraint.type === 'UNIQUE' && constraint.table === foreignKey.targetTable && constraint.field === foreignKey.targetField)) return `Foreign key target ${foreignKey.targetTable}.${foreignKey.targetField} must be marked unique.`;
    if (sourceColumn.type !== 'ANY' && targetColumn.type !== 'ANY' && sourceColumn.type !== targetColumn.type) return `Foreign key ${foreignKey.table}.${foreignKey.field} type must match ${foreignKey.targetTable}.${foreignKey.targetField}.`;
  }
  return null;
}

export function hasWalkthroughConflictTarget(schema: CaseSchema): boolean {
  return schema.tableDefinitions.some(table => table.columns.some(column =>
    !column.unique && !schema.constraints.some(constraint => constraint.type === 'UNIQUE' && constraint.table === table.name && constraint.field === column.name)
  ));
}

export function createWalkthroughEvidence(schema: CaseSchema): Array<{ table: string; recordId: number; field: string; value: string | number | boolean | null; confidence: number; sourceRef?: string }> {
  const definitions = schema.tableDefinitions ?? [];
  const isUnique = (table: string, column: ColumnDefinition) => !!column.unique || schema.constraints.some(constraint => constraint.type === 'UNIQUE' && constraint.table === table && constraint.field === column.name);
  const conflictTarget = definitions.flatMap(table => table.columns
    .filter(column => !isUnique(table.name, column))
    .map(column => ({ table, column })))
    .find(target => target.column.type === 'TEXT' || target.column.type === 'NUMBER' || target.column.type === 'BOOLEAN' || target.column.type === 'ANY');
  const rows = new Map<string, { recordId: number; values: Record<string, string | number | boolean | null> }>();
  definitions.forEach((table, index) => {
    const recordId = index + 1;
    const values: Record<string, string | number | boolean | null> = {};
    for (const column of table.columns) {
      if (column.name.toLowerCase() === 'id' || isUnique(table.name, column)) {
        values[column.name] = column.type === 'NUMBER' ? recordId : column.type === 'BOOLEAN' ? true : column.type === 'TEXT' ? `${table.name}-${column.name}-${recordId}` : recordId;
      } else if (column.required || (conflictTarget?.table.name === table.name && conflictTarget.column.name === column.name)) {
        values[column.name] = column.name.toLowerCase() === 'sha256' ? '0'.repeat(64) : schema.preset === 'incident-response' && table.name === 'Person' && column.name === 'name' ? 'Asha Rao' : column.type === 'NUMBER' ? recordId * 10 : column.type === 'BOOLEAN' ? true : column.type === 'TEXT' ? `${table.name} ${column.name} ${recordId}` : `sample-${recordId}`;
      }
    }
    rows.set(table.name, { recordId, values });
  });
  for (const constraint of schema.constraints) {
    if (constraint.type !== 'FOREIGN_KEY' || !constraint.targetTable) continue;
    const source = rows.get(constraint.table);
    const target = rows.get(constraint.targetTable);
    const sourceField = constraint.field;
    const targetField = constraint.targetField ?? 'id';
    if (source && target && sourceField && target.values[targetField] !== undefined) source.values[sourceField] = target.values[targetField]!;
  }
  const evidence: Array<{ table: string; recordId: number; field: string; value: string | number | boolean | null; confidence: number; sourceRef?: string }> = [];
  for (const table of definitions) {
    const row = rows.get(table.name)!;
    for (const [field, value] of Object.entries(row.values)) evidence.push({ table: table.name, recordId: row.recordId, field, value, confidence: 0.9, sourceRef: 'synthetic-walkthrough' });
  }
  // Introduce a type-correct contradiction on a non-unique field, including
  // optional fields when they are the only suitable ambiguity target.
  if (conflictTarget) {
    const row = rows.get(conflictTarget.table.name)!;
    const field = conflictTarget.column.name;
    const existing = row.values[field];
    let alternative: string | number | boolean | null;
    if (conflictTarget.column.type === 'NUMBER') alternative = typeof existing === 'number' ? existing + 1 : row.recordId + 1;
    else if (conflictTarget.column.type === 'BOOLEAN') alternative = existing === true ? false : true;
    else if (conflictTarget.column.type === 'TEXT') alternative = schema.preset === 'incident-response' && conflictTarget.table.name === 'Person' && field === 'name' ? 'A. Rao' : `${String(existing ?? 'observed value')} (alternate)`;
    else alternative = typeof existing === 'number' ? existing + 1 : typeof existing === 'boolean' ? !existing : `${String(existing ?? 'observed value')} (alternate)`;
    evidence.push({ table: conflictTarget.table.name, recordId: row.recordId, field, value: alternative, confidence: 0.35, sourceRef: 'synthetic-walkthrough' });
  }
  return evidence;
}
