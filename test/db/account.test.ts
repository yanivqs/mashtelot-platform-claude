/**
 * C-P0-03: החלפת סיסמה — אימות הסיסמה הנוכחית, חוזק, ובידוד בין משתמשים.
 */
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { changePassword } from '@/lib/account';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const A_PASSWORD = 'tenant-a-original-1';
const B_PASSWORD = 'tenant-b-original-1';

async function hashOf(userId: string) {
  return (await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } }))!
    .passwordHash!;
}

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  await prisma.user.update({ where: { id: f.A.ownerId }, data: { passwordHash: await bcrypt.hash(A_PASSWORD, 4) } });
  await prisma.user.update({ where: { id: f.B.ownerId }, data: { passwordHash: await bcrypt.hash(B_PASSWORD, 4) } });
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('C-P0-03 change password', () => {
  it('rejects a wrong current password and leaves the hash unchanged', async () => {
    const before = await hashOf(f.A.ownerId);
    const res = await changePassword(prisma, f.A.ownerId, {
      current: 'not-the-password',
      next: 'brand-new-password-1',
      confirm: 'brand-new-password-1',
    });
    expect(res).toEqual({ ok: false, error: 'הסיסמה הנוכחית שגויה' });
    expect(await hashOf(f.A.ownerId)).toBe(before);
  });

  it('rejects a mismatched confirmation and a weak or previously exposed password', async () => {
    const mismatch = await changePassword(prisma, f.A.ownerId, {
      current: A_PASSWORD,
      next: 'brand-new-password-1',
      confirm: 'brand-new-password-2',
    });
    expect(mismatch.ok).toBe(false);
    for (const weak of ['short', 'admin1234']) {
      const res = await changePassword(prisma, f.A.ownerId, { current: A_PASSWORD, next: weak, confirm: weak });
      expect(res.ok).toBe(false);
    }
  });

  it("changes only the caller's password: new works, old fails, tenant B untouched", async () => {
    const bBefore = await hashOf(f.B.ownerId);
    const res = await changePassword(prisma, f.A.ownerId, {
      current: A_PASSWORD,
      next: 'brand-new-password-1',
      confirm: 'brand-new-password-1',
    });
    expect(res).toEqual({ ok: true });
    const aHash = await hashOf(f.A.ownerId);
    expect(await bcrypt.compare('brand-new-password-1', aHash)).toBe(true);
    expect(await bcrypt.compare(A_PASSWORD, aHash)).toBe(false);
    expect(await hashOf(f.B.ownerId)).toBe(bBefore);
    expect(await bcrypt.compare(B_PASSWORD, bBefore)).toBe(true);
  });
});
