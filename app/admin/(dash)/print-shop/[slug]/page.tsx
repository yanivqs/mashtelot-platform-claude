import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { parseFields, parsePricing, type CleanValues } from '@/lib/print-template';
import { PrintCalculator, type CalculatorPrefill } from '@/components/print/calculator';
import type { PreflightResult } from '@/lib/print-preflight';
import { DesignPicker } from '@/components/print/design-picker';
import { describeRule, parseDesignRule } from '@/lib/print-designs';
import { ProductGallery } from './gallery';

export const dynamic = 'force-dynamic';

function NotFound() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold">המוצר לא נמצא</h1>
      <p className="mt-2 text-sm text-gray-600">ייתכן שהמוצר הוסר או שהכתובת השתנתה.</p>
      <Link href="/admin/print-shop" className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
        לקטלוג מוצרי הדפוס
      </Link>
    </div>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PrintProductPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string }> }) {
  const { nurseryId } = await requireNurseryPage({ all: ['print_shop'] });
  const { slug } = await params;
  const { from } = await searchParams;

  const version = await prisma.printTemplateVersion.findFirst({
    where: { status: 'PUBLISHED', template: { isActive: true, OR: [{ slug }, ...(UUID_RE.test(slug) ? [{ id: slug }] : [])] } },
    include: { template: { include: { printCategory: { include: { parent: true } } } } },
  });
  const fields = version ? parseFields(version.fields) : null;
  const pricing = version ? parsePricing(version.pricing) : null;
  if (!version || !fields?.ok || !pricing?.ok) return <NotFound />;
  const t = version.template;
  // שלטי צמחים — עמוד ייעודי (בחירת צמחים ועריכת השלטים), לא המחשבון
  if (t.kind === 'PLANT_SIGN') redirect('/admin/print-shop/plant-signs');

  // "הזמנה דומה": ממלאים מעבודה קיימת של המשתלה בלבד. ערך שכבר לא קיים יופיע ברשימת החוסרים.
  let prefill: CalculatorPrefill | undefined;
  if (from && UUID_RE.test(from)) {
    const job = await prisma.printSavedProduct.findFirst({
      where: { id: from, nurseryId, templateId: t.id },
      include: {
        revisions: { orderBy: { revision: 'desc' }, take: 1, include: { orderItems: { orderBy: { printOrder: { createdAt: 'desc' } }, take: 1, select: { quantity: true } } } },
        artworks: { include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { file: { include: { thumbnail: { select: { fileId: true } } } } } } } },
      },
    });
    if (job) {
      const f = job.artworks[0]?.versions[0]?.file;
      prefill = {
        values: ((job.revisions[0]?.values as { raw?: CleanValues } | null)?.raw ?? {}) as CalculatorPrefill['values'],
        quantity: job.revisions[0]?.orderItems[0]?.quantity ?? null,
        file: f
          ? {
              id: f.id,
              name: f.originalName,
              mimeType: f.mimeType,
              widthPx: f.widthPx,
              heightPx: f.heightPx,
              critical: (f.preflight as PreflightResult | null)?.critical ?? [],
              thumbnailUrl: f.thumbnail ? `/api/print-files/${f.id}/thumbnail` : null,
            }
          : null,
      };
    }
  }

  const images = [...(t.imageUrl ? [t.imageUrl] : []), ...t.galleryImages.filter((u) => u !== t.imageUrl)];
  const product = {
    versionId: version.id,
    title: t.title,
    unitLabel: t.unitLabel,
    leadTimeDays: t.leadTimeDays,
    requiresArtwork: t.requiresArtwork,
    fields: fields.value,
    pricing: pricing.value,
  };
  const designRule = parseDesignRule(t.designRule);
  // דוגמאות כלליות, ודוגמאות שהוכנו למשתלה הזו (ראשונות)
  const designs = designRule
    ? (
        await prisma.printDesign.findMany({
          where: { templateId: t.id, isActive: true, OR: [{ nurseryId: null }, { nurseryId }] },
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          select: { id: true, code: true, title: true, imageUrl: true, tags: true, nurseryId: true },
        })
      )
        .map(({ nurseryId: owner, ...d }) => ({ ...d, own: owner === nurseryId }))
        .sort((x, y) => Number(y.own) - Number(x.own))
    : [];
  const cat = t.printCategory;
  // קטגוריה שהמוצר הוא היחיד בה מובילה ישר אליו (catalog.tsx), ולכן החזרה היא לקטגוריה שמעליה
  const alone =
    cat &&
    (await prisma.printTemplate.count({ where: { categoryId: cat.id, isActive: true, versions: { some: { status: 'PUBLISHED' } } } })) === 1 &&
    (await prisma.printCategory.count({ where: { parentId: cat.id, isActive: true } })) === 0;
  const up = alone ? cat.parent : cat;
  const back = up ? { href: `/admin/print-shop/c/${up.slug}`, label: `חזרה ל${up.name}` } : { href: '/admin/print-shop', label: 'לכל מוצרי הדפוס' };

  return (
    <div className="max-w-5xl space-y-6">
      <Link href={back.href} className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowRight className="h-4 w-4" />
        {back.label}
      </Link>
      {designRule ? (
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          {t.description && <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-gray-600">{t.description}</p>}
          <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm text-brand-900">
            {describeRule(designRule)}
            {t.requiresArtwork && ' הלוגו ופרטי העסק מודפסים על הכרטיס.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row">
          {images.length > 0 && <ProductGallery images={images} title={t.title} />}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">{t.title}</h1>
            {t.description && <p className="mt-2 whitespace-pre-line text-sm text-gray-600">{t.description}</p>}
          </div>
        </div>
      )}
      {designRule ? <DesignPicker product={product} designs={designs} rule={designRule} /> : <PrintCalculator prefill={prefill} product={product} />}
    </div>
  );
}
