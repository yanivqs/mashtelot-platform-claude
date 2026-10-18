/**
 * קישור "בלוג" בתפריט החנות: מוצג רק כשמודול הבלוג פעיל ויש לפחות פוסט מפורסם אחד.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// lib/module-access מסומן server-only; בבדיקה רצים ישירות מול ה-DB
vi.mock('server-only', () => ({}));

import { prisma } from '@/lib/prisma';
import { hasPublicBlog } from '@/lib/pages';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

function setBlogModule(nurseryId: string, isEnabled: boolean) {
  return prisma.nurseryModule.upsert({
    where: { nurseryId_moduleKey: { nurseryId, moduleKey: 'blog' } },
    create: { nurseryId, moduleKey: 'blog', isEnabled },
    update: { isEnabled },
  });
}

describe('hasPublicBlog (storefront nav)', () => {
  it('false when the blog module is disabled, even with a published post', async () => {
    await setBlogModule(f.A.nurseryId, false);
    await prisma.blogPost.update({ where: { id: f.A.blogPostId }, data: { isPublished: true } });
    expect(await hasPublicBlog(f.A.nurseryId)).toBe(false);
  });

  it('false when the module is enabled but there are only drafts', async () => {
    await setBlogModule(f.A.nurseryId, true);
    await prisma.blogPost.update({ where: { id: f.A.blogPostId }, data: { isPublished: false } });
    expect(await hasPublicBlog(f.A.nurseryId)).toBe(false);
  });

  it('true when the module is enabled and a post is published', async () => {
    await prisma.blogPost.update({ where: { id: f.A.blogPostId }, data: { isPublished: true } });
    expect(await hasPublicBlog(f.A.nurseryId)).toBe(true);
  });

  it("another nursery's published posts do not count", async () => {
    await setBlogModule(f.B.nurseryId, true);
    expect(await hasPublicBlog(f.B.nurseryId)).toBe(false);
  });
});
