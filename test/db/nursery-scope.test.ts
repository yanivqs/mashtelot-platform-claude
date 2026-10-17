/**
 * C-P1-01: שכבת ההרשאות המרכזית מול נתונים אמיתיים (אפיון §2.03, §4.07, §15.02, §16 קבלה).
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ModuleKey } from '@/lib/modules';
import { prisma } from '@/lib/prisma';
import { decideNurseryAccess, isSessionAllowed, type AccessSubject } from '@/lib/nursery-access';
import { assertOwnedBy, isOwnedBy, OwnershipError, type OwnedModel } from '@/lib/ownership';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixture, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const extra: Record<'A' | 'B', { promotionId: string; zoneId: string; categoryId: string }> = {} as never;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  for (const t of [f.A, f.B]) {
    const key = t.key as 'A' | 'B';
    const promotion = await prisma.promotion.create({ data: { nurseryId: t.nurseryId, title: `מבצע ${key}` } });
    const zone = await prisma.shippingZone.create({
      data: { nurseryId: t.nurseryId, name: `אזור ${key}`, shippingPrice: '30.00' },
    });
    const category = await prisma.nurseryCategory.create({
      data: { nurseryId: t.nurseryId, name: `קטגוריה ${key}`, slug: `cat-${key.toLowerCase()}-${f.runId}` },
    });
    extra[key] = { promotionId: promotion.id, zoneId: zone.id, categoryId: category.id };
  }
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

function idsOf(t: TenantFixture): Record<OwnedModel, string> {
  const e = extra[t.key as 'A' | 'B'];
  return {
    coupon: t.couponId,
    promotion: e.promotionId,
    shippingZone: e.zoneId,
    nurseryProduct: t.productId,
    nurseryCategory: e.categoryId,
    order: t.orderId,
    staticPage: t.pageId,
    blogPost: t.blogPostId,
  };
}

async function subjectFor(userId: string): Promise<AccessSubject> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { nursery: true } });
  return { role: u.role, nurseryId: u.nurseryId, nurseryActive: u.nursery ? u.nursery.isActive : null };
}

async function enabledModules(nurseryId: string): Promise<Set<ModuleKey>> {
  const rows = await prisma.nurseryModule.findMany({ where: { nurseryId, isEnabled: true } });
  return new Set(rows.map((r) => r.moduleKey as ModuleKey));
}

describe('C-P1-01 ownership across tenants', () => {
  const models: OwnedModel[] = [
    'coupon',
    'promotion',
    'shippingZone',
    'nurseryProduct',
    'nurseryCategory',
    'order',
    'staticPage',
    'blogPost',
  ];

  for (const model of models) {
    it(`${model}: A owns its own, not B's, and not an unknown id`, async () => {
      const a = idsOf(f.A)[model];
      const b = idsOf(f.B)[model];
      expect(await isOwnedBy(prisma, model, a, f.A.nurseryId)).toBe(true);
      expect(await isOwnedBy(prisma, model, b, f.A.nurseryId)).toBe(false);
      expect(await isOwnedBy(prisma, model, randomUUID(), f.A.nurseryId)).toBe(false);
      await expect(assertOwnedBy(prisma, model, b, f.A.nurseryId)).rejects.toBeInstanceOf(OwnershipError);
    });
  }
});

describe('C-P1-01 access decision with real data', () => {
  it('suspended nursery C: session revoked and every action denied', async () => {
    const c = await subjectFor(f.C.ownerId);
    expect(isSessionAllowed(c)).toBe(false);
    expect(decideNurseryAccess(c, await enabledModules(f.C.nurseryId))).toEqual({
      ok: false,
      reason: 'NURSERY_SUSPENDED',
    });
  });

  it('owner A: denied while the module is off, granted once the platform enables it', async () => {
    const a = await subjectFor(f.A.ownerId);
    expect(decideNurseryAccess(a, await enabledModules(f.A.nurseryId), { all: ['orders'] })).toEqual({
      ok: false,
      reason: 'MODULE_DISABLED',
    });
    await prisma.nurseryModule.create({ data: { nurseryId: f.A.nurseryId, moduleKey: 'orders', isEnabled: true } });
    expect(decideNurseryAccess(a, await enabledModules(f.A.nurseryId), { all: ['orders'] })).toEqual({
      ok: true,
      nurseryId: f.A.nurseryId,
    });
    // מודול שהופעל ל-A אינו פותח את B
    const b = await subjectFor(f.B.ownerId);
    expect(decideNurseryAccess(b, await enabledModules(f.B.nurseryId), { all: ['orders'] }).ok).toBe(false);
  });

  it('owner A always resolves to its own nursery — never another one', async () => {
    const a = await subjectFor(f.A.ownerId);
    const res = decideNurseryAccess(a, await enabledModules(f.A.nurseryId));
    expect(res).toEqual({ ok: true, nurseryId: f.A.nurseryId });
  });

  it('a super admin gets no store-level access even if attached to a nursery', async () => {
    const admin = await prisma.user.create({
      data: { email: `admin-${f.runId}@example.invalid`, role: 'SUPER_ADMIN', nurseryId: f.A.nurseryId },
    });
    try {
      const s = await subjectFor(admin.id);
      expect(decideNurseryAccess(s, await enabledModules(f.A.nurseryId))).toEqual({
        ok: false,
        reason: 'PLATFORM_ROLE',
      });
      expect(isSessionAllowed(s)).toBe(true);
    } finally {
      await prisma.user.delete({ where: { id: admin.id } });
    }
  });
});
