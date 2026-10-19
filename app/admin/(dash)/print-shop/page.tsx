import { itemDisplay } from '@/lib/print-templates-admin';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { formatPrice } from '@/lib/utils';
import { parsePriceTiers } from '@/lib/print-pricing';
import { PrintOrderForm, type PrintProductVM } from './order-form';
import { TemplateCatalog, type TemplateVM } from './template-order';
import { SavedProducts, type SavedVM } from './saved-products';
import type { CleanValues } from '@/lib/print-template';
import { artworkInclude, artworkVersionsVM } from '@/lib/print-artwork-view';
import { ArtworkPanel } from '@/components/print/artwork-panel';
import { parseFields, parsePricing } from '@/lib/print-template';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  QUOTE_REQUESTED: 'ממתינה להצעת מחיר',
  NEW: 'התקבלה',
  IN_PRODUCTION: 'בהפקה',
  SHIPPED: 'נשלחה',
  DELIVERED: 'נמסרה',
  CANCELLED: 'בוטלה',
};

export default async function PrintShopPage() {
  const { nurseryId } = await requireNurseryPage({ all: ['print_shop'] });

  const [templates, products, options, orders] = await Promise.all([
    // PT-02: מוצרים מתבניות — הגרסה המפורסמת של כל תבנית פעילה
    prisma.printTemplateVersion.findMany({
      where: { status: 'PUBLISHED', template: { isActive: true } },
      include: { template: true },
      orderBy: [{ template: { sortOrder: 'asc' } }, { template: { createdAt: 'asc' } }],
    }),
    prisma.printProduct.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { basePrice: 'asc' }],
    }),
    prisma.printGlobalOption.findMany({ orderBy: { optionName: 'asc' } }),
    nurseryId
      ? prisma.printOrder.findMany({
          where: { nurseryId },
          include: { items: { include: { printProduct: { select: { title: true } } } }, artworks: { include: artworkInclude } },
          orderBy: { createdAt: 'desc' },
        })
      : Promise.resolve([]),
  ]);

  const templateVm: TemplateVM[] = templates.flatMap((v) => {
    const fields = parseFields(v.fields);
    const pricing = parsePricing(v.pricing);
    if (!fields.ok || !pricing.ok) return [];
    return [{
      versionId: v.id,
      title: v.template.title,
      description: v.template.description,
      imageUrl: v.template.imageUrl,
      unitLabel: v.template.unitLabel,
      leadTimeDays: v.template.leadTimeDays,
      fields: fields.value,
      pricing: pricing.value,
    }];
  });

  // PT-04: המוצרים הקבועים של המשתלה — מפרט מאושר, בקשה אחרונה, וטופס שינוי לפי הגרסה המפורסמת
  const saved = await prisma.printSavedProduct.findMany({
    where: { nurseryId, isArchived: false },
    orderBy: { createdAt: 'desc' },
    include: {
      template: { include: { versions: { where: { status: 'PUBLISHED' } } } },
      activeRevision: { include: { templateVersion: true } },
      revisions: { orderBy: { revision: 'desc' }, take: 1 },
      artworks: { include: artworkInclude },
    },
  });
  const savedVm: SavedVM[] = await Promise.all(saved.map(async (s) => {
    const a = s.activeRevision;
    const af = a ? parseFields(a.templateVersion.fields) : null;
    const ap = a ? parsePricing(a.templateVersion.pricing) : null;
    const av = (a?.values ?? {}) as { raw?: CleanValues; display?: Array<{ label: string; value: string }> };
    const latest = s.revisions[0];
    const pub = s.template.isActive ? s.template.versions[0] : undefined;
    const pf = pub ? parseFields(pub.fields) : null;
    const prefillFrom = (latest?.values ?? a?.values ?? {}) as { raw?: CleanValues };
    return {
      id: s.id,
      name: s.name,
      templateTitle: s.template.title,
      active: a && af?.ok && ap?.ok ? { revision: a.revision, display: av.display ?? [], raw: av.raw ?? {}, fields: af.value, pricing: ap.value } : null,
      latest: latest && (latest.status === 'SUBMITTED' || latest.status === 'REJECTED') ? { revision: latest.revision, status: latest.status, note: latest.reviewNote } : null,
      change: pub && pf?.ok ? { templateVersionId: pub.id, fields: pf.value, prefill: prefillFrom.raw ?? {} } : null,
      artwork: await artworkVersionsVM(s.artworks[0]?.versions ?? []),
    };
  }));

  // PT-05: גרפיקה להזמנה חד-פעמית מתבנית (במוצר קבוע הגרפיקה שייכת למוצר)
  const orderArtwork = new Map(
    await Promise.all(
      orders
        .filter((o) => o.items.some((i) => i.templateVersionId && !i.savedRevisionId))
        .map(async (o) => [o.id, await artworkVersionsVM(o.artworks[0]?.versions ?? [])] as const),
    ),
  );

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
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">בית דפוס (הזמנות B2B)</h1>
      <p className="mb-6 text-sm text-gray-500">
        הזמנת שלטים, תוויות ופריטי מיתוג לחנות מבית הדפוס של הפלטפורמה.
      </p>

      {savedVm.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">המוצרים הקבועים שלי</h2>
          <SavedProducts items={savedVm} />
        </section>
      )}

      {templateVm.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">מוצרי דפוס</h2>
          <TemplateCatalog templates={templateVm} />
        </section>
      )}

      {vm.length > 0 && <PrintOrderForm products={vm} options={options.map((o) => ({ id: o.id, optionName: o.optionName, extraPrice: o.extraPrice.toString() }))} />}

      {orders.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 font-bold text-gray-900">ההזמנות שלי</h2>
          <div className="space-y-2">
            {orders.map((o) => (
              <div key={o.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    {o.createdAt.toLocaleDateString('he-IL')}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </div>
                <ul className="mt-2 text-sm text-gray-600">
                  {o.items.map((it) => (
                    <li key={it.id}>
                      {itemDisplay(it).title} × {it.quantity}
                      {itemDisplay(it).details.length > 0 && (
                        <span className="block text-xs text-gray-500">{itemDisplay(it).details.join(' · ')}</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-sm font-medium">{formatPrice(o.totalAmount.toString())}</p>
                {orderArtwork.has(o.id) && (
                  <div className="mt-3">
                    <ArtworkPanel subject={{ printOrderId: o.id }} versions={orderArtwork.get(o.id)!} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
