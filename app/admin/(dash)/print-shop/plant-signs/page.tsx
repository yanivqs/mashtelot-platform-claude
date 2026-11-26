import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { findSignTemplate, MAX_SIGN_PLANTS } from '@/lib/plant-sign/order';
import { loadSignSources } from '@/lib/plant-sign/load';
import { SignsBuilder, type CatalogPlant } from './signs-builder';

export const dynamic = 'force-dynamic';

/** שלטי צמחים: בחירת צמחים מהמוצרים של המשתלה, עריכת השלטים, תצוגה מקדימה והזמנה מבית הדפוס */
export default async function PlantSignsPage({ searchParams }: { searchParams: Promise<{ ids?: string | string[]; from?: string }> }) {
  const { nurseryId } = await requireNurseryPage({ all: ['print_shop', 'plant_catalog'] });
  const { ids, from } = await searchParams;
  const t = await findSignTemplate(prisma);

  const back = (
    <Link href="/admin/print-shop" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:underline">
      <ArrowRight className="h-4 w-4" />
      בית דפוס
    </Link>
  );

  if (!t) {
    return (
      <div className="max-w-3xl">
        {back}
        <h1 className="mt-2 text-2xl font-bold">שלטי צמחים</h1>
        <p className="mt-4 rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-600">
          שלטי הצמחים אינם זמינים כרגע להזמנה.
        </p>
      </div>
    );
  }

  const products = await prisma.nurseryProduct.findMany({
    where: { nurseryId, deletedAt: null, plantId: { not: null } },
    select: {
      id: true,
      customTitle: true,
      customImageUrl: true,
      signSettings: true,
      plant: { select: { hebrewName: true, latinName: true, imageUrl: true } },
    },
  });
  const catalog: CatalogPlant[] = products
    .map((p) => ({
      id: p.id,
      name: p.plant!.hebrewName,
      latin: p.plant!.latinName,
      title: p.customTitle,
      image: p.customImageUrl || p.plant!.imageUrl || null,
      edited: p.signSettings != null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'he'));

  // צמחים שנבחרו מראש: מרשימת המוצרים (?ids=) או מהזמנה קודמת (?from=עבודה)
  let initial: Array<{ productId: string; quantity: number }> = [];
  if (from) {
    const last = await prisma.printOrder.findFirst({
      where: { nurseryId, plantSigns: { some: {} }, items: { some: { savedRevision: { savedProductId: from } } } },
      orderBy: { createdAt: 'desc' },
      select: { plantSigns: { orderBy: { sortOrder: 'asc' }, select: { nurseryProductId: true, quantity: true } } },
    });
    initial = (last?.plantSigns ?? []).flatMap((s) =>
      s.nurseryProductId ? [{ productId: s.nurseryProductId, quantity: s.quantity }] : [],
    );
  } else if (ids) {
    // ?ids=a,b או ?ids=a&ids=b (מתיבות הסימון ברשימת המוצרים)
    const list = (Array.isArray(ids) ? ids : [ids]).flatMap((x) => x.split(',')).filter(Boolean);
    initial = [...new Set(list)].map((id) => ({ productId: id, quantity: 1 }));
  }
  const sources = await loadSignSources(
    prisma,
    nurseryId,
    initial.slice(0, MAX_SIGN_PLANTS).map((l) => l.productId),
  );
  const qty = new Map(initial.map((l) => [l.productId, l.quantity]));

  return (
    <div className="max-w-6xl">
      {back}
      <div className="mb-6 mt-2">
        <h1 className="text-2xl font-bold">{t.template.title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-600">
          {t.template.description ||
            'שלט מעוצב לכל צמח (15×10 ס"מ): תמונה, שם, תיאור, אור והשקיה, וקוד QR לדף הצמח בחנות. בוחרים צמחים, בודקים את השלטים ומזמינים — בית הדפוס מדפיס ושולח.'}
        </p>
      </div>
      <SignsBuilder
        catalog={catalog}
        initial={sources.map((s) => ({ source: s, quantity: qty.get(s.productId) ?? 1 }))}
        product={{ fields: t.fields, pricing: t.pricing, unitLabel: t.template.unitLabel, leadTimeDays: t.template.leadTimeDays }}
      />
    </div>
  );
}
