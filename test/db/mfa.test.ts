/**
 * §4.04: אימות דו-שלבי מול ה-DB — הפעלה בשני שלבים, מניעת שימוש חוזר, קוד שחזור חד-פעמי,
 * ביטול ואיפוס מנתקים sessions, איפוס לא על עצמי, CHECK במסד.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { confirmEnrollment, disableMfa, regenerateRecoveryCodes, resetMfaByAdmin, startEnrollment, verifyMfaCode } from '@/lib/mfa';
import { totp } from '@/lib/totp';
import { decryptSecret } from '@/lib/mfa-crypto';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
let userId: string;
let adminId: string;
const T0 = 1_800_000_000_000;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  userId = (await prisma.user.create({ data: { email: `mfa-${Date.now()}@test.invalid`, role: 'NURSERY_OWNER', nurseryId: f.A.nurseryId } })).id;
  adminId = (await prisma.user.create({ data: { email: `mfa-admin-${Date.now()}@test.invalid`, role: 'SUPER_ADMIN' } })).id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const secretOf = async () => decryptSecret((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).mfaSecretEnc!);

describe('§4.04 MFA', () => {
  let codes: string[] = [];

  it('enrollment: pending secret is encrypted; wrong code keeps it pending; right code enables and logs out other devices', async () => {
    const s = await startEnrollment(prisma, userId);
    expect(s.ok).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.mfaSecretEnc).not.toContain((s as { secret: string }).secret);
    expect(row.mfaEnabledAt).toBeNull();
    // הפעלה שלא אושרה — אין אימות קוד בהתחברות
    expect((await verifyMfaCode(prisma, userId, totp(await secretOf(), T0), T0)).ok).toBe(false);

    expect((await confirmEnrollment(prisma, userId, '000000', T0)).ok).toBe(false);
    const c = await confirmEnrollment(prisma, userId, totp(await secretOf(), T0), T0);
    expect(c.ok).toBe(true);
    codes = (c as { recoveryCodes: string[] }).recoveryCodes;
    expect(codes).toHaveLength(8);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(after.mfaEnabledAt).not.toBeNull();
    expect(after.sessionVersion).toBe(row.sessionVersion + 1);
    expect(await prisma.userRecoveryCode.count({ where: { userId } })).toBe(8);
    expect((await startEnrollment(prisma, userId)).ok).toBe(false); // כבר פעיל
  });

  it('the enrollment code cannot be replayed at login; the next step works once', async () => {
    const s = await secretOf();
    expect((await verifyMfaCode(prisma, userId, totp(s, T0), T0)).ok).toBe(false);
    const next = T0 + 30_000;
    expect(await verifyMfaCode(prisma, userId, totp(s, next), next)).toEqual({ ok: true, method: 'totp' });
    expect((await verifyMfaCode(prisma, userId, totp(s, next), next)).ok).toBe(false);
  });

  it('recovery codes are single-use, case/dash-insensitive', async () => {
    const r = await verifyMfaCode(prisma, userId, codes[0]!.toUpperCase(), T0 + 60_000);
    expect(r).toEqual({ ok: true, method: 'recovery', recoveryLeft: 7 });
    expect((await verifyMfaCode(prisma, userId, codes[0]!, T0 + 60_000)).ok).toBe(false);
    expect((await verifyMfaCode(prisma, userId, 'zzzzz-zzzzz', T0 + 60_000)).ok).toBe(false);
  });

  it('regenerate replaces all recovery codes (old ones stop working)', async () => {
    const r = await regenerateRecoveryCodes(prisma, userId, codes[1]!, T0 + 60_000);
    expect(r.ok).toBe(true);
    expect((await verifyMfaCode(prisma, userId, codes[2]!, T0 + 60_000)).ok).toBe(false);
    codes = (r as { recoveryCodes: string[] }).recoveryCodes;
  });

  it('disable needs a valid code and clears everything', async () => {
    expect((await disableMfa(prisma, userId, '123456', T0 + 90_000)).ok).toBe(false);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(await disableMfa(prisma, userId, codes[0]!, T0 + 90_000)).toEqual({ ok: true });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(u).toMatchObject({ mfaSecretEnc: null, mfaEnabledAt: null, mfaLastStep: null, sessionVersion: before.sessionVersion + 1 });
    expect(await prisma.userRecoveryCode.count({ where: { userId } })).toBe(0);
  });

  it('admin reset: not on yourself; clears the target and logs it out', async () => {
    await startEnrollment(prisma, userId);
    await confirmEnrollment(prisma, userId, totp(await secretOf(), T0 + 300_000), T0 + 300_000);
    expect((await resetMfaByAdmin(prisma, adminId, adminId)).ok).toBe(false);
    const r = await resetMfaByAdmin(prisma, userId, adminId);
    expect(r).toMatchObject({ ok: true, nurseryId: f.A.nurseryId });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).mfaEnabledAt).toBeNull();
    expect((await resetMfaByAdmin(prisma, userId, adminId)).ok).toBe(false); // אין מה לאפס
  });

  it('DB CHECK: enabled MFA requires a secret', async () => {
    await expect(prisma.user.update({ where: { id: userId }, data: { mfaEnabledAt: new Date(), mfaSecretEnc: null } })).rejects.toThrow();
  });
});
