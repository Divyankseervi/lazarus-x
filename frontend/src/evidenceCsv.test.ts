import { describe, expect, it } from 'vitest';
import { parseCsvMatrix, parseEvidenceCsv } from './evidenceCsv';
import { createPresetSchema } from './schemaTypes';

describe('evidence CSV intake', () => {
  const schema = createPresetSchema('incident-response');

  it('parses quoted commas and escaped quote characters', () => {
    expect(parseCsvMatrix('table,recordId,field,value\nPerson,1,name,"Rao, Asha"\nPerson,2,name,"She said ""hello"""')).toEqual([
      ['table', 'recordId', 'field', 'value'],
      ['Person', '1', 'name', 'Rao, Asha'],
      ['Person', '2', 'name', 'She said "hello"'],
    ]);
  });

  it('converts values according to declared field types and defaults confidence', () => {
    expect(parseEvidenceCsv('table,recordId,field,value\nPerson,1,id,42\nPerson,1,name,"Asha, Rao"', schema)).toEqual([
      { table: 'Person', recordId: 1, field: 'id', value: 42, confidence: 1 },
      { table: 'Person', recordId: 1, field: 'name', value: 'Asha, Rao', confidence: 1 },
    ]);
  });

  it('imports a printable source label and validates an optional SHA-256 reference', () => {
    const parsed = parseEvidenceCsv(`table,recordId,field,value,sourceRef,sourceSha256\nPerson,1,name,Asha,manifest-01,${'a'.repeat(64)}`, schema);
    expect(parsed[0]?.sourceRef).toBe('manifest-01');
    expect(parsed[0]?.sourceSha256).toBe('a'.repeat(64));
    expect(() => parseEvidenceCsv('table,recordId,field,value,sourceSha256\nPerson,1,name,Asha,bad-hash', schema)).toThrow(/64 hexadecimal/);
  });

  it('rejects an undeclared relation, field, malformed number, and invalid confidence', () => {
    expect(() => parseEvidenceCsv('table,recordId,field,value\nusers,1,name,Asha', schema)).toThrow(/not in this case schema/);
    expect(() => parseEvidenceCsv('table,recordId,field,value\nPerson,1,missing,x', schema)).toThrow(/not declared/);
    expect(() => parseEvidenceCsv('table,recordId,field,value\nPerson,1,id,nope', schema)).toThrow(/Expected a number/);
    expect(() => parseEvidenceCsv('table,recordId,field,value,confidence\nPerson,1,name,Asha,0', schema)).toThrow(/confidence/);
  });

  it('accepts a UTF-8 BOM in headers and rejects malformed quote closure', () => {
    expect(parseCsvMatrix('\uFEFFtable,recordId,field,value\nPerson,1,name,Asha')[0]?.[0]).toBe('table');
    expect(() => parseCsvMatrix('table,recordId,field,value\nPerson,1,name,"Asha"junk')).toThrow(/after a closing quote/);
    expect(() => parseCsvMatrix('table,recordId,field,value\nPerson,1,name,As"ha')).toThrow(/quote inside an unquoted field/);
  });


  it('preserves the literal word null in a typed text field and rejects silently ignored columns', () => {
    expect(parseEvidenceCsv('table,recordId,field,value\nPerson,1,name,null', schema)[0]?.value).toBe('null');
    expect(() => parseEvidenceCsv('table,recordId,field,value,notes\nPerson,1,name,Asha,not-recorded', schema)).toThrow(/unsupported column/);
  });

  it('rejects inconsistent columns, unclosed quotes, and oversized batches', () => {
    expect(() => parseCsvMatrix('table,recordId,field,value\nPerson,1,name')).toThrow(/same number of columns/);
    expect(() => parseCsvMatrix('table,recordId,field,value\nPerson,1,name,"unclosed')).toThrow(/unclosed quoted/);
    const rows = ['table,recordId,field,value', ...Array.from({ length: 251 }, (_, i) => `Person,${i},name,Asha`)].join('\n');
    expect(() => parseCsvMatrix(rows)).toThrow(/250 evidence rows/);
  });
});
