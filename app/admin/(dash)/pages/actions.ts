'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { sanitizeRichHtml } from '@/lib/sanitize';
import { saveStaticPage, deleteStaticPage } from '@/lib/static-pages-admin';

export interface PageFormState {
  ok?: boolean;
  error?: string;
}

/** הקשר המשתלה של המשתמש המחובר בלבד + אכיפת המודול (C-P1-01). */
async function resolveNurseryId(): Promise<string> {
  return (await requireNurseryAction({ all: ['static_pages'], area: 'content' })).nurseryId;
}

export async function savePage(
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  const nurseryId = await resolveNurseryId();
  if (!nurseryId) return { error: 'אין משתלה משויכת' };

  const result = await saveStaticPage(prisma, nurseryId, {
    id: String(formData.get('id') || ''),
    title: String(formData.get('title') || ''),
    slug: String(formData.get('slug') || ''),
    contentHtml: sanitizeRichHtml(String(formData.get('contentHtml') || '')),
    isPublished: formData.get('isPublished') === 'on',
    showInNav: formData.get('showInNav') === 'on',
    sortOrder: parseInt(String(formData.get('sortOrder') || '0'), 10) || 0,
    seoMetaTitle: String(formData.get('seoMetaTitle') || '').trim() || null,
    seoMetaDescription: String(formData.get('seoMetaDescription') || '').trim() || null,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath('/admin/pages');
  redirect('/admin/pages');
}

export async function deletePage(formData: FormData): Promise<void> {
  const nurseryId = await resolveNurseryId();
  const id = String(formData.get('id') || '');
  if (!nurseryId || !id) return;
  await deleteStaticPage(prisma, nurseryId, id);
  revalidatePath('/admin/pages');
  redirect('/admin/pages');
}
