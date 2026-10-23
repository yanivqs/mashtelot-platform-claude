import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { PageBuilderEditor } from '@/components/admin/page-builder/editor';
import { loadEditorProps } from '../../../page-builder/load';

export const dynamic = 'force-dynamic';

/** R03: בניית עמוד סטטי מבלוקים (גם כותב תוכן). */
export default async function StaticPageBuilder(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { nurseryId } = await requireNurseryPage({ all: ['page_builder', 'static_pages'], area: 'content' });
  const page = await prisma.staticPage.findFirst({ where: { id: params.id, nurseryId }, select: { id: true, title: true, slug: true, isPublished: true } });
  if (!page) notFound();
  const editor = await loadEditorProps(nurseryId, { kind: 'page', staticPageId: page.id }, `/${page.slug}`);

  return (
    <div>
      <Link href={`/admin/pages/${page.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
        <ArrowRight className="h-4 w-4" />
        חזרה לעמוד
      </Link>
      <h1 className="text-2xl font-bold">{page.title} — בנייה בבלוקים</h1>
      <p className="mb-6 text-sm text-gray-500">
        אחרי פרסום, העמוד מוצג מהבלוקים במקום התוכן הרגיל. הכתובת, הכותרת וה-SEO נשארים מהגדרות העמוד.
        {!page.isPublished && ' העמוד עצמו עדיין טיוטה — הוא לא יוצג בחנות עד שיסומן "מפורסם".'}
      </p>
      <PageBuilderEditor {...editor} />
    </div>
  );
}
