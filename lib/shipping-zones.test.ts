import { describe, expect, it } from 'vitest';
import { normalizePostcode, parsePostcodePrefixes, pickZone } from './shipping-zones';

const zones = [
  { id: 'center', cities: ['תל אביב', 'רמת גן'], postcodes: ['52'] },
  { id: 'rg-north', cities: [], postcodes: ['5250'] },
  { id: 'north', cities: ['חיפה'], postcodes: [] },
];

describe('postcodes (§11.01)', () => {
  it('customer postcode: 7 digits, spaces/dashes allowed, empty is fine', () => {
    expect(normalizePostcode('52 500-01')).toBe('5250001');
    expect(normalizePostcode('')).toBe('');
    expect(normalizePostcode(undefined)).toBe('');
    expect(normalizePostcode('12345')).toBeNull();
    expect(normalizePostcode('abcdefg')).toBeNull();
  });

  it('zone prefixes: 1–7 digits, comma or newline separated, deduplicated', () => {
    expect(parsePostcodePrefixes('52\n5250, 52')).toEqual({ ok: true, value: ['52', '5250'] });
    expect(parsePostcodePrefixes('')).toEqual({ ok: true, value: [] });
    expect(parsePostcodePrefixes('52\n12345678').ok).toBe(false);
    expect(parsePostcodePrefixes('רמת גן').ok).toBe(false);
  });

  it('postcode beats city; longest prefix wins; no postcode match falls back to city', () => {
    expect(pickZone(zones, 'חיפה', '5210000')?.id).toBe('center');
    expect(pickZone(zones, 'רמת גן', '5250001')?.id).toBe('rg-north');
    expect(pickZone(zones, '  חיפה ', '3100000')?.id).toBe('north');
    expect(pickZone(zones, 'חיפה', '')?.id).toBe('north');
    expect(pickZone(zones, 'אילת', '8800000')).toBeNull();
    // מיקוד לא תקין לא מתאים לשום אזור — חוזרים לעיר
    expect(pickZone(zones, 'תל אביב', '52')?.id).toBe('center');
  });
});
