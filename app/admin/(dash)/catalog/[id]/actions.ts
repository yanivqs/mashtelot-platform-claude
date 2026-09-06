'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

const EDITABLE_FIELDS = [
  'hebrewName',
  'latinName',
  'nickname',
  'family',
  'description',
  'plantType',
  'light',
  'water',
  'floweringSeason',
  'flowerColor',
  'height',
  'spacing',
  'growthRate',
  'care',
  'imageUrl',
] as const;

export interface PlantFormState {
  ok?: boolean;
  error?: string;
}

export async function updatePlant(
  _prev: PlantFormState,
  formData: FormData,
): Promise<PlantFormState> {
  await requireUser(['SUPER_ADMIN']);
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

  try {
    await prisma.plant.update({ where: { id }, data });
  } catch {
    return { error: 'שגיאה בשמירה' };
  }

  revalidatePath(`/admin/catalog/${id}`);
  revalidatePath('/admin/catalog');
  return { ok: true };
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
