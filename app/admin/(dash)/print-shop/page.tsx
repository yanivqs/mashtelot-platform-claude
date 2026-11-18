import Link from 'next/link';
import { FolderOpen } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { CategoryGrid, ProductGrid, loadCategoryTiles, loadProductCards } from './catalog';

export const dynamic = 'force-dynamic';

/** קטלוג בית הדפוס של המשתלה: קטגוריות, ומוצרים בלי קטגוריה. כל מוצר נפתח בדף משלו. */
export default async function PrintShopPage() {
  const { nurseryId } = await requireNurseryPage({ all: ['print_shop'] });

  const [tiles, cards, jobCount] = await Promise.all([
    loadCategoryTiles(null),
    // מוצר בלי קטגוריה, או שהקטגוריה שלו (או האב שלה) מושבתת — מוצג בדף הראשי
    loadProductCards({ OR: [{ categoryId: null }, { printCategory: { isActive: false } }, { printCategory: { parent: { isActive: false } } }] }),
    prisma.printSavedProduct.count({ where: { nurseryId, isArchived: false } }),
  ]);

  return (
    <div className="max-w-5xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">בית דפוס</h1>
          <p className="mt-1 text-sm text-gray-600">שלטים, תוויות, כרטיסי ברכה ופריטי מיתוג. בוחרים מוצר, מקבלים מחיר ומזמינים.</p>
        </div>
        <Link href="/admin/print-shop/jobs" className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-800">
          <FolderOpen className="h-4 w-4" />
          העבודות שלי{jobCount > 0 ? ` (${jobCount})` : ''}
        </Link>
      </div>

      <CategoryGrid tiles={tiles} />
      <ProductGrid cards={cards} />
      {tiles.length === 0 && cards.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-600">אין כרגע מוצרי דפוס להזמנה.</p>
      )}
    </div>
  );
}
