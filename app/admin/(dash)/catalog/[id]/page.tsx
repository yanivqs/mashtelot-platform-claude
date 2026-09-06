import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PlantForm } from './plant-form';
import { deletePlant } from './actions';

export const dynamic = 'force-dynamic';

export default async function EditPlantPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  await requireUser(['SUPER_ADMIN']);

  const plant = await prisma.plant.findUnique({ where: { id: params.id } });
  if (!plant) notFound();

  const linkedCount = await prisma.nurseryProduct.count({ where: { plantId: plant.id } });

  const plantData = Object.fromEntries(
    Object.entries(plant).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
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

      {searchParams.error === 'linked' && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          לא ניתן למחוק צמח שמשויך למשתלות.
        </p>
      )}

      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <PlantForm plant={plantData} />
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
