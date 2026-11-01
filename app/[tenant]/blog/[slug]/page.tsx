import type { Metadata } from 'next';
import { Breadcrumbs } from '@/components/storefront/breadcrumbs';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { htmlToText } from '@/lib/sanitize';
import { redirectOrNotFound } from '@/lib/redirect-resolve';
import { articleJsonLd, jsonLdHtml, tenantUrl } from '@/lib/seo';

export const revalidate = 300;

async function loadPost(tenant: string, slug: string) {
  const nursery = await getNurseryByTenant(tenant);
  if (!nursery) return null;
  if (!(await isModuleEnabled(nursery.id, 'blog'))) return null;
  const post = await prisma.blogPost.findFirst({
    where: { nurseryId: nursery.id, slug, isPublished: true },
  });
  return post;
}

export async function generateMetadata(
  props: {
    params: Promise<{ tenant: string; slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  const post = await loadPost(params.tenant, params.slug);
  if (!post) return { title: 'פוסט לא נמצא' };
  const nursery = await getNurseryByTenant(params.tenant);
  const title = post.seoMetaTitle || post.title;
  const description = post.seoMetaDescription || post.excerpt || htmlToText(post.contentHtml, 160);
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article',
      title,
      description,
      url: nursery ? tenantUrl(nursery, `/blog/${post.slug}`) : undefined,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      images: post.coverImageUrl ? [{ url: post.coverImageUrl }] : nursery?.logoUrl ? [{ url: nursery.logoUrl }] : undefined,
    },
  };
}

export default async function BlogPostView(
  props: {
    params: Promise<{ tenant: string; slug: string }>;
  }
) {
  const params = await props.params;
  const post = await loadPost(params.tenant, params.slug);
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();
  if (!post) return redirectOrNotFound(nursery.id, `/blog/${params.slug}`);

  return (
    <article dir="rtl" className="mx-auto max-w-3xl px-6 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(articleJsonLd(nursery, post)) }} />
      <Breadcrumbs nursery={nursery} items={[{ label: 'בלוג', href: '/blog' }, { label: post.title }]} className="mb-4" />
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{post.title}</h1>
      {post.publishedAt && (
        <p className="mt-2 text-sm text-gray-600">{post.publishedAt.toLocaleDateString('he-IL')}</p>
      )}
      {post.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.coverImageUrl} alt="" className="mt-6 w-full rounded-2xl object-cover" />
      )}
      <div
        className="mt-6 leading-relaxed text-gray-700 [&_a]:text-brand-700 [&_a]:underline [&_blockquote]:border-r-2 [&_blockquote]:border-gray-300 [&_blockquote]:pr-3 [&_blockquote]:text-gray-600 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pr-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pr-6"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />
    </article>
  );
}
