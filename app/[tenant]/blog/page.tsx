import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getNurseryByTenant } from '@/lib/tenant';
import { isModuleEnabled } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: { tenant: string };
}): Promise<Metadata> {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) return {};
  return {
    title: 'בלוג',
    description: `מאמרים, טיפים ועצות גינון מ-${nursery.name}.`,
    alternates: { canonical: '/blog' },
  };
}

export default async function BlogIndex({ params }: { params: { tenant: string } }) {
  const nursery = await getNurseryByTenant(params.tenant);
  if (!nursery) notFound();
  if (!(await isModuleEnabled(nursery.id, 'blog'))) notFound();

  const posts = await prisma.blogPost.findMany({
    where: { nurseryId: nursery.id, isPublished: true },
    orderBy: { publishedAt: 'desc' },
  });

  return (
    <div dir="rtl" className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">בלוג</h1>

      {posts.length === 0 ? (
        <p className="mt-8 rounded-lg bg-gray-50 p-10 text-center text-gray-500">
          עדיין אין פוסטים. חזרו בקרוב.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              href={`/blog/${p.slug}`}
              className="group overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md"
            >
              {p.coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.coverImageUrl} alt="" className="aspect-video w-full object-cover" />
              )}
              <div className="p-5">
                <h2 className="text-lg font-bold text-gray-900 group-hover:text-brand-700">{p.title}</h2>
                {p.excerpt && <p className="mt-2 line-clamp-3 text-sm text-gray-600">{p.excerpt}</p>}
                {p.publishedAt && (
                  <p className="mt-3 text-xs text-gray-400">
                    {p.publishedAt.toLocaleDateString('he-IL')}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
