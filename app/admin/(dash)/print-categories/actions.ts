'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import { deleteCategory, saveCategory } from '@/lib/print-catalog-admin';

export interface CategoryFormState {
  ok?: boolean;
  error?: string;
  message?: string;
}

function revalidate() {
  revalidatePath('/admin/print-categories');
  revalidatePath('/admin/print-shop', 'layout');
}

export async function saveCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '') || null;
  const s = (k: string) => String(formData.get(k) || '').trim();
  const res = await saveCategory(prisma, id, {
    name: s('name'),
    slug: s('slug').toLowerCase(),
    parentId: s('parentId') || null,
    imageUrl: s('imageUrl') || null,
    sortOrder: Math.trunc(Number(s('sortOrder') || 0)),
    isActive: formData.get('isActive') === 'on',
  });
  if (!res.ok) return { error: res.error };
  await recordAudit({ actorEmail: user.email, action: id ? 'print.category_updated' : 'print.category_created', entityType: 'PrintCategory', entityId: res.id ?? id ?? '', metadata: { name: s('name') } });
  revalidate();
  return { ok: true, message: id ? 'נשמר ✓' : 'הקטגוריה נוספה ✓' };
}

export async function deleteCategoryAction(_prev: CategoryFormState, formData: FormData): Promise<CategoryFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const res = await deleteCategory(prisma, id);
  if (!res.ok) return { error: res.error };
  await recordAudit({ actorEmail: user.email, action: 'print.category_deleted', entityType: 'PrintCategory', entityId: id });
  revalidate();
  return { ok: true, message: 'נמחקה' };
}
