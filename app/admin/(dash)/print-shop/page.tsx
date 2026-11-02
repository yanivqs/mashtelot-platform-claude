import Link from 'next/link';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { formatPrice } from '@/lib/utils';
import { parsePriceTiers } from '@/lib/print-pricing';
import { parseFields, parsePricing } from '@/lib/print-template';
import { PrintOrderForm, type PrintProductVM } from './order-form';

export const dynamic = 'force-dynamic';

/** קטלוג בית הדפוס של המשתלה. כל מוצר נפתח בדף משלו עם מחשבון. */
export default async function PrintShopPage() {
  const { nurseryId } = await requireNurseryPage({ all: ['print_shop'] });

  const [templates, products, options, jobCount] = await Promise.all([
    prisma.printTemplateVersion.findMany({
      where: { status: 'PUBLISHED', template: { isActive: true } },
      include: { template: true },
      orderBy: [{ template: { sortOrder: 'asc' } }, { template: { createdAt: 'asc' } }],
    }),
    // מוצרים ישנים: הטופס הישן מוצג רק כל עוד יש כאלה פעילים
    prisma.printProduct.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { basePrice: 'asc' }] }),
    prisma.printGlobalOption.findMany({ orderBy: { optionName: 'asc' } }),
    prisma.printSavedProduct.count({ where: { nurseryId, isArchived: false } }),
  ]);

  const cards = templates.flatMap((v) => {
    const pricing = parsePricing(v.pricing);
    if (!parseFields(v.fields).ok || !pricing.ok) return [];
    const p = pricing.value;
    const prices = [...(p.basePrice > 0 ? [p.basePrice] : []), ...p.tiers.map((x) => x.unitPrice)];
    return [
      {
        id: v.id,
        href: `/admin/print-shop/${v.template.slug ?? v.template.id}`,
        title: v.template.title,
        description: v.template.description,
        imageUrl: v.template.imageUrl,
        leadTimeDays: v.template.leadTimeDays,
        priceLabel: p.quoteOnly || prices.length === 0 ? 'בהצעת מחיר' : `החל מ-${formatPrice(Math.min(...prices))} ליחידה`,
      },
    ];
  });

  const vm: PrintProductVM[] = products.map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    description: p.description,
    specs: p.specs,
    imageUrl: p.imageUrl,
    basePrice: p.basePrice.toString(),
    unitLabel: p.unitLabel,
    minQuantity: p.minQuantity,
    leadTimeDays: p.leadTimeDays,
    priceTiers: parsePriceTiers(p.priceTiers),
    requiresArtwork: p.requiresArtwork,
    allowOptions: p.allowOptions,
  }));

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">בית דפוס</h1>
          <p className="mt-1 text-sm text-gray-600">שלטים, תוויות ופריטי מיתוג. בוחרים מוצר, מקבלים מחיר ומזמינים.</p>
        </div>
        <Link href="/admin/print-shop/jobs" className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800">
          <FolderOpen className="h-4 w-4" />
          העבודות שלי{jobCount > 0 ? ` (${jobCount})` : ''}
        </Link>
      </div>

      {cards.length > 0 ? (
        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c.id} href={c.href} className="group flex flex-col overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm hover:border-brand-300">
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
      ) : (
        vm.length === 0 && <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-600">אין כרגע מוצרי דפוס להזמנה.</p>
      )}

      {vm.length > 0 && <PrintOrderForm products={vm} options={options.map((o) => ({ id: o.id, optionName: o.optionName, extraPrice: o.extraPrice.toString() }))} />}
    </div>
  );
}
