export type PartnerScalar = string | number | boolean | null;
export type PartnerRow = Record<string, PartnerScalar>;

const MAX_DATASET_BYTES = 2 * 1024 * 1024;
const MAX_DATASET_ROWS = 50_000;
const MAX_DATASET_COLUMNS = 100;

function parseCsv(text: string): PartnerRow[] {
  const records: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell.length === 0) quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some(value => value.length > 0)) records.push(row);
      row = [];
    } else cell += char;
  }
  if (quoted) throw new Error('The CSV file contains an unclosed quoted field.');
  row.push(cell);
  if (row.some(value => value.length > 0)) records.push(row);
  if (records.length < 2) throw new Error('The CSV needs a header row and at least one data row.');
  const headers = records[0]!.map(value => value.trim());
  if (headers.some(header => !header)) throw new Error('Every CSV column needs a header.');
  if (headers.length > MAX_DATASET_COLUMNS) throw new Error(`The file may contain at most ${MAX_DATASET_COLUMNS} columns.`);
  if (new Set(headers).size !== headers.length) throw new Error('CSV column names must be unique.');
  const rows = records.slice(1);
  if (rows.length > MAX_DATASET_ROWS) throw new Error(`The file may contain at most ${MAX_DATASET_ROWS.toLocaleString()} rows.`);
  if (rows.some(values => values.length !== headers.length)) throw new Error('Every CSV row must contain the same number of columns as the header.');
  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index]!]))) as PartnerRow[];
}

function parseJson(text: string): PartnerRow[] {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('The JSON file could not be parsed.'); }
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('The JSON file must contain a non-empty array of records.');
  if (parsed.length > MAX_DATASET_ROWS) throw new Error(`The file may contain at most ${MAX_DATASET_ROWS.toLocaleString()} records.`);
  const rows = parsed.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error(`JSON record ${index + 1} must be an object.`);
    const values = Object.entries(item as Record<string, unknown>);
    if (values.length === 0 || values.length > MAX_DATASET_COLUMNS) throw new Error(`JSON record ${index + 1} must contain 1 to ${MAX_DATASET_COLUMNS} fields.`);
    for (const [key, value] of values) {
      if (!key.trim() || !(value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value)))) {
        throw new Error(`JSON field “${key}” in record ${index + 1} must be a scalar value.`);
      }
    }
    return Object.fromEntries(values) as PartnerRow;
  });
  return rows;
}

export function parsePartnerDataset(text: string, fileName: string): PartnerRow[] {
  if (new TextEncoder().encode(text).byteLength > MAX_DATASET_BYTES) throw new Error('The partner extract must be 2 MiB or smaller.');
  const extension = fileName.toLowerCase().split('.').at(-1);
  if (extension === 'csv') return parseCsv(text);
  if (extension === 'json') return parseJson(text);
  throw new Error('Choose a CSV or JSON partner extract.');
}

export function normalizeLinkKey(value: PartnerScalar | undefined): string | null {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return null;
  return String(value).normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

export async function digestPartnerDataset(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
