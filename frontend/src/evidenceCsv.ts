import type { CaseSchema } from './schemaTypes';

export interface ImportedEvidenceFragment {
  table: string;
  recordId: number;
  field: string;
  value: string | number | boolean | null;
  confidence: number;
  sourceRef?: string;
  sourceSha256?: string;
}

export function parseCsvMatrix(source: string): string[][] {
  if (new TextEncoder().encode(source).byteLength > 512 * 1024) throw new Error('CSV file must be 512 KiB or smaller.');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let afterQuote = false;

  const finishCell = () => { row.push(cell); cell = ''; afterQuote = false; };
  const finishRow = () => {
    finishCell();
    if (row.some(value => value.trim() !== '')) rows.push(row);
    row = [];
    if (rows.length > 251) throw new Error('CSV can contain at most 250 evidence rows plus its header.');
  };

  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; afterQuote = true; }
      else cell += char;
      continue;
    }

    if (afterQuote) {
      if (char === ',') { finishCell(); continue; }
      if (char === '\n' || char === '\r') {
        if (char === '\r' && source[i + 1] === '\n') i++;
        finishRow();
        continue;
      }
      throw new Error('CSV contains unexpected characters after a closing quote. Quote fields containing commas, quotes or newlines.');
    }

    if (char === '"') {
      if (cell.length !== 0) throw new Error('CSV contains a quote inside an unquoted field.');
      quoted = true;
    } else if (char === ',') finishCell();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && source[i + 1] === '\n') i++;
      finishRow();
    } else cell += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted field.');
  if (cell.length > 0 || row.length > 0 || afterQuote) finishRow();
  if (rows.length < 2) throw new Error('CSV needs a header and at least one evidence row.');
  if (rows.length > 251) throw new Error('CSV can contain at most 250 evidence rows plus its header.');
  // UTF-8 CSVs exported by spreadsheet tools frequently start with a BOM.
  rows[0]![0] = rows[0]![0]!.replace(/^\uFEFF/, '');
  const width = rows[0]!.length;
  if (rows.some(item => item.length !== width)) throw new Error('CSV rows must all have the same number of columns. Check commas and quoted values.');
  return rows;
}

function parseScalar(text: string, type: string | undefined): string | number | boolean | null {
  const value = text.trim();
  if (value === '') return null;
  // In a typed TEXT column, the literal word 'null' is text. ANY/JSON columns
  // may use the JSON token null to represent a NULL observation.
  if (type === 'TEXT') return text;
  if (value.toLowerCase() === 'null') return null;
  if (type === 'NUMBER') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) throw new Error(`Expected a number, got “${value}”.`);
    return numeric;
  }
  if (type === 'BOOLEAN') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
    throw new Error(`Expected true or false, got “${value}”.`);
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed === 'string' || typeof parsed === 'boolean') return parsed;
    if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed;
  } catch { /* unquoted free text remains a string for ANY / legacy fields */ }
  return text;
}

export function parseEvidenceCsv(source: string, schema: CaseSchema): ImportedEvidenceFragment[] {
  const rows = parseCsvMatrix(source);
  const headers = rows[0]!.map(header => header.trim().toLowerCase());
  const index = new Map(headers.map((header, position) => [header, position]));
  const allowedHeaders = new Set(['table', 'recordid', 'field', 'value', 'confidence', 'sourceref', 'sourcesha256']);
  const unknownHeaders = headers.filter(header => !allowedHeaders.has(header));
  if (unknownHeaders.length) throw new Error(`CSV contains unsupported column(s): ${unknownHeaders.join(', ')}.`);
  for (const required of ['table', 'recordid', 'field', 'value']) {
    if (!index.has(required)) throw new Error(`CSV is missing required column “${required}”. Required headers: table, recordId, field, value; confidence is optional.`);
  }
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column headers.');
  const lookup = (row: string[], column: string) => row[index.get(column)!]?.trim() ?? '';
  return rows.slice(1).map((row, position) => {
    const line = position + 2;
    const table = lookup(row, 'table');
    const field = lookup(row, 'field');
    const recordIdText = lookup(row, 'recordid');
    const recordId = Number(recordIdText);
    if (!schema.tables.includes(table)) throw new Error(`Row ${line}: relation “${table}” is not in this case schema.`);
    if (!recordIdText || !Number.isSafeInteger(recordId) || recordId < 0) throw new Error(`Row ${line}: recordId must be a non-negative whole number.`);
    if (!field || field === '_recordId') throw new Error(`Row ${line}: field is empty or reserved.`);
    const tableDefinition = schema.tableDefinitions?.find(definition => definition.name === table);
    const column = tableDefinition?.columns.find(definition => definition.name === field);
    if (tableDefinition && tableDefinition.columns.length > 0 && !column) throw new Error(`Row ${line}: field “${table}.${field}” is not declared in this schema.`);
    let value: string | number | boolean | null;
    try { value = parseScalar(row[index.get('value')!] ?? '', column?.type); }
    catch (error) { throw new Error(`Row ${line} (${table}.${field}): ${error instanceof Error ? error.message : 'invalid scalar value'}`); }
    const confidenceRaw = index.has('confidence') ? lookup(row, 'confidence') : '';
    const confidence = confidenceRaw === '' ? 1 : Number(confidenceRaw);
    if (!Number.isFinite(confidence) || confidence <= 0 || confidence > 1) throw new Error(`Row ${line}: confidence must be greater than 0 and at most 1.`);
    if (value === null && column?.required) throw new Error(`Row ${line}: ${table}.${field} is required and cannot be NULL.`);
    const sourceRef = index.has('sourceref') ? lookup(row, 'sourceref') : '';
    const sourceSha256 = index.has('sourcesha256') ? lookup(row, 'sourcesha256').toLowerCase() : '';
    if (sourceRef.length > 256 || /[\u0000-\u001f\u007f]/.test(sourceRef)) throw new Error(`Row ${line}: sourceRef must be a printable label of at most 256 characters.`);
    if (sourceSha256 && !/^[a-f0-9]{64}$/.test(sourceSha256)) throw new Error(`Row ${line}: sourceSha256 must contain exactly 64 hexadecimal characters.`);
    return { table, recordId, field, value, confidence, ...(sourceRef ? { sourceRef } : {}), ...(sourceSha256 ? { sourceSha256 } : {}) };
  });
}
