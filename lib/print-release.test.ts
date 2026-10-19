import { describe, expect, it } from 'vitest';
import { canMove, evaluateGate, type GateInput } from './print-release';

const base: GateInput = {
  items: [{ title: 'מדבקה', fromTemplate: true, savedRevisionStatus: null, requiresArtwork: true, approvedArtwork: { versionId: 'v', version: 2 } }],
  orderSpecApproved: true,
  productionFile: { id: 'f', sha256: 'a'.repeat(64) },
  isPrintHouse: true,
  status: 'PENDING',
};
const failing = (g: GateInput) => evaluateGate(g).checks.filter((c) => !c.ok).map((c) => c.key);

describe('release gate (PT-06)', () => {
  it('passes only when spec, artwork, production file, role and status are all satisfied', () => {
    expect(evaluateGate(base).ok).toBe(true);
    expect(failing({ ...base, orderSpecApproved: false })).toEqual(['spec']);
    expect(failing({ ...base, items: [{ ...base.items[0]!, approvedArtwork: null }] })).toEqual(['artwork']);
    expect(failing({ ...base, productionFile: null })).toEqual(['file']);
    expect(failing({ ...base, isPrintHouse: false })).toEqual(['role']);
    expect(failing({ ...base, status: 'RELEASED' })).toEqual(['status']);
  });

  it('a production file with critical preflight findings blocks; warnings and unchecked legacy files do not (PT-09)', () => {
    expect(failing({ ...base, productionFile: { id: 'f', sha256: 'a'.repeat(64), preflightCritical: ['מידות שגויות'] } })).toEqual(['preflight']);
    expect(evaluateGate({ ...base, productionFile: { id: 'f', sha256: 'a'.repeat(64), preflightCritical: [] } }).ok).toBe(true);
    const legacy = evaluateGate({ ...base, productionFile: { id: 'f', sha256: 'a'.repeat(64), preflightCritical: null } });
    expect(legacy.ok).toBe(true);
    expect(legacy.checks.find((c) => c.key === 'preflight')!.detail).toContain('לא נבדק');
  });

  it('fixed products use their spec revision; pending/rejected specs block', () => {
    const item = { ...base.items[0]!, savedRevisionStatus: 'APPROVED' as const };
    expect(evaluateGate({ ...base, orderSpecApproved: false, items: [item] }).ok).toBe(true);
    expect(evaluateGate({ ...base, orderSpecApproved: false, items: [{ ...item, savedRevisionStatus: 'SUPERSEDED' }] }).ok).toBe(true);
    expect(failing({ ...base, items: [{ ...item, savedRevisionStatus: 'SUBMITTED' }] })).toEqual(['spec']);
  });

  it('artwork is not required when the product does not need it; legacy items are exempt', () => {
    expect(evaluateGate({ ...base, items: [{ ...base.items[0]!, requiresArtwork: false, approvedArtwork: null }] }).ok).toBe(true);
    expect(evaluateGate({ ...base, orderSpecApproved: false, items: [{ title: 'ישן', fromTemplate: false, savedRevisionStatus: null, requiresArtwork: true, approvedArtwork: null }] }).ok).toBe(true);
  });

  it('production transitions: no skipping, completed is final, blocked returns to pending', () => {
    expect(canMove('PENDING', 'IN_PRODUCTION')).toBe(false);
    expect(canMove('PENDING', 'RELEASED')).toBe(false); // רק דרך השער
    expect(canMove('RELEASED', 'IN_PRODUCTION')).toBe(true);
    expect(canMove('IN_PRODUCTION', 'COMPLETED')).toBe(false);
    expect(canMove('QC', 'COMPLETED')).toBe(true);
    expect(canMove('COMPLETED', 'BLOCKED')).toBe(false);
    expect(canMove('BLOCKED', 'PENDING', false)).toBe(true);
    // חסימה אחרי שחרור חוזרת ל"שוחרר" — לא ל"ממתין" (השחרור אינו חוזר)
    expect(canMove('BLOCKED', 'PENDING', true)).toBe(false);
    expect(canMove('BLOCKED', 'RELEASED', true)).toBe(true);
    expect(canMove('BLOCKED', 'RELEASED', false)).toBe(false);
  });
});
