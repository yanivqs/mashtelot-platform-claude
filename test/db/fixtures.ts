/**
 * משתלות סינתטיות לבדיקות בידוד (אפיון §2.05, §22.03): A ו-B פעילות, C מושעית.
 * לכל משתלה: בעלים, מוצר, עמוד סטטי, פוסט בלוג, קופון והזמנה — מספיק כדי לבדוק
 * שמשתלה אחת אינה קוראת או משנה נתונים של אחרת. כל ריצה מתויגת ב-runId ייחודי.
 */
import { randomUUID } from 'crypto';
import type { PrismaClient } from '@prisma/client';

export interface TenantFixture {
  key: 'A' | 'B' | 'C';
  nurseryId: string;
  subdomain: string;
  ownerId: string;
  ownerEmail: string;
  productId: string;
  pageId: string;
  blogPostId: string;
  couponId: string;
  orderId: string;
}

export interface TenantFixtures {
  runId: string;
  A: TenantFixture;
  B: TenantFixture;
  C: TenantFixture;
}

async function createTenant(
  prisma: PrismaClient,
  runId: string,
  key: TenantFixture['key'],
  isActive: boolean,
): Promise<TenantFixture> {
  const subdomain = `t${key.toLowerCase()}-${runId}`;
  const ownerEmail = `owner-${key.toLowerCase()}-${runId}@example.invalid`;

  const nursery = await prisma.nursery.create({
    data: { name: `[test] משתלה ${key} ${runId}`, subdomain, ownerEmail, isActive },
  });
  const owner = await prisma.user.create({
    data: { email: ownerEmail, role: 'NURSERY_OWNER', nurseryId: nursery.id },
  });
  const product = await prisma.nurseryProduct.create({
    data: { nurseryId: nursery.id, customTitle: `מוצר ${key}`, price: '50.00', stockQuantity: 10 },
  });
  const page = await prisma.staticPage.create({
    data: {
      nurseryId: nursery.id,
      slug: `about-${key.toLowerCase()}`,
      title: `אודות ${key}`,
      contentHtml: `<p>תוכן מקורי של ${key}</p>`,
      isPublished: true,
    },
  });
  const post = await prisma.blogPost.create({
    data: { nurseryId: nursery.id, slug: `post-${key.toLowerCase()}`, title: `פוסט ${key}` },
  });
  const coupon = await prisma.coupon.create({
    data: { nurseryId: nursery.id, code: `CODE${key}`, discountPct: '10.00' },
  });
  const order = await prisma.order.create({
    data: {
      nurseryId: nursery.id,
      customerName: `לקוח ${key}`,
      customerEmail: `customer-${key.toLowerCase()}-${runId}@example.invalid`,
      customerPhone: '050-0000000',
      totalAmount: '50.00',
      items: {
        create: [{ nurseryProductId: product.id, productTitle: `מוצר ${key}`, quantity: 1, unitPrice: '50.00' }],
      },
    },
  });

  return {
    key,
    nurseryId: nursery.id,
    subdomain,
    ownerId: owner.id,
    ownerEmail,
    productId: product.id,
    pageId: page.id,
    blogPostId: post.id,
    couponId: coupon.id,
    orderId: order.id,
  };
}

export async function createTenantFixtures(prisma: PrismaClient): Promise<TenantFixtures> {
  const runId = randomUUID().slice(0, 8);
  return {
    runId,
    A: await createTenant(prisma, runId, 'A', true),
    B: await createTenant(prisma, runId, 'B', true),
    C: await createTenant(prisma, runId, 'C', false),
  };
}

/** מחיקת כל נתוני הריצה (הזמנות לפני מוצרים; שאר הטבלאות נמחקות ב-cascade). */
export async function destroyTenantFixtures(prisma: PrismaClient, f: TenantFixtures): Promise<void> {
  const ids = [f.A, f.B, f.C].map((t) => t.nurseryId);
  await prisma.order.deleteMany({ where: { nurseryId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: [f.A, f.B, f.C].map((t) => t.ownerId) } } });
  await prisma.nursery.deleteMany({ where: { id: { in: ids } } });
}
