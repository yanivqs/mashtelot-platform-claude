'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requireModule } from '@/lib/module-access';
import { sanitizeRichHtml } from '@/lib/sanitize';
import { saveStaticPage, deleteStaticPage } from '@/lib/static-pages-admin';

export interface PageFormState {
  ok?: boolean;
  error?: string;
}

async function resolveNurseryId(): Promise<string | null> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  if (user.nurseryId) return user.nurseryId;
  if (user.role === 'SUPER_ADMIN') {
    return (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id ?? null;
  }
  return null;
}

export async function savePage(
  _prev: PageFormState,
  formData: FormData,
): Promise<PageFormState> {
  await requireModule('static_pages');
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
  await requireModule('static_pages');
  const nurseryId = await resolveNurseryId();
  const id = String(formData.get('id') || '');
  if (!nurseryId || !id) return;
  await deleteStaticPage(prisma, nurseryId, id);
  revalidatePath('/admin/pages');
  redirect('/admin/pages');
}
