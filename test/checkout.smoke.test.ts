/**
 * בדיקת smoke על מסלול ה-checkout מול ה-DB האמיתי (לא mock) — יוצרת משתלה/מוצר/
 * קופון זמניים, מריצה אותם דפוסי שאילתה בדיוק כמו app/[tenant]/checkout/actions.ts,
 * ומנקה את עצמה ב-afterAll. לא נוגעת בנתונים אמיתיים של אף משתלה קיימת.
 *
 * למה לא בודקים ישירות את `createOrder`: הפונקציה מייבאת `lib/tenant.ts` ו-
 * `lib/module-access.ts` שמשתמשות ב-`cache` מ-`react` (זמין רק בזמן build של
 * Next, לא ב-Node רגיל) ו-`lib/rate-limit.ts` שקוראת ל-`headers()` מ-
 * `next/headers` (דורש הקשר בקשה פעיל). לכן הבדיקה מכוונת ישירות ל-DB באמצעות
 * אותם דפוסי Prisma בדיוק — זה מה שבאמת קריטי לבדוק (בטיחות מרוץ-תנאים), בלי
 * להזדקק ל-mock שביר לפרטי המימוש הפנימיים של Next/React.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { calcSubtotal, applyDiscount } from '@/lib/checkout-calc';

const RUN_ID = randomUUID().slice(0, 8);
let nurseryId: string;
let productId: string;

beforeAll(async () => {
  const nursery = await prisma.nursery.create({
    data: {
      name: `[smoke] ${RUN_ID}`,
      subdomain: `smoke-${RUN_ID}`,
      ownerEmail: `smoke-${RUN_ID}@example.invalid`,
    },
  });
  nurseryId = nursery.id;

  const supply = await prisma.masterSupply.create({
    data: { title: `[smoke] מוצר בדיקה ${RUN_ID}` },
  });

  const product = await prisma.nurseryProduct.create({
    data: {
      nurseryId,
      supplyId: supply.id,
      price: '100.00',
      stockQuantity: 5,
    },
  });
  productId = product.id;
});

afterAll(async () => {
  await prisma.orderItem.deleteMany({ where: { nurseryProduct: { nurseryId } } });
  await prisma.order.deleteMany({ where: { nurseryId } });
  await prisma.coupon.deleteMany({ where: { nurseryId } });
  const product = await prisma.nurseryProduct.findUnique({ where: { id: productId } });
  await prisma.nurseryProduct.deleteMany({ where: { nurseryId } });
  if (product?.supplyId) await prisma.masterSupply.deleteMany({ where: { id: product.supplyId } });
  await prisma.nursery.deleteMany({ where: { id: nurseryId } });
});

describe('checkout smoke: price + coupon math against real DB rows', () => {
  it('computes subtotal and discount from a Prisma Decimal price', async () => {
    const product = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: productId } });
    const lineItems = [
      {
        nurseryProductId: product.id,
        productTitle: 'test',
        quantity: 2,
        unitPrice: Number(product.price),
      },
    ];
    const subtotal = calcSubtotal(lineItems);
    expect(subtotal).toBe(200);
    expect(applyDiscount(subtotal, 10)).toBe(180);
  });
});

describe('checkout smoke: stock decrement race safety', () => {
  it('lets only one of two concurrent decrements past a shared stock pool', async () => {
    // מלאי=5, שתי בקשות מקבילות ל-3 יחידות כל אחת — רק אחת יכולה להצליח
    const attempt = () =>
      prisma.nurseryProduct.updateMany({
        where: { id: productId, stockQuantity: { gte: 3 } },
        data: { stockQuantity: { decrement: 3 } },
      });

    const [a, b] = await Promise.all([attempt(), attempt()]);
    const successes = [a.count, b.count].filter((c) => c === 1).length;
    expect(successes).toBe(1);

    const product = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stockQuantity).toBe(2); // 5 - 3, פעם אחת בלבד — לא ירד למינוס
  });

  it('rejects a decrement larger than remaining stock', async () => {
    const res = await prisma.nurseryProduct.updateMany({
      where: { id: productId, stockQuantity: { gte: 3 } },
      data: { stockQuantity: { decrement: 3 } },
    });
    expect(res.count).toBe(0); // נשארו רק 2 יחידות

    const product = await prisma.nurseryProduct.findUniqueOrThrow({ where: { id: productId } });
    expect(product.stockQuantity).toBe(2); // לא זז
  });
});

describe('checkout smoke: coupon usage-limit race safety', () => {
  it('lets only one of two concurrent redemptions exhaust a single-use coupon', async () => {
    const coupon = await prisma.coupon.create({
      data: {
        nurseryId,
        code: `SMOKE${RUN_ID}`,
        discountPct: '10.00',
        usageLimit: 1,
      },
    });

    const attempt = () =>
      prisma.coupon.updateMany({
        where: { id: coupon.id, usageCount: { lt: coupon.usageLimit! } },
        data: { usageCount: { increment: 1 } },
      });

    const [a, b] = await Promise.all([attempt(), attempt()]);
    const successes = [a.count, b.count].filter((c) => c === 1).length;
    expect(successes).toBe(1);

    const after = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } });
    expect(after.usageCount).toBe(1); // לא 2 — המכסה לא נחצתה
  });

  it('rejects a date-expired coupon at the application layer', async () => {
    const { assertCouponValid } = await import('@/lib/checkout-calc');
    const coupon = await prisma.coupon.create({
      data: {
        nurseryId,
        code: `SMOKEEXPIRED${RUN_ID}`,
        discountPct: '10.00',
        endsAt: new Date('2000-01-01'),
      },
    });
    expect(() => assertCouponValid(coupon)).toThrow(/פג תוקף/);
  });
});
