import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { getPublishedPage } from '@/lib/pages';
import { htmlToText } from '@/lib/sanitize';
import { redirectOrNotFound } from '@/lib/redirect-resolve';

export const revalidate = 300;
export const dynamicParams = true;

interface Props {
  params: Promise<{ tenant: string; pageSlug: string }>;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) return {};
  const page = await getPublishedPage(nursery.id, params.pageSlug);
  if (!page) return { title: 'עמוד לא נמצא' };

  return {
    title: page.seoMetaTitle || page.title,
    description: page.seoMetaDescription || htmlToText(page.contentHtml, 160),
    alternates: { canonical: `/${page.slug}` },
  };
}

export default async function StaticPageView(props: Props) {
  const params = await props.params;
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();

  const page = await getPublishedPage(nursery.id, params.pageSlug);
  // כתובת שלא קיימת: הפניה מכתובת ישנה (§14.01) או 404
  if (!page) return redirectOrNotFound(nursery.id, `/${params.pageSlug}`);

  return (
    <article dir="rtl" className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{page.title}</h1>
      <div
        className="mt-6 leading-relaxed text-gray-700 [&_a]:text-brand-700 [&_a]:underline [&_blockquote]:border-r-2 [&_blockquote]:border-gray-300 [&_blockquote]:pr-3 [&_blockquote]:text-gray-600 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pr-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pr-6"
        dangerouslySetInnerHTML={{ __html: page.contentHtml }}
      />
    </article>
  );
}
