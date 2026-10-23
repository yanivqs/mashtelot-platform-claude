/**
 * R06-09 מול ה-DB: יצוא מלא; מחיקה — חסומה עם הזמנה פתוחה; אחרי סגירה: הזמנות בלי פרטים אישיים
 * (סכומים נשמרים), החשבון והתלויים בו נמחקים, משתלה אחרת לא נפגעת; אורח לפי מייל.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { deleteCustomerData, emailRef, exportCustomerData } from '@/lib/customer-privacy';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const RUN = Date.now();
const EMAIL = `priv-${RUN}@test.invalid`;
const GUEST = `priv-guest-${RUN}@test.invalid`;

const order = (nurseryId: string, email: string, status: 'RECEIVED' | 'DELIVERED', customerId?: string) =>
  prisma.order.create({
    data: { nurseryId, customerId, customerName: 'דנה', customerEmail: email, customerPhone: '050-1', shippingAddress: 'הרצל 1, חיפה', paymentReference: 'REF1', totalAmount: '42.00', status, stockState: 'NONE' },
  });

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('R06-09 privacy', () => {
  it('export contains profile, addresses, favorites, points and orders', async () => {
    const c = await prisma.customer.create({ data: { nurseryId: f.A.nurseryId, email: EMAIL, fullName: 'דנה', marketingConsentAt: new Date() } });
    await prisma.customerAddress.create({ data: { customerId: c.id, city: 'חיפה', street: 'הרצל 1' } });
    await prisma.customerFavorite.create({ data: { customerId: c.id, nurseryProductId: f.A.productId } });
    await prisma.loyaltyEntry.create({ data: { nurseryId: f.A.nurseryId, customerId: c.id, kind: 'ADJUST', points: 10, note: 'מתנה' } });
    await order(f.A.nurseryId, EMAIL, 'DELIVERED', c.id);
    const d = await exportCustomerData(prisma, f.A.nurseryId, EMAIL.toUpperCase());
    expect(d.profile).toMatchObject({ email: EMAIL, fullName: 'דנה' });
    expect(d.addresses).toHaveLength(1);
    expect(d.favorites).toHaveLength(1);
    expect(d.loyalty[0]).toMatchObject({ points: 10 });
    expect(d.orders[0]).toMatchObject({ totalAmount: 42, customerPhone: '050-1' });
  });

  it('deletion is blocked while an order is open', async () => {
    const open = await order(f.A.nurseryId, EMAIL, 'RECEIVED');
    expect(await deleteCustomerData(prisma, f.A.nurseryId, EMAIL)).toEqual({ ok: false, error: 'יש 1 הזמנות פתוחות — אפשר למחוק אחרי שיושלמו או יבוטלו' });
    await prisma.order.update({ where: { id: open.id }, data: { status: 'CANCELLED' } });
  });

  it('deletes the account and its data; orders keep amounts but lose personal details; other nursery untouched', async () => {
    const other = await order(f.B.nurseryId, EMAIL, 'DELIVERED');
    const c = await prisma.customer.findUniqueOrThrow({ where: { nurseryId_email: { nurseryId: f.A.nurseryId, email: EMAIL } } });
    await prisma.auditEvent.create({ data: { nurseryId: f.A.nurseryId, actorEmail: EMAIL, action: 'customer.login', entityType: 'Customer' } });
    const r = await deleteCustomerData(prisma, f.A.nurseryId, EMAIL);
    expect(r).toMatchObject({ ok: true, anonymizedOrders: 2, ref: emailRef(EMAIL) });
    const orders = await prisma.order.findMany({ where: { nurseryId: f.A.nurseryId, customerEmail: `deleted-${emailRef(EMAIL)}@deleted.invalid` } });
    expect(orders).toHaveLength(2);
    for (const o of orders) {
      expect(o).toMatchObject({ customerName: 'לקוח שנמחק', customerPhone: '', shippingAddress: null, paymentReference: null, customerId: null });
      expect(Number(o.totalAmount)).toBe(42);
    }
    expect(await prisma.customer.findUnique({ where: { id: c.id } })).toBeNull();
    expect(await prisma.customerAddress.count({ where: { customerId: c.id } })).toBe(0);
    expect(await prisma.loyaltyEntry.count({ where: { customerId: c.id } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { nurseryId: f.A.nurseryId, actorEmail: EMAIL } })).toBe(0);
    // משתלה אחרת — ללא שינוי
    expect((await prisma.order.findUniqueOrThrow({ where: { id: other.id } })).customerEmail).toBe(EMAIL);
  });

  it('a guest (no account) can be deleted by email; unknown email → error', async () => {
    await order(f.A.nurseryId, GUEST, 'DELIVERED');
    expect(await deleteCustomerData(prisma, f.A.nurseryId, GUEST)).toMatchObject({ ok: true, anonymizedOrders: 1 });
    expect(await deleteCustomerData(prisma, f.A.nurseryId, `nobody-${RUN}@x.invalid`)).toEqual({ ok: false, error: 'לא נמצא לקוח עם האימייל הזה' });
  });
});
