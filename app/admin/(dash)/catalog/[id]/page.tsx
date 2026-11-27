import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { flattenCategoryTree } from '@/lib/category-tree';
import { PlantForm } from './plant-form';
import { deletePlant, promoteNurseryPlant, rejectNurseryPlant } from './actions';

export const dynamic = 'force-dynamic';

export default async function EditPlantPage(
  props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ error?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  await requireUser(['SUPER_ADMIN']);

  const plant = await prisma.plant.findUnique({
    where: { id: params.id },
    include: { categories: true, ownerNursery: { select: { name: true, subdomain: true } } },
  });
  if (!plant) notFound();

  const linkedCount = await prisma.nurseryProduct.count({ where: { plantId: plant.id } });
  const allCategories = await prisma.plantCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  const selectedCategoryIds = plant.categories.map((c) => c.categoryId);

  const plantData = Object.fromEntries(
    Object.entries(plant)
      .filter(([k]) => k !== 'categories' && k !== 'ownerNursery')
      .map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  ) as Record<string, string | null> & { id: string };

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/catalog"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowRight className="h-4 w-4" />
        חזרה לקטלוג
      </Link>

      <h1 className="mb-1 text-2xl font-bold">{plant.hebrewName}</h1>
      <p className="mb-6 text-sm text-gray-500">
        משויך ל-{linkedCount} משתלות · מזהה מקורי: {plant.plantId ?? '—'}
      </p>

      {plant.ownerNursery && (
        <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-950" data-testid="nursery-plant-banner">
          <p className="font-semibold">
            צמח פרטי של {plant.ownerNursery.name} — מוצג רק בחנות שלה ואינו חלק מהקטלוג הראשי.
          </p>
          <p className="mt-1">
            {plant.submittedAt
              ? `המשתלה הציעה אותו לקטלוג ב-${plant.submittedAt.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' })}. אפשר לתקן את הפרטים ולשייך קטגוריות למטה (שמירה), ואז להוסיף לקטלוג.`
              : 'המשתלה לא הציעה אותו לקטלוג (או שההצעה נדחתה).'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={promoteNurseryPlant}>
              <input type="hidden" name="id" value={plant.id} />
              <button className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">הוסף לקטלוג הראשי</button>
            </form>
            {plant.submittedAt && (
              <form action={rejectNurseryPlant}>
                <input type="hidden" name="id" value={plant.id} />
                <button className="rounded-lg border border-violet-300 bg-white px-4 py-2 text-sm font-medium text-violet-900 hover:bg-violet-100">דחה הצעה</button>
              </form>
            )}
          </div>
        </div>
      )}

      {searchParams.error === 'linked' && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          לא ניתן למחוק צמח שמשויך למשתלות.
        </p>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <PlantForm
          plant={plantData}
          categories={flattenCategoryTree(allCategories)}
          selectedCategoryIds={selectedCategoryIds}
        />
      </div>

      {linkedCount === 0 && (
        <form action={deletePlant} className="mt-4">
          <input type="hidden" name="id" value={plant.id} />
          <button className="text-sm text-red-600 hover:text-red-800">מחיקת הצמח מהקטלוג</button>
        </form>
      )}
    </div>
  );
}
