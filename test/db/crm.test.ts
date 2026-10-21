/**
 * R06-05/07/08/09: CRM מול ה-DB — איחוד רשומים ואורחים לפי מייל, סכומים בלי הזמנות מבוטלות,
 * סינון, בידוד משתלות, קבוצות (trigger), הערות, ויצוא רק למי שהסכים לדיוור עם הגנת נוסחאות.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { addNote, cleanTags, createGroup, csvCell, deleteGroup, exportCustomersCsv, getCrmRow, listCustomers, updateCrmFields } from '@/lib/crm';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const RUN = Date.now();
const mail = (t: string) => `crm-${RUN}-${t}@test.invalid`;

async function order(nurseryId: string, email: string, total: string, status: 'RECEIVED' | 'CANCELLED' = 'RECEIVED', name = 'לקוח') {
  return prisma.order.create({ data: { nurseryId, customerName: name, customerEmail: email, customerPhone: '050', totalAmount: total, status, stockState: 'NONE' } });
}

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  await order(f.A.nurseryId, mail('guest'), '100.00', 'RECEIVED', 'אורח ותיק');
  await order(f.A.nurseryId, mail('GUEST').toUpperCase(), '50.00');
  await order(f.A.nurseryId, mail('guest'), '999.00', 'CANCELLED');
  await prisma.customer.create({ data: { nurseryId: f.A.nurseryId, email: mail('reg'), fullName: '=HYPERLINK("x")', lastLoginAt: new Date(), marketingConsentAt: new Date() } });
  await order(f.B.nurseryId, mail('guest'), '7.00');
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('R06 CRM', () => {
  it('merges guests (case-insensitive) and registered customers; cancelled orders do not count; other nurseries excluded', async () => {
    const { rows, total } = await listCustomers(prisma, f.A.nurseryId, { q: `crm-${RUN}` });
    expect(total).toBe(2);
    const guest = rows.find((r) => r.email === mail('guest'))!;
    expect(guest).toMatchObject({ orders: 3, spent: 150, customerId: null, registered: false, name: 'לקוח' });
    expect(rows.find((r) => r.email === mail('reg'))).toMatchObject({ orders: 0, registered: true });
    expect((await listCustomers(prisma, f.B.nurseryId, { q: `crm-${RUN}` })).rows.map((r) => r.spent)).toEqual([7]);
  });

  it('CRM fields create a record for a guest only; tags cleaned; groups are per nursery (trigger)', async () => {
    expect(cleanTags(' VIP , vip ,  גינון  , VIP')).toEqual(['VIP', 'vip', 'גינון']);
    expect(await updateCrmFields(prisma, f.A.nurseryId, 'nobody@test.invalid', { tags: 'x', groupId: null, type: 'PRIVATE' })).toEqual({ ok: false, error: 'הלקוח לא נמצא' });
    expect(await createGroup(prisma, f.A.nurseryId, 'עסקיים')).toEqual({ ok: true });
    expect((await createGroup(prisma, f.A.nurseryId, 'עסקיים')).ok).toBe(false);
    await createGroup(prisma, f.B.nurseryId, 'של B');
    const gA = await prisma.customerGroup.findFirstOrThrow({ where: { nurseryId: f.A.nurseryId, name: 'עסקיים' } });
    const gB = await prisma.customerGroup.findFirstOrThrow({ where: { nurseryId: f.B.nurseryId } });
    expect(await updateCrmFields(prisma, f.A.nurseryId, mail('guest'), { tags: 'x', groupId: gB.id, type: 'PRIVATE' })).toEqual({ ok: false, error: 'הקבוצה לא נמצאה' });
    expect(
      await updateCrmFields(prisma, f.A.nurseryId, mail('guest'), { tags: 'VIP, קבלן', groupId: gA.id, type: 'BUSINESS', companyName: 'גנים בע"מ', taxId: '512345678' }),
    ).toEqual({ ok: true });
    const c = await prisma.customer.findUniqueOrThrow({ where: { nurseryId_email: { nurseryId: f.A.nurseryId, email: mail('guest') } } });
    expect(c).toMatchObject({ fullName: 'לקוח', tags: ['VIP', 'קבלן'], groupId: gA.id, type: 'BUSINESS', companyName: 'גנים בע"מ', lastLoginAt: null });
    await expect(prisma.customer.update({ where: { id: c.id }, data: { groupId: gB.id } })).rejects.toThrow(/another nursery/);
    expect(await addNote(prisma, f.A.nurseryId, mail('guest'), '  מעדיף משלוח בבוקר ', 'owner@x')).toEqual({ ok: true });
    expect((await addNote(prisma, f.A.nurseryId, mail('guest'), '   ', null)).ok).toBe(false);
  });

  it('filters: tag, group, type, min spent, consent', async () => {
    const g = await prisma.customerGroup.findFirstOrThrow({ where: { nurseryId: f.A.nurseryId, name: 'עסקיים' } });
    const emails = async (flt: Parameters<typeof listCustomers>[2]) => (await listCustomers(prisma, f.A.nurseryId, { q: `crm-${RUN}`, ...flt })).rows.map((r) => r.email);
    expect(await emails({ tag: 'VIP' })).toEqual([mail('guest')]);
    expect(await emails({ groupId: g.id })).toEqual([mail('guest')]);
    expect(await emails({ type: 'BUSINESS' })).toEqual([mail('guest')]);
    expect(await emails({ minSpent: 151 })).toEqual([]);
    expect(await emails({ consent: true })).toEqual([mail('reg')]);
    expect((await getCrmRow(prisma, f.A.nurseryId, mail('GUEST').toUpperCase()))?.groupName).toBe('עסקיים');
    // מחיקת קבוצה — הלקוח נשאר בלי קבוצה
    expect(await deleteGroup(prisma, f.B.nurseryId, g.id)).toMatchObject({ ok: false });
    expect(await deleteGroup(prisma, f.A.nurseryId, g.id)).toEqual({ ok: true });
    expect((await getCrmRow(prisma, f.A.nurseryId, mail('guest')))?.groupId).toBeNull();
  });

  it('export: only customers who consented; formulas neutralized', async () => {
    const { csv, count } = await exportCustomersCsv(prisma, f.A.nurseryId, { q: `crm-${RUN}` });
    expect(count).toBe(1);
    expect(csv).toContain(mail('reg'));
    expect(csv).not.toContain(mail('guest'));
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+972')).toBe(`"'+972"`);
    expect(csvCell('רגיל')).toBe('"רגיל"');
  });
});
