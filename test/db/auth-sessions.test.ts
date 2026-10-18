/**
 * SEC-01 (יומן התחברויות), SEC-02 (ביטול sessions), S-21 (אימייל קיים ביצירת משתלה).
 */
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { changePassword, isEmailTaken } from '@/lib/account';
import {
  authenticateAdmin,
  isTokenVersionCurrent,
  loginAuditEvent,
  LOGIN_ACTIONS,
  revokeUserSessions,
} from '@/lib/login';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const PASSWORD = 'correct-horse-battery';
const ctx = { ip: '203.0.113.7', userAgent: 'vitest' };

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  // A פעילה, C מושעית
  await prisma.user.updateMany({ where: { id: { in: [f.A.ownerId, f.C.ownerId] } }, data: { passwordHash } });
});

afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { metadata: { path: ['userAgent'], equals: 'vitest' } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

async function versionOf(userId: string) {
  return (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).sessionVersion;
}

describe('SEC-01 authenticateAdmin', () => {
  it('unknown email → unknown_email, no user', async () => {
    const r = await authenticateAdmin(prisma, `nobody-${f.runId}@example.invalid`, PASSWORD);
    expect(r).toMatchObject({ ok: false, reason: 'unknown_email', user: null });
  });

  it('wrong password → bad_password, same generic message as unknown email', async () => {
    const r = await authenticateAdmin(prisma, f.A.ownerEmail, 'wrong-password-123');
    expect(r).toMatchObject({ ok: false, reason: 'bad_password', error: 'פרטי התחברות שגויים' });
  });

  it('suspended nursery owner → portal_denied', async () => {
    const r = await authenticateAdmin(prisma, f.C.ownerEmail, PASSWORD);
    expect(r).toMatchObject({ ok: false, reason: 'portal_denied' });
  });

  it('correct credentials → ok', async () => {
    const r = await authenticateAdmin(prisma, f.A.ownerEmail, PASSWORD);
    expect(r.ok).toBe(true);
  });

  it('audit event fits audit_events, is attributed to the nursery and never contains the password', async () => {
    const r = await authenticateAdmin(prisma, f.A.ownerEmail, 'wrong-password-123');
    const event = loginAuditEvent(LOGIN_ACTIONS.failed, {
      email: f.A.ownerEmail,
      user: r.ok ? r.user : r.user,
      reason: r.ok ? undefined : r.reason,
      ctx,
    });
    const row = await prisma.auditEvent.create({ data: event });
    expect(row).toMatchObject({
      action: 'auth.login_failed',
      nurseryId: f.A.nurseryId,
      entityId: f.A.ownerId,
      actorEmail: f.A.ownerEmail,
    });
    expect(row.metadata).toEqual({ ip: ctx.ip, userAgent: 'vitest', reason: 'bad_password' });
    expect(JSON.stringify(row)).not.toContain('wrong-password-123');
  });
});

describe('SEC-02 session version', () => {
  it('tokens issued before SEC-02 (no sv) stay valid at version 0', () => {
    expect(isTokenVersionCurrent(undefined, 0)).toBe(true);
    expect(isTokenVersionCurrent(undefined, 1)).toBe(false);
    expect(isTokenVersionCurrent(2, 2)).toBe(true);
    expect(isTokenVersionCurrent(1, 2)).toBe(false);
    expect(isTokenVersionCurrent('2', 2)).toBe(false);
  });

  it('password change bumps the session version (old sessions rejected)', async () => {
    const before = await versionOf(f.A.ownerId);
    const res = await changePassword(prisma, f.A.ownerId, {
      current: PASSWORD,
      next: 'another-strong-pass-42',
      confirm: 'another-strong-pass-42',
    });
    expect(res.ok).toBe(true);
    const after = await versionOf(f.A.ownerId);
    expect(after).toBe(before + 1);
    expect(isTokenVersionCurrent(before, after)).toBe(false);
  });

  it('failed password change does not bump the version', async () => {
    const before = await versionOf(f.A.ownerId);
    const res = await changePassword(prisma, f.A.ownerId, {
      current: 'not-the-password',
      next: 'yet-another-pass-77',
      confirm: 'yet-another-pass-77',
    });
    expect(res.ok).toBe(false);
    expect(await versionOf(f.A.ownerId)).toBe(before);
  });

  it("revokeUserSessions bumps only that user's version", async () => {
    const otherBefore = await versionOf(f.B.ownerId);
    const before = await versionOf(f.A.ownerId);
    expect(await revokeUserSessions(prisma, f.A.ownerId)).toBe(before + 1);
    expect(await versionOf(f.B.ownerId)).toBe(otherBefore);
  });
});

describe('S-21 owner email already in use', () => {
  it('detects an existing user regardless of case/whitespace', async () => {
    expect(await isEmailTaken(prisma, `  ${f.B.ownerEmail.toUpperCase()} `)).toBe(true);
    expect(await isEmailTaken(prisma, `fresh-${f.runId}@example.invalid`)).toBe(false);
  });
});
