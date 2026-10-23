import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, LayoutTemplate } from 'lucide-react';
import { isModuleEnabled } from '@/lib/module-access';
import { liveBlocks, pageKey } from '@/lib/page-builder-admin';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { PageForm, type PageFormValues } from '../page-form';

export const dynamic = 'force-dynamic';

const EMPTY: PageFormValues = {
  id: null,
  title: '',
  slug: '',
  contentHtml: '',
  isPublished: false,
  showInNav: true,
  sortOrder: 0,
  seoMetaTitle: null,
  seoMetaDescription: null,
};

export default async function EditPagePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { nurseryId } = await requireNurseryPage({ all: ['static_pages'], area: 'content' });

  const isNew = params.id === 'new';
  let values = EMPTY;
  let builder: { live: boolean } | null = null;

  if (!isNew) {
    const page = await prisma.staticPage.findFirst({
      where: { id: params.id, nurseryId },
    });
    if (!page) notFound();
    // R03: בונה העמודים — רק כשהמודול פעיל
    if (await isModuleEnabled(nurseryId, 'page_builder')) {
      builder = { live: (await liveBlocks(prisma, nurseryId, pageKey(page.id))) !== null };
    }

    values = {
      id: page.id,
      title: page.title,
      slug: page.slug,
      contentHtml: page.contentHtml,
      isPublished: page.isPublished,
      showInNav: page.showInNav,
      sortOrder: page.sortOrder,
      seoMetaTitle: page.seoMetaTitle,
      seoMetaDescription: page.seoMetaDescription,
    };
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/pages"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לעמודים
      </Link>

      <h1 className="mb-6 text-2xl font-bold">{isNew ? 'עמוד חדש' : values.title}</h1>

      {builder && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm">
          <LayoutTemplate className="h-5 w-5 text-brand-700" />
          <span className="flex-1 text-brand-900">
            {builder.live ? 'העמוד מוצג בחנות מהבלוקים — התוכן שלמטה משמש כגיבוי בלבד.' : 'אפשר לבנות את העמוד מבלוקים (תמונות, מוצרים, שאלות נפוצות ועוד).'}
          </span>
          <Link href={`/admin/pages/${values.id}/builder`} className="rounded-lg bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
            בנייה בבלוקים
          </Link>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <PageForm page={values} />
      </div>
    </div>
  );
}
