import { describe, expect, it } from 'vitest';
import { parseIsraelLocal } from './il-time';

describe('Israel local time', () => {
  it('converts winter (UTC+2) and summer (UTC+3) times', () => {
    expect(parseIsraelLocal('2030-01-15T10:00')?.toISOString()).toBe('2030-01-15T08:00:00.000Z');
    expect(parseIsraelLocal('2030-07-15T10:00')?.toISOString()).toBe('2030-07-15T07:00:00.000Z');
  });
  it('rejects malformed input', () => {
    expect(parseIsraelLocal('15/07/2030 10:00')).toBeNull();
    expect(parseIsraelLocal('')).toBeNull();
  });
});
