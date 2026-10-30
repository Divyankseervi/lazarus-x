import { describe, expect, it } from 'vitest';
import { normalizeLinkKey, parsePartnerDataset } from './departmentDataset';

describe('partner department dataset import', () => {
  it('parses CSV headers, commas, escaped quotes, and line breaks', () => {
    expect(parsePartnerDataset('record_no,name,dob\r\nA-1,"Rao, Asha","1998-08-14"\r\nA-2,"She said ""yes""",1999-01-02', 'school.csv')).toEqual([
      { record_no: 'A-1', name: 'Rao, Asha', dob: '1998-08-14' },
      { record_no: 'A-2', name: 'She said "yes"', dob: '1999-01-02' },
    ]);
  });

  it('accepts arrays of scalar JSON records and rejects nested/invalid data', () => {
    expect(parsePartnerDataset('[{"reg":"A-1","amount":12,"active":true}]', 'dept.json')).toEqual([{ reg: 'A-1', amount: 12, active: true }]);
    expect(() => parsePartnerDataset('[{"record":{"id":1}}]', 'dept.json')).toThrow(/scalar value/);
    expect(() => parsePartnerDataset('[]', 'dept.json')).toThrow(/non-empty array/);
  });

  it('rejects malformed CSV shapes and unsupported files and normalizes exact keys', () => {
    expect(() => parsePartnerDataset('id,,value\n1,x,y', 'bad.csv')).toThrow(/header/);
    expect(() => parsePartnerDataset('id,value\n1', 'bad.csv')).toThrow(/same number/);
    expect(() => parsePartnerDataset('[]', 'dept.xlsx')).toThrow(/CSV or JSON/);
    expect(normalizeLinkKey('  Ａ-1 ')).toBe('a-1');
    expect(normalizeLinkKey(null)).toBeNull();
  });
});
