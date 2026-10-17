import { describe, expect, it } from 'vitest';
import type { ModuleKey } from './modules';
import { canUseAdminPortal, decideNurseryAccess, isSessionAllowed, type AccessSubject } from './nursery-access';

const owner = (over: Partial<AccessSubject> = {}): AccessSubject => ({
  role: 'NURSERY_OWNER',
  nurseryId: 'n1',
  nurseryActive: true,
  ...over,
});
const mods = (...keys: ModuleKey[]) => new Set<ModuleKey>(keys);

describe('decideNurseryAccess', () => {
  it('grants an active owner their own nursery', () => {
    expect(decideNurseryAccess(owner(), mods())).toEqual({ ok: true, nurseryId: 'n1' });
  });

  it('denies anonymous, platform and customer roles — never falls back to another nursery', () => {
    expect(decideNurseryAccess(null, mods())).toEqual({ ok: false, reason: 'NOT_AUTHENTICATED' });
    expect(decideNurseryAccess(owner({ role: 'SUPER_ADMIN', nurseryId: null, nurseryActive: null }), mods())).toEqual({
      ok: false,
      reason: 'PLATFORM_ROLE',
    });
    // גם סופר-אדמין שבמקרה משויך למשתלה אינו מקבל גישה תפעולית
    expect(decideNurseryAccess(owner({ role: 'SUPER_ADMIN' }), mods())).toEqual({ ok: false, reason: 'PLATFORM_ROLE' });
    expect(decideNurseryAccess(owner({ role: 'CUSTOMER' }), mods())).toEqual({ ok: false, reason: 'PLATFORM_ROLE' });
  });

  it('denies an owner without a nursery or with a suspended one', () => {
    expect(decideNurseryAccess(owner({ nurseryId: null, nurseryActive: null }), mods())).toEqual({
      ok: false,
      reason: 'NO_NURSERY',
    });
    expect(decideNurseryAccess(owner({ nurseryActive: false }), mods('orders'), { all: ['orders'] })).toEqual({
      ok: false,
      reason: 'NURSERY_SUSPENDED',
    });
  });

  it('enforces all / any module requirements', () => {
    expect(decideNurseryAccess(owner(), mods(), { all: ['orders'] })).toEqual({ ok: false, reason: 'MODULE_DISABLED' });
    expect(decideNurseryAccess(owner(), mods('orders'), { all: ['orders'] }).ok).toBe(true);
    expect(decideNurseryAccess(owner(), mods(), { any: ['plant_catalog', 'supplies'] }).ok).toBe(false);
    expect(decideNurseryAccess(owner(), mods('supplies'), { any: ['plant_catalog', 'supplies'] }).ok).toBe(true);
  });
});

describe('session and login policy', () => {
  it('cuts off a suspended owner even with an existing session', () => {
    expect(isSessionAllowed(owner({ nurseryActive: false }))).toBe(false);
    expect(isSessionAllowed(owner())).toBe(true);
    expect(isSessionAllowed(owner({ role: 'SUPER_ADMIN', nurseryId: null, nurseryActive: null }))).toBe(true);
  });

  it('login: only admin roles, and not for a suspended nursery', () => {
    expect(canUseAdminPortal(owner()).ok).toBe(true);
    expect(canUseAdminPortal(owner({ nurseryActive: false })).ok).toBe(false);
    expect(canUseAdminPortal(owner({ role: 'CUSTOMER' })).ok).toBe(false);
    expect(canUseAdminPortal(owner({ role: 'SUPER_ADMIN', nurseryId: null, nurseryActive: null })).ok).toBe(true);
  });
});
