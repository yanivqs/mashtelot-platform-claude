import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { CategoryGrid, ProductGrid, loadCategoryTiles, loadProductCards } from '../../catalog';

export const dynamic = 'force-dynamic';

/** קטגוריה בקטלוג בית הדפוס: תתי-הקטגוריות שלה והמוצרים שבה. */
export default async function PrintCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  await requireNurseryPage({ all: ['print_shop'] });
  const { slug } = await params;
  const cat = await prisma.printCategory.findFirst({ where: { slug, isActive: true, OR: [{ parentId: null }, { parent: { isActive: true } }] }, include: { parent: true } });

  if (!cat) {
    return (
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold">הקטגוריה לא נמצאה</h1>
        <Link href="/admin/print-shop" className="mt-4 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          לקטלוג בית הדפוס
        </Link>
      </div>
    );
  }

  const [tiles, cards] = await Promise.all([loadCategoryTiles(cat.id), loadProductCards({ categoryId: cat.id })]);
  const back = cat.parent ? { href: `/admin/print-shop/c/${cat.parent.slug}`, label: `חזרה ל${cat.parent.name}` } : { href: '/admin/print-shop', label: 'לכל מוצרי הדפוס' };

  return (
    <div className="max-w-5xl">
      <Link href={back.href} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowRight className="h-4 w-4" />
        {back.label}
      </Link>
      <h1 className="mb-6 text-2xl font-bold">{cat.name}</h1>
      <CategoryGrid tiles={tiles} />
      <ProductGrid cards={cards} />
      {tiles.length === 0 && cards.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-600">אין כרגע מוצרים בקטגוריה הזו.</p>
      )}
    </div>
  );
}
