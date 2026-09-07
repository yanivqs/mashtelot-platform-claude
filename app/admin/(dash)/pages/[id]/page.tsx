import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { requireModule } from '@/lib/module-access';
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

export default async function EditPagePage({ params }: { params: { id: string } }) {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireModule('static_pages');

  const isNew = params.id === 'new';
  let values = EMPTY;

  if (!isNew) {
    const nurseryId =
      user.nurseryId ??
      (user.role === 'SUPER_ADMIN'
        ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
        : undefined);

    const page = await prisma.staticPage.findFirst({
      where: { id: params.id, nurseryId: nurseryId ?? '__none__' },
    });
    if (!page) notFound();

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

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <PageForm page={values} />
      </div>
    </div>
  );
}
