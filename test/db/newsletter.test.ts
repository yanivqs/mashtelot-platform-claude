/**
 * תפוצת דואר: הרשמה, הרשמה חוזרת, הסרה, יצוא ובידוד בין משתלות, ומחיקה בבקשת פרטיות.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { deleteCustomerData } from '@/lib/customer-privacy';
import { exportSubscribersCsv, removeSubscriber, subscribeToNewsletter } from '@/lib/newsletter';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.newsletterSubscriber.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const row = (nurseryId: string, email: string) => prisma.newsletterSubscriber.findUnique({ where: { nurseryId_email: { nurseryId, email } } });

describe('newsletter', () => {
  it('normalizes the address, refuses an invalid one and does not duplicate', async () => {
    expect(await subscribeToNewsletter(prisma, f.A.nurseryId, 'לא כתובת')).toEqual({ ok: false, error: 'כתובת אימייל לא תקינה' });
    expect((await subscribeToNewsletter(prisma, f.A.nurseryId, ' Dana@Example.com ')).ok).toBe(true);
    expect((await subscribeToNewsletter(prisma, f.A.nurseryId, 'dana@example.com')).ok).toBe(true);
    expect(await prisma.newsletterSubscriber.count({ where: { nurseryId: f.A.nurseryId, email: 'dana@example.com' } })).toBe(1);
  });

  it('a removed address leaves the export, and subscribing again is a new consent', async () => {
    await subscribeToNewsletter(prisma, f.A.nurseryId, 'back@example.com');
    const before = await row(f.A.nurseryId, 'back@example.com');
    expect(await removeSubscriber(prisma, f.A.nurseryId, before!.id)).toBe(true);
    expect(await removeSubscriber(prisma, f.A.nurseryId, before!.id)).toBe(false);
    expect((await exportSubscribersCsv(prisma, f.A.nurseryId)).csv).not.toContain('back@example.com');

    await subscribeToNewsletter(prisma, f.A.nurseryId, 'back@example.com');
    expect((await row(f.A.nurseryId, 'back@example.com'))?.unsubscribedAt).toBeNull();
    expect((await exportSubscribersCsv(prisma, f.A.nurseryId)).csv).toContain('back@example.com');
  });

  it('nursery isolation: B neither removes nor exports the subscribers of A', async () => {
    await subscribeToNewsletter(prisma, f.A.nurseryId, 'only-a@example.com');
    const a = await row(f.A.nurseryId, 'only-a@example.com');
    expect(await removeSubscriber(prisma, f.B.nurseryId, a!.id)).toBe(false);
    expect((await row(f.A.nurseryId, 'only-a@example.com'))?.unsubscribedAt).toBeNull();
    expect((await exportSubscribersCsv(prisma, f.B.nurseryId)).csv).not.toContain('only-a@example.com');
  });

  it('a privacy deletion removes the address, also when it belongs to no customer', async () => {
    await subscribeToNewsletter(prisma, f.A.nurseryId, 'erase@example.com');
    expect((await deleteCustomerData(prisma, f.A.nurseryId, 'erase@example.com')).ok).toBe(true);
    expect(await row(f.A.nurseryId, 'erase@example.com')).toBeNull();
  });
});
