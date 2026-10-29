import 'server-only';
import { prisma } from '@/lib/prisma';

export interface SiteLink {
  href: string;
  label: string;
}

/** דפי האתר של המשתלה לבחירת קישור בניהול (הודעת סטיקי וכו'). רק נתוני המשתלה הזו. */
export async function getSiteLinks(nurseryId: string): Promise<SiteLink[]> {
  const [categories, pages, posts] = await Promise.all([
    prisma.nurseryCategory.findMany({
      where: { nurseryId },
      orderBy: [{ parentId: { sort: 'asc', nulls: 'first' } }, { sortOrder: 'asc' }, { name: 'asc' }],
      select: { name: true, slug: true, parent: { select: { name: true } } },
    }),
    prisma.staticPage.findMany({ where: { nurseryId, isPublished: true }, orderBy: { sortOrder: 'asc' }, select: { slug: true, title: true } }),
    prisma.blogPost.findMany({ where: { nurseryId, isPublished: true }, orderBy: { publishedAt: 'desc' }, take: 30, select: { slug: true, title: true } }),
  ]);
  return [
    { href: '/', label: 'דף הבית' },
    { href: '/catalog', label: 'כל הקטלוג' },
    ...categories.map((c) => ({
      href: `/catalog?category=${encodeURIComponent(c.slug)}`,
      label: `קטגוריה: ${c.parent ? `${c.parent.name} ← ` : ''}${c.name}`,
    })),
    ...pages.map((p) => ({ href: `/${p.slug}`, label: `עמוד: ${p.title}` })),
    ...posts.map((p) => ({ href: `/blog/${p.slug}`, label: `פוסט: ${p.title}` })),
    { href: '/contact', label: 'צור קשר' },
  ];
}
