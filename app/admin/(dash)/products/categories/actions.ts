'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';

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

/** עריכת שם ו-slug של קטגוריה. שינוי slug מעדכן גם את קישור הודעת הסטיקי אם הפנה לקטגוריה. */
export async function updateNurseryCategory(
  _prev: NurseryCategoryState,
  formData: FormData,
): Promise<NurseryCategoryState> {
  const { user, nurseryId } = await requireNurseryAction({ any: ['plant_catalog', 'supplies'] });
  const id = String(formData.get('id') || '');
  const name = String(formData.get('name') || '').trim().slice(0, 80);
  const rawSlug = String(formData.get('slug') || '').trim();
  if (!name) return { error: 'יש להזין שם קטגוריה' };
  const slug = slugify(rawSlug || name).slice(0, 80);
  if (!slug) return { error: 'כתובת (slug) לא תקינה — אותיות, ספרות ומקפים בלבד' };

  const category = await prisma.nurseryCategory.findFirst({ where: { id, nurseryId } });
  if (!category) return { error: 'הקטגוריה לא נמצאה' };
  if (slug !== category.slug && (await prisma.nurseryCategory.findFirst({ where: { nurseryId, slug, NOT: { id } } }))) {
    return { error: 'כבר קיימת קטגוריה עם הכתובת הזו' };
  }

  await prisma.$transaction(async (tx) => {
    await tx.nurseryCategory.update({ where: { id }, data: { name, slug } });
    if (slug === category.slug) return;
    const nursery = await tx.nursery.findUniqueOrThrow({ where: { id: nurseryId }, select: { themeConfig: true } });
    const theme = (nursery.themeConfig ?? {}) as Record<string, unknown>;
    const ann = (theme.announcement ?? null) as Record<string, unknown> | null;
    const oldHref = `/catalog?category=${encodeURIComponent(category.slug)}`;
    if (ann && ann.href === oldHref) {
      await tx.nursery.update({
        where: { id: nurseryId },
        data: { themeConfig: { ...theme, announcement: { ...ann, href: `/catalog?category=${encodeURIComponent(slug)}` } } as Prisma.InputJsonValue },
      });
    }
  });
  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'category.updated',
    entityType: 'NurseryCategory',
    entityId: id,
    metadata: { from: { name: category.name, slug: category.slug }, to: { name, slug } },
  });
  revalidatePath('/admin/products/categories');
  revalidatePath(`/admin/products/categories/${id}`);
  revalidatePath('/admin/products');
  return { ok: true };
}
