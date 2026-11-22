import Link from 'next/link';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { formatPrice } from '@/lib/utils';
import { parseFields, parsePricing } from '@/lib/print-template';
import { parseDesignRule } from '@/lib/print-designs';

/** כרטיסי מוצרי הדפוס והקטגוריות בקטלוג של המשתלה (דף ראשי ודף קטגוריה). */

export interface ProductCard {
  id: string;
  href: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  leadTimeDays: number | null;
  priceLabel: string;
}

export async function loadProductCards(where: Prisma.PrintTemplateWhereInput): Promise<ProductCard[]> {
  const versions = await prisma.printTemplateVersion.findMany({
    where: { status: 'PUBLISHED', template: { isActive: true, ...where } },
    include: { template: { include: { _count: { select: { designs: { where: { isActive: true, nurseryId: null } } } } } } },
    orderBy: [{ template: { sortOrder: 'asc' } }, { template: { createdAt: 'asc' } }],
  });
  return versions.flatMap((v) => {
    const pricing = parsePricing(v.pricing);
    if (!parseFields(v.fields).ok || !pricing.ok) return [];
    const p = pricing.value;
    const prices = [...(p.basePrice > 0 ? [p.basePrice] : []), ...p.tiers.map((x) => x.unitPrice)];
    const rule = parseDesignRule(v.template.designRule);
    const count = v.template._count.designs;
    let priceLabel = p.quoteOnly || prices.length === 0 ? 'בהצעת מחיר' : `החל מ-${formatPrice(Math.min(...prices))} ליחידה`;
    if (rule && count > 0) priceLabel = `${count} דוגמאות · ${priceLabel}`;
    return [
      {
        id: v.id,
        href: `/admin/print-shop/${v.template.slug ?? v.template.id}`,
        title: v.template.title,
        description: v.template.description,
        imageUrl: v.template.imageUrl,
        leadTimeDays: v.template.leadTimeDays,
        priceLabel,
      },
    ];
  });
}

export interface CategoryTile {
  id: string;
  slug: string;
  name: string;
  imageUrl: string | null;
  /** לאן הקישור מוביל: דף הקטגוריה, או ישר למוצר כשהוא היחיד בה */
  href: string;
}

/**
 * קטגוריות פעילות שיש בהן (ישירות או בתת-קטגוריה) מוצר זמין. קטגוריה בלי תתי-קטגוריות ועם מוצר
 * אחד בלבד (כמו "כרטיסי ברכה בינוניים") מובילה ישר למוצר ומציגה את התמונה שלו — כדי לחסוך דף ביניים
 * עם כרטיס יחיד, וכדי שהחלפת התמונה הראשית של המוצר תיראה בקטלוג.
 */
export async function loadCategoryTiles(parentId: string | null): Promise<CategoryTile[]> {
  const live: Prisma.PrintTemplateWhereInput = { isActive: true, versions: { some: { status: 'PUBLISHED' } } };
  const cats = await prisma.printCategory.findMany({
    where: {
      parentId,
      isActive: true,
      OR: [{ templates: { some: live } }, { children: { some: { isActive: true, templates: { some: live } } } }],
    },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      imageUrl: true,
      _count: { select: { children: { where: { isActive: true, templates: { some: live } } } } },
      templates: { where: live, select: { id: true, slug: true, imageUrl: true }, take: 2 },
    },
  });
  return cats.map(({ _count, templates, ...c }) => {
    const only = _count.children === 0 && templates.length === 1 ? templates[0]! : null;
    return only
      ? { ...c, imageUrl: only.imageUrl ?? c.imageUrl, href: `/admin/print-shop/${only.slug ?? only.id}` }
      : { ...c, href: `/admin/print-shop/c/${c.slug}` };
  });
}

const cardClass = 'group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:border-brand-300';

export function CategoryGrid({ tiles }: { tiles: CategoryTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <ul className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="print-categories">
      {tiles.map((c) => (
        <li key={c.id}>
          <Link href={c.href} className={cardClass}>
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt="" className="h-40 w-full bg-white object-contain p-2" />
            ) : (
              <span className="flex h-40 w-full items-center justify-center bg-brand-50 text-brand-700">
                <FolderOpen className="h-10 w-10" aria-hidden />
              </span>
            )}
            <span className="flex items-center justify-between gap-2 p-4">
              <span className="font-bold">{c.name}</span>
              <ArrowLeft className="h-4 w-4 text-brand-700" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ProductGrid({ cards }: { cards: ProductCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <Link key={c.id} href={c.href} className={cardClass}>
          {c.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imageUrl} alt="" className="h-40 w-full object-cover" />
          ) : (
            <div className="h-40 w-full bg-gray-100" />
          )}
          <div className="flex flex-1 flex-col p-4">
            <h2 className="font-bold">{c.title}</h2>
            {c.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{c.description}</p>}
            <p className="mt-2 text-sm font-medium text-gray-900">{c.priceLabel}</p>
            {c.leadTimeDays ? <p className="text-xs text-gray-600">זמן הפקה {c.leadTimeDays} ימים</p> : null}
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700">
              להזמנה <ArrowLeft className="h-4 w-4" />
            </span>
          </div>
        </Link>
      ))}
    </section>
  );
}
