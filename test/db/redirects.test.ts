/**
 * §14.01: הפניות — בידוד בין משתלות, קיצור שרשראות, יבוא ומונה כניסות.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { deleteRedirect, findRedirect, importRedirects, saveRedirect } from '@/lib/redirects-admin';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('redirects', () => {
  it('saves a normalized rule and resolves it with a hit counter', async () => {
    const res = await saveRedirect(prisma, f.A.nurseryId, 'https://old.example/About-Us.html?x=1', '/about');
    expect(res).toMatchObject({ ok: true, from: '/about-us.html', to: '/about' });
    expect(await findRedirect(prisma, f.A.nurseryId, '/about-us.html')).toBe('/about');
    const row = await prisma.redirect.findUnique({
      where: { nurseryId_fromPath: { nurseryId: f.A.nurseryId, fromPath: '/about-us.html' } },
    });
    expect(row?.hits).toBe(1);
    expect(row?.lastHitAt).not.toBeNull();
  });

  it("tenant B does not see or delete tenant A's rules", async () => {
    expect(await findRedirect(prisma, f.B.nurseryId, '/about-us.html')).toBeNull();
    const rule = await prisma.redirect.findFirstOrThrow({ where: { nurseryId: f.A.nurseryId } });
    expect(await deleteRedirect(prisma, f.B.nurseryId, rule.id)).toBe(false);
    expect(await prisma.redirect.findUnique({ where: { id: rule.id } })).not.toBeNull();
  });

  it('the same old path can exist for two nurseries independently', async () => {
    expect(await saveRedirect(prisma, f.B.nurseryId, '/about-us.html', '/contact')).toMatchObject({ ok: true });
    expect(await findRedirect(prisma, f.A.nurseryId, '/about-us.html')).toBe('/about');
    expect(await findRedirect(prisma, f.B.nurseryId, '/about-us.html')).toBe('/contact');
  });

  it('flattens chains in both directions and refuses loops', async () => {
    await saveRedirect(prisma, f.A.nurseryId, '/x', '/old');
    const r = await saveRedirect(prisma, f.A.nurseryId, '/old', '/new');
    expect(r).toMatchObject({ ok: true, retargeted: 1 });
    expect(await findRedirect(prisma, f.A.nurseryId, '/x')).toBe('/new');
    expect(await saveRedirect(prisma, f.A.nurseryId, '/z', '/old')).toMatchObject({ ok: true, to: '/new' });
    expect(await saveRedirect(prisma, f.A.nurseryId, '/new', '/x')).toMatchObject({ ok: false, error: 'ההפניה יוצרת לולאה' });
  });

  it('imports CSV rows, updates existing ones and reports bad lines', async () => {
    const res = await importRedirects(prisma, f.A.nurseryId, 'from,to\n/p1.php,/catalog\n/about-us.html,/contact\n/bad,https://evil.com');
    expect(res.saved).toBe(2);
    expect(res.errors).toHaveLength(1);
    expect(res.errors[0]!.line).toBe(4);
    expect(await findRedirect(prisma, f.A.nurseryId, '/about-us.html')).toBe('/contact');
  });
});
