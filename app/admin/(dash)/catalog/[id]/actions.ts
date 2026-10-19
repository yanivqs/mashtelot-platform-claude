'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { assignPlantCategoriesToProduct } from '@/lib/category-provision';
import { productsBehind } from '@/lib/catalog-sync-admin';

const EDITABLE_FIELDS = [
  'hebrewName',
  'latinName',
  'nickname',
  'family',
  'description',
  'notes',
  'origin',
  'native',
  'plantType',
  'light',
  'water',
  'flowering',
  'floweringSeason',
  'flowerColor',
  'foliage',
  'evergreen',
  'height',
  'spacing',
  'growthRate',
  'climateZones',
  'resistance',
  'coastal',
  'care',
  'uniqueness',
  'imageUrl',
] as const;

export interface PlantFormState {
  ok?: boolean;
  error?: string;
  /** §6: כמה מוצרים בחנויות יקבלו הצעת עדכון */
  message?: string;
}

export async function updatePlant(
  _prev: PlantFormState,
  formData: FormData,
): Promise<PlantFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  if (!id) return { error: 'מזהה חסר' };

  const hebrewName = String(formData.get('hebrewName') || '').trim();
  if (!hebrewName) return { error: 'שם עברי הוא שדה חובה' };

  const data: Record<string, string | null> = {};
  for (const key of EDITABLE_FIELDS) {
    const value = String(formData.get(key) || '').trim();
    data[key] = value || null;
  }
  data.hebrewName = hebrewName;

  const categoryIds = formData.getAll('categoryIds').map(String);

  try {
    await prisma.$transaction(async (tx) => {
      // §6: מקור ומבצע לגרסה שה-trigger יוצר (plants_record_revision)
      await tx.$executeRaw`SELECT set_config('app.catalog_source', 'admin', true), set_config('app.catalog_actor', ${user.email}, true)`;
      await tx.plant.update({ where: { id }, data });
      await tx.plantCategoryAssignment.deleteMany({ where: { plantId: id } });
      if (categoryIds.length > 0) {
        await tx.plantCategoryAssignment.createMany({
          data: categoryIds.map((categoryId) => ({ plantId: id, categoryId })),
        });
      }
    });
    const linked = await prisma.nurseryProduct.findMany({
      where: { plantId: id },
      select: { id: true, nurseryId: true },
    });
    for (const p of linked) await assignPlantCategoriesToProduct(p.id, p.nurseryId, id);
  } catch {
    return { error: 'שגיאה בשמירה' };
  }

  revalidatePath(`/admin/catalog/${id}`);
  revalidatePath('/admin/catalog');
  // §6: שינוי תוכן אינו משנה את החנויות — כל משתלה מקבלת הצעת עדכון לאישור
  const behind = await productsBehind(prisma, { plantId: id });
  return {
    ok: true,
    message: behind > 0 ? `נשמר ✓ — ${behind} מוצרים בחנויות יקבלו הצעת עדכון לאישור בעל המשתלה` : 'נשמר ✓',
  };
}

export async function deletePlant(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const linked = await prisma.nurseryProduct.count({ where: { plantId: id } });
  if (linked > 0) {
    redirect(`/admin/catalog/${id}?error=linked`);
  }
  await prisma.plant.delete({ where: { id } });
  redirect('/admin/catalog');
}
