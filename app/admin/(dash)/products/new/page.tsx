import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { requireAnyModule } from '@/lib/module-access';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree } from '@/lib/category-tree';
import { NewProductForm } from './new-product-form';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  await requireAnyModule(['plant_catalog', 'supplies']);

  const nurseryId =
    user.nurseryId ??
    (user.role === 'SUPER_ADMIN'
      ? (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id
      : undefined);
  if (!nurseryId) return <p className="text-gray-500">אין משתלה משויכת.</p>;

  const categories = await prisma.nurseryCategory.findMany({ where: { nurseryId } });

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה למלאי
      </Link>
      <h1 className="mb-1 text-2xl font-bold">מוצר חדש</h1>
      <p className="mb-6 text-sm text-gray-500">
        מוצר שאינו מופיע בקטלוג המרכזי (למשל ציוד, שירות או פריט מיוחד של המשתלה שלכם).
      </p>

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <NewProductForm categoryOptions={flattenCategoryTree(categories)} />
      </div>
    </div>
  );
}
