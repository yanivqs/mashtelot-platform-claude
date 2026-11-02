import Link from 'next/link';
import { FileText } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseFields } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';
import { ImportedJobTools, NewImportedJobForm, type TemplateOption } from './forms';

export const dynamic = 'force-dynamic';

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short' });

/** עבודות קודמות: הסופר-אדמין מוסיף למשתלה עבודות שהודפסו בעבר, והיא מזמינה אותן שוב מ"העבודות שלי". */
export default async function ImportedPrintJobsPage(props: { searchParams: Promise<{ nursery?: string }> }) {
  await requireUser(['SUPER_ADMIN']);
  const searchParams = await props.searchParams;
  const [nurseries, versions] = await Promise.all([
    prisma.nursery.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.printTemplateVersion.findMany({ where: { status: 'PUBLISHED' }, include: { template: { select: { id: true, title: true } } }, orderBy: { template: { title: 'asc' } } }),
  ]);
  const templates: TemplateOption[] = versions.flatMap((v) => {
    const f = parseFields(v.fields);
    return f.ok ? [{ id: v.template.id, title: v.template.title, fields: f.value }] : [];
  });
  const selected = nurseries.find((n) => n.id === searchParams.nursery) ?? nurseries[0];

  const jobs = selected
    ? await prisma.printSavedProduct.findMany({
        where: { nurseryId: selected.id, importedAt: { not: null }, isArchived: false },
        orderBy: { createdAt: 'desc' },
        include: {
          template: { select: { title: true } },
          artworks: { include: { versions: { orderBy: { version: 'desc' }, take: 1, include: { file: { select: { id: true, originalName: true, thumbnail: { select: { fileId: true } } } } } } } },
          orderItems: { include: { printOrder: { select: { createdAt: true, totalAmount: true, imported: true } } }, orderBy: { printOrder: { createdAt: 'desc' } } },
        },
      })
    : [];

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">עבודות קודמות</h1>
        <p className="mt-1 text-sm text-gray-600">עבודות שהודפסו בעבר למשתלה. הן מופיעות אצל בעל המשתלה ב&quot;העבודות שלי&quot;, והוא יכול להזמין אותן שוב.</p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">הוספת עבודה</h2>
        {selected ? <NewImportedJobForm key={selected.id} nurseries={nurseries} templates={templates} defaultNurseryId={selected.id} /> : <p className="text-sm text-gray-600">אין משתלות.</p>}
      </section>

      <section className="space-y-3">
        <h2 className="font-bold">עבודות במשתלה</h2>
        <div className="flex flex-wrap gap-2">
          {nurseries.map((n) => (
            <Link key={n.id} href={`/admin/print-jobs?nursery=${n.id}`} aria-current={n.id === selected?.id ? 'true' : undefined} className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${n.id === selected?.id ? 'border-brand-700 bg-brand-50 text-brand-800' : 'border-gray-200 bg-white text-gray-700'}`}>
              {n.name}
            </Link>
          ))}
        </div>
        {jobs.length === 0 && <p className="rounded-xl border border-dashed border-gray-200 bg-white p-6 text-center text-sm text-gray-600">עדיין לא נוספו עבודות למשתלה הזו.</p>}
        {jobs.map((j) => {
          const file = j.artworks[0]?.versions[0]?.file;
          const last = j.orderItems[0];
          return (
            <article key={j.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm" data-testid="imported-job">
              <div className="flex gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100">
                  {file?.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/print-files/${file.id}/thumbnail`} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <FileText className="h-6 w-6 text-gray-500" />
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <h3 className="font-bold">{j.name}</h3>
                  {j.description && <p className="text-gray-600">{j.description}</p>}
                  <p className="mt-1 text-gray-700">
                    {j.template ? `מוצר: ${j.template.title}` : 'בלי מוצר מהקטלוג'}
                    {file ? ` · קובץ: ${file.originalName}` : ' · אין קובץ'}
                  </p>
                  {last && (
                    <p className="text-gray-700">
                      הזמנה אחרונה: {dateFmt.format(last.printOrder.createdAt)} · כמות {last.quantity.toLocaleString('he-IL')}
                      {Number(last.printOrder.totalAmount) > 0 ? ` · ${formatPrice(last.printOrder.totalAmount.toString())}` : ''} · {j.orderItems.length} הזמנות
                    </p>
                  )}
                </div>
              </div>
              <ImportedJobTools id={j.id} name={j.name} description={j.description ?? ''} />
            </article>
          );
        })}
      </section>
    </div>
  );
}
