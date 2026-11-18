import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseDesignRule } from '@/lib/print-designs';
import { DesignForm, DesignRow } from './forms';

export const dynamic = 'force-dynamic';

/** מאגר הדוגמאות של מוצר דפוס (כרטיסי ברכה): הוספה, עריכה, תגיות והשבתה. */
export default async function PrintDesignsPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string }> }) {
  await requireUser(['SUPER_ADMIN']);
  const { id } = await props.params;
  const { q } = await props.searchParams;
  const t = await prisma.printTemplate.findUnique({ where: { id }, select: { id: true, title: true, designRule: true } });
  if (!t) notFound();
  const query = (q ?? '').trim().slice(0, 80);
  const [designs, counts, last, nurseries] = await Promise.all([
    prisma.printDesign.findMany({
      where: {
        templateId: t.id,
        ...(query ? { OR: [{ code: { contains: query, mode: 'insensitive' } }, { title: { contains: query, mode: 'insensitive' } }, { tags: { has: query } }] } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    }),
    prisma.printDesign.groupBy({ by: ['isActive'], where: { templateId: t.id }, _count: true }),
    prisma.printDesign.findFirst({ where: { templateId: t.id }, orderBy: { sortOrder: 'desc' }, select: { sortOrder: true } }),
    prisma.nursery.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  const active = counts.find((x) => x.isActive)?._count ?? 0;
  const all = counts.reduce((s, x) => s + x._count, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href={`/admin/print-templates/${t.id}`} className="text-sm text-gray-500 hover:underline">
          ← {t.title}
        </Link>
        <h1 className="mt-1 text-2xl font-bold">דוגמאות: {t.title}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {all} דוגמאות, מהן {active} זמינות להזמנה.
          {!parseDesignRule(t.designRule) && ' שימו לב: המוצר עדיין לא מוגדר כמוצר עם מאגר דוגמאות (בפרטי המוצר), ולכן המשתלות לא רואות את הדוגמאות.'}
        </p>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-bold">דוגמא חדשה</h2>
        <DesignForm templateId={t.id} nextSort={(last?.sortOrder ?? 0) + 10} nurseries={nurseries} />
      </section>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <form className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4" role="search">
          <label className="flex-1 text-sm">
            <span className="sr-only">חיפוש לפי קוד, שם או תגית</span>
            <input name="q" defaultValue={query} placeholder="חיפוש לפי קוד, שם או תגית" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500" />
          </label>
          <button className="rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50">חיפוש</button>
        </form>
        {designs.length === 0 ? (
          <p className="p-6 text-center text-sm text-gray-500">{query ? 'אין דוגמאות שמתאימות לחיפוש.' : 'אין עדיין דוגמאות.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {designs.map((d) => (
              <DesignRow
                key={d.id}
                templateId={t.id}
                nurseries={nurseries}
                value={{ id: d.id, code: d.code, title: d.title, imageUrl: d.imageUrl, tags: d.tags, sortOrder: d.sortOrder, isActive: d.isActive, nurseryId: d.nurseryId }}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
