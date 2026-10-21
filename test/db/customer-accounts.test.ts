/**
 * R06-03: חשבונות לקוח מול ה-DB — קוד חד-פעמי (שגוי, נעילה אחרי 5, פג תוקף, חד-פעמי גם במקביל,
 * קוד חדש מבטל ישן), שיוך הזמנות אורח רק באותה משתלה, והפרדת Tenant ב-trigger.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { issueOtp, OTP_MAX_ATTEMPTS, verifyOtp } from '@/lib/customer-otp';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const RUN = Date.now();
const EMAIL = `cust-${RUN}@test.invalid`;
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0');

async function guestOrder(nurseryId: string, email: string) {
  return prisma.order.create({
    data: { nurseryId, customerName: 'אורח', customerEmail: email, customerPhone: '050', totalAmount: '10.00', stockState: 'NONE' },
  });
}

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { customerEmail: { contains: `cust-${RUN}` } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('R06-03 customer login by email code', () => {
  it('wrong code counts attempts; after 5 the code is dead even if correct', async () => {
    const code = await issueOtp(prisma, f.A.nurseryId, `lock-${EMAIL}`);
    for (let i = 0; i < OTP_MAX_ATTEMPTS; i++) expect((await verifyOtp(prisma, f.A.nurseryId, `lock-${EMAIL}`, wrong(code))).ok).toBe(false);
    expect((await verifyOtp(prisma, f.A.nurseryId, `lock-${EMAIL}`, code)).ok).toBe(false);
  });

  it('expired codes fail; a new code invalidates the previous one', async () => {
    const old = await issueOtp(prisma, f.A.nurseryId, `exp-${EMAIL}`, new Date(Date.now() - 11 * 60_000));
    expect((await verifyOtp(prisma, f.A.nurseryId, `exp-${EMAIL}`, old)).ok).toBe(false);
    const first = await issueOtp(prisma, f.A.nurseryId, `exp-${EMAIL}`);
    const second = await issueOtp(prisma, f.A.nurseryId, `exp-${EMAIL}`);
    if (first !== second) expect((await verifyOtp(prisma, f.A.nurseryId, `exp-${EMAIL}`, first)).ok).toBe(false);
    expect((await verifyOtp(prisma, f.A.nurseryId, `exp-${EMAIL}`, second)).ok).toBe(true);
  });

  it('a code is bound to its nursery', async () => {
    const code = await issueOtp(prisma, f.A.nurseryId, `bound-${EMAIL}`);
    expect((await verifyOtp(prisma, f.B.nurseryId, `bound-${EMAIL}`, code)).ok).toBe(false);
  });

  it('verify creates the customer once, single-use even concurrently, and claims guest orders of that nursery only', async () => {
    const a1 = await guestOrder(f.A.nurseryId, EMAIL.toUpperCase());
    const b1 = await guestOrder(f.B.nurseryId, EMAIL);
    const code = await issueOtp(prisma, f.A.nurseryId, EMAIL);
    const results = await Promise.all([1, 2, 3].map(() => verifyOtp(prisma, f.A.nurseryId, EMAIL, code)));
    const ok = results.filter((r) => r.ok);
    expect(ok).toHaveLength(1);
    const r = ok[0] as Extract<(typeof results)[number], { ok: true }>;
    expect(r).toMatchObject({ created: true, claimedOrders: 1 });
    expect((await prisma.order.findUniqueOrThrow({ where: { id: a1.id } })).customerId).toBe(r.customer.id);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: b1.id } })).customerId).toBeNull();

    // כניסה שנייה — אותו לקוח, לא חדש
    const again = await verifyOtp(prisma, f.A.nurseryId, EMAIL, await issueOtp(prisma, f.A.nurseryId, EMAIL));
    expect(again).toMatchObject({ ok: true, created: false, claimedOrders: 0 });
    expect(await prisma.customer.count({ where: { email: EMAIL } })).toBe(1);
  });

  it('DB trigger: an order cannot belong to a customer of another nursery', async () => {
    const c = await prisma.customer.findFirstOrThrow({ where: { nurseryId: f.A.nurseryId, email: EMAIL } });
    const b2 = await guestOrder(f.B.nurseryId, `other-${EMAIL}`);
    await expect(prisma.order.update({ where: { id: b2.id }, data: { customerId: c.id } })).rejects.toThrow(/another nursery/);
  });
});
