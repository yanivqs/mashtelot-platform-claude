/**
 * C-P0-01: בידוד עמודים סטטיים בין משתלות (אפיון §4.07, §19.01, §38).
 * משתלה A אינה יכולה לשנות, להעביר אליה או למחוק עמוד של משתלה B.
 */
import { randomUUID } from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { saveStaticPage, deleteStaticPage, type StaticPageInput } from '@/lib/static-pages-admin';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

function input(overrides: Partial<StaticPageInput>): StaticPageInput {
  return {
    id: null,
    title: 'עמוד',
    slug: 'page',
    contentHtml: '<p>x</p>',
    isPublished: true,
    showInNav: true,
    sortOrder: 0,
    seoMetaTitle: null,
    seoMetaDescription: null,
    ...overrides,
  };
}

async function pageOf(id: string) {
  return prisma.staticPage.findUnique({ where: { id } });
}

describe('C-P0-01 static pages tenant isolation', () => {
  it("tenant A cannot overwrite tenant B's page by sending B's page id", async () => {
    const before = await pageOf(f.B.pageId);

    const res = await saveStaticPage(
      prisma,
      f.A.nurseryId,
      input({ id: f.B.pageId, title: 'נפרץ', slug: 'hacked', contentHtml: '<p>hacked</p>' }),
    );

    expect(res.ok).toBe(false);
    const after = await pageOf(f.B.pageId);
    expect(after).toEqual(before);
    expect(after?.nurseryId).toBe(f.B.nurseryId);
  });

  it("tenant A cannot delete tenant B's page", async () => {
    const deleted = await deleteStaticPage(prisma, f.A.nurseryId, f.B.pageId);
    expect(deleted).toBe(false);
    expect(await pageOf(f.B.pageId)).not.toBeNull();
  });

  it('an unknown page id is rejected and creates nothing', async () => {
    const countBefore = await prisma.staticPage.count({ where: { nurseryId: f.A.nurseryId } });
    const res = await saveStaticPage(prisma, f.A.nurseryId, input({ id: randomUUID(), slug: 'ghost' }));
    expect(res.ok).toBe(false);
    expect(await prisma.staticPage.count({ where: { nurseryId: f.A.nurseryId } })).toBe(countBefore);
  });

  it('tenant A can still update its own page (regression)', async () => {
    const res = await saveStaticPage(
      prisma,
      f.A.nurseryId,
      input({ id: f.A.pageId, title: 'אודות מעודכן', slug: 'about-a' }),
    );
    expect(res).toEqual({ ok: true, id: f.A.pageId });
    const after = await pageOf(f.A.pageId);
    expect(after?.title).toBe('אודות מעודכן');
    expect(after?.nurseryId).toBe(f.A.nurseryId);
  });

  it('tenant A can create a page, owned by A, even with a slug B already uses', async () => {
    const res = await saveStaticPage(prisma, f.A.nurseryId, input({ slug: 'about-b', title: 'גם לי' }));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect((await pageOf(res.id))?.nurseryId).toBe(f.A.nurseryId);
  });

  it('slug uniqueness is still enforced within a tenant (regression)', async () => {
    const res = await saveStaticPage(prisma, f.A.nurseryId, input({ slug: 'about-a', title: 'כפול' }));
    expect(res).toEqual({ ok: false, error: 'כבר קיים עמוד עם מזהה כתובת זה' });
  });

  it('tenant A can delete its own page (regression)', async () => {
    const created = await saveStaticPage(prisma, f.A.nurseryId, input({ slug: 'to-delete' }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(await deleteStaticPage(prisma, f.A.nurseryId, created.id)).toBe(true);
    expect(await pageOf(created.id)).toBeNull();
  });
});
