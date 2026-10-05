import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { htmlToText } from '@/lib/sanitize';

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

export async function generateMetadata({
  params,
}: {
  params: { tenant: string; slug: string };
}): Promise<Metadata> {
  const post = await loadPost(params.tenant, params.slug);
  if (!post) return { title: 'פוסט לא נמצא' };
  return {
    title: post.seoMetaTitle || post.title,
    description: post.seoMetaDescription || post.excerpt || htmlToText(post.contentHtml, 160),
    alternates: { canonical: `/blog/${post.slug}` },
  };
}

export default async function BlogPostView({
  params,
}: {
  params: { tenant: string; slug: string };
}) {
  const post = await loadPost(params.tenant, params.slug);
  if (!post) notFound();

  return (
    <article dir="rtl" className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{post.title}</h1>
      {post.publishedAt && (
        <p className="mt-2 text-sm text-gray-400">{post.publishedAt.toLocaleDateString('he-IL')}</p>
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
