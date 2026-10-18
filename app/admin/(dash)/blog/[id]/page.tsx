import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { prisma } from '@/lib/prisma';
import { BlogForm, type BlogFormValues } from '../blog-form';

export const dynamic = 'force-dynamic';

const EMPTY: BlogFormValues = {
  id: null,
  title: '',
  slug: '',
  excerpt: '',
  contentHtml: '',
  coverImageUrl: null,
  isPublished: false,
  seoMetaTitle: null,
  seoMetaDescription: null,
};

export default async function EditBlogPostPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { nurseryId } = await requireNurseryPage({ all: ['blog'] });

  const isNew = params.id === 'new';
  let values = EMPTY;

  if (!isNew) {
    const post = await prisma.blogPost.findFirst({
      where: { id: params.id, nurseryId },
    });
    if (!post) notFound();

    values = {
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? '',
      contentHtml: post.contentHtml,
      coverImageUrl: post.coverImageUrl,
      isPublished: post.isPublished,
      seoMetaTitle: post.seoMetaTitle,
      seoMetaDescription: post.seoMetaDescription,
    };
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/blog"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לבלוג
      </Link>

      <h1 className="mb-6 text-2xl font-bold">{isNew ? 'פוסט חדש' : values.title}</h1>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <BlogForm post={values} />
      </div>
    </div>
  );
}
