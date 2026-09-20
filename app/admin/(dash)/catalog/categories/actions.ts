'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

export interface CategoryState {
  ok?: boolean;
  error?: string;
}

export async function createCategory(
  _prev: CategoryState,
  formData: FormData,
): Promise<CategoryState> {
  await requireUser(['SUPER_ADMIN']);
  const name = String(formData.get('name') || '').trim();
  if (!name) return { error: 'יש להזין שם קטגוריה' };

  const slug = slugify(name);
  if (!slug) return { error: 'שם קטגוריה לא תקין' };

  const exists = await prisma.plantCategory.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (exists) return { error: 'קטגוריה בשם זה כבר קיימת' };

  await prisma.plantCategory.create({ data: { name, slug } });
  revalidatePath('/admin/catalog/categories');
  return { ok: true };
}

export async function deleteCategory(formData: FormData): Promise<void> {
  await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  await prisma.plantCategory.delete({ where: { id } });
  revalidatePath('/admin/catalog/categories');
}
