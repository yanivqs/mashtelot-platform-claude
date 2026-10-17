'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** הקשר המשתלה של המשתמש המחובר בלבד + אכיפת המודול (C-P1-01). */
async function resolveNurseryId(): Promise<string> {
  return (await requireNurseryAction({ any: ['plant_catalog', 'supplies'] })).nurseryId;
}

export interface NurseryCategoryState {
  ok?: boolean;
  error?: string;
}

export async function createNurseryCategory(
  _prev: NurseryCategoryState,
  formData: FormData,
): Promise<NurseryCategoryState> {
  const nurseryId = await resolveNurseryId();
  const name = String(formData.get('name') || '').trim();
  const parentIdRaw = String(formData.get('parentId') || '');
  if (!name) return { error: 'יש להזין שם קטגוריה' };

  const slug = slugify(name);
  if (!slug) return { error: 'שם קטגוריה לא תקין' };

  let parentId: string | null = null;
  if (parentIdRaw) {
    const parent = await prisma.nurseryCategory.findFirst({
      where: { id: parentIdRaw, nurseryId },
      select: { id: true },
    });
    if (!parent) return { error: 'קטגוריית האב לא נמצאה' };
    parentId = parent.id;
  }

  const exists = await prisma.nurseryCategory.findFirst({ where: { nurseryId, slug } });
  if (exists) return { error: 'קטגוריה בשם זה כבר קיימת' };

  await prisma.nurseryCategory.create({ data: { nurseryId, name, slug, parentId } });
  revalidatePath('/admin/products/categories');
  revalidatePath('/admin/products');
  return { ok: true };
}

export async function deleteNurseryCategory(formData: FormData): Promise<void> {
  const nurseryId = await resolveNurseryId();
  const id = String(formData.get('id') || '');
  await prisma.nurseryCategory.deleteMany({ where: { id, nurseryId } });
  revalidatePath('/admin/products/categories');
  revalidatePath('/admin/products');
}
