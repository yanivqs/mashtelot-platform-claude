import { describe, expect, it } from 'vitest';
import { canOperate, isNurseryStatus, isPublic } from './nursery-lifecycle';

describe('nursery lifecycle (§2.03)', () => {
  it('draft: staff work, store not public; suspended/archived: both closed', () => {
    expect([canOperate('DRAFT'), isPublic('DRAFT')]).toEqual([true, false]);
    expect([canOperate('ACTIVE'), isPublic('ACTIVE')]).toEqual([true, true]);
    expect([canOperate('SUSPENDED'), isPublic('SUSPENDED')]).toEqual([false, false]);
    expect([canOperate('ARCHIVED'), isPublic('ARCHIVED')]).toEqual([false, false]);
    expect(isNurseryStatus('ACTIVE')).toBe(true);
    expect(isNurseryStatus('DELETED')).toBe(false);
  });
});
