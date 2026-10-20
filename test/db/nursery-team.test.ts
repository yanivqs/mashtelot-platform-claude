/**
 * R06-01/02: צוות משתלה מול ה-DB — עד 5 פעילים (גם במקביל), רק משתמשי צוות של המשתלה עצמה,
 * השבתה/שינוי תפקיד/איפוס סיסמה מנתקים sessions, ה-CHECK במסד.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { addMember, listTeam, MAX_STAFF, resetMemberPassword, setMemberDisabled, setMemberRole } from '@/lib/nursery-team';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const RUN = Date.now();
const PW = 'a-long-password-123';
const email = (i: number | string) => `staff-${RUN}-${i}@test.invalid`;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { startsWith: `staff-${RUN}-` } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('R06 nursery team', () => {
  it('validates input; email must be unique across the platform', async () => {
    expect(await addMember(prisma, f.A.nurseryId, { email: 'bad', role: 'NURSERY_STAFF', password: PW })).toMatchObject({ ok: false });
    expect(await addMember(prisma, f.A.nurseryId, { email: email('x'), role: 'NURSERY_OWNER', password: PW })).toEqual({ ok: false, error: 'תפקיד לא תקין' });
    expect(await addMember(prisma, f.A.nurseryId, { email: email('x'), role: 'SUPER_ADMIN', password: PW })).toEqual({ ok: false, error: 'תפקיד לא תקין' });
    expect((await addMember(prisma, f.A.nurseryId, { email: email('x'), role: 'NURSERY_STAFF', password: 'short' })).ok).toBe(false);
    const ok = await addMember(prisma, f.A.nurseryId, { email: email(0).toUpperCase(), role: 'NURSERY_WRITER', password: PW });
    expect(ok.ok).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { email: email(0) } });
    expect(u).toMatchObject({ role: 'NURSERY_WRITER', nurseryId: f.A.nurseryId });
    expect(await bcrypt.compare(PW, u.passwordHash!)).toBe(true);
    expect(await addMember(prisma, f.B.nurseryId, { email: email(0), role: 'NURSERY_STAFF', password: PW })).toMatchObject({ ok: false });
  });

  it(`at most ${MAX_STAFF} active members, even with concurrent adds; disabled ones do not count`, async () => {
    const results = await Promise.all(
      [1, 2, 3, 4, 5, 6].map((i) => addMember(prisma, f.A.nurseryId, { email: email(i), role: 'NURSERY_STAFF', password: PW })),
    );
    // אחד כבר קיים (כותב התוכן) → 4 מתוך 6 מצליחים
    expect(results.filter((r) => r.ok)).toHaveLength(MAX_STAFF - 1);
    const team = await listTeam(prisma, f.A.nurseryId);
    expect(team.filter((m) => !m.disabledAt)).toHaveLength(MAX_STAFF);
    // השבתה מפנה מקום; החזרה לפעילות כשמלא — נדחית
    const first = team[0]!;
    expect((await setMemberDisabled(prisma, f.A.nurseryId, first.id, true)).ok).toBe(true);
    expect((await addMember(prisma, f.A.nurseryId, { email: email(7), role: 'NURSERY_STAFF', password: PW })).ok).toBe(true);
    expect(await setMemberDisabled(prisma, f.A.nurseryId, first.id, false)).toMatchObject({ ok: false });
  });

  it('disable / role change / password reset log the member out (session version) and stay inside the nursery', async () => {
    const m = await prisma.user.findUniqueOrThrow({ where: { email: email(7) } });
    const v0 = m.sessionVersion;
    await setMemberRole(prisma, f.A.nurseryId, m.id, 'NURSERY_WRITER');
    await resetMemberPassword(prisma, f.A.nurseryId, m.id, 'another-long-pass-1');
    await setMemberDisabled(prisma, f.A.nurseryId, m.id, true);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: m.id } });
    expect(after).toMatchObject({ role: 'NURSERY_WRITER', sessionVersion: v0 + 3 });
    expect(after.disabledAt).not.toBeNull();
    expect(await bcrypt.compare('another-long-pass-1', after.passwordHash!)).toBe(true);

    // משתלה אחרת / בעל המשתלה / תפקיד לא חוקי — נדחים
    expect(await setMemberDisabled(prisma, f.B.nurseryId, m.id, false)).toEqual({ ok: false, error: 'העובד לא נמצא' });
    expect(await setMemberRole(prisma, f.A.nurseryId, f.A.ownerId, 'NURSERY_STAFF')).toEqual({ ok: false, error: 'העובד לא נמצא' });
    expect(await setMemberRole(prisma, f.A.nurseryId, m.id, 'SUPER_ADMIN')).toEqual({ ok: false, error: 'תפקיד לא תקין' });
    expect(await resetMemberPassword(prisma, f.B.nurseryId, m.id, 'another-long-pass-2')).toMatchObject({ ok: false });
  });

  it('DB CHECK: staff roles require a nursery', async () => {
    await expect(prisma.user.create({ data: { email: email('nonursery'), role: 'NURSERY_STAFF' } })).rejects.toThrow();
  });
});
