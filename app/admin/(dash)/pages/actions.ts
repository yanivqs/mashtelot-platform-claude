'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requireModule } from '@/lib/module-access';
import { sanitizeRichHtml } from '@/lib/sanitize';

export interface PageFormState {
  ok?: boolean;
  error?: string;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,60}[a-z0-9])?$/;
const RESERVED = new Set([
  'catalog',
  'cart',
  'checkout',
  'product',
  'contact',
  'blog',
  'admin',
  'api',
  '_next',
]);

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

  const id = String(formData.get('id') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const slug = String(formData.get('slug') || '').trim().toLowerCase();
  const contentHtml = sanitizeRichHtml(String(formData.get('contentHtml') || ''));
  const isPublished = formData.get('isPublished') === 'on';
  const showInNav = formData.get('showInNav') === 'on';
  const sortOrder = parseInt(String(formData.get('sortOrder') || '0'), 10) || 0;
  const seoMetaTitle = String(formData.get('seoMetaTitle') || '').trim() || null;
  const seoMetaDescription = String(formData.get('seoMetaDescription') || '').trim() || null;

  if (!title) return { error: 'כותרת היא שדה חובה' };
  if (!SLUG_RE.test(slug)) {
    return { error: 'מזהה כתובת (slug) לא תקין — אותיות אנגלית קטנות, ספרות ומקפים' };
  }
  if (RESERVED.has(slug)) return { error: `"${slug}" הוא מזהה שמור` };

  const clash = await prisma.staticPage.findFirst({
    where: { nurseryId, slug, NOT: id ? { id } : undefined },
    select: { id: true },
  });
  if (clash) return { error: 'כבר קיים עמוד עם מזהה כתובת זה' };

  const data = {
    title,
    slug,
    contentHtml,
    isPublished,
    showInNav,
    sortOrder,
    seoMetaTitle,
    seoMetaDescription,
  };

  if (id) {
    await prisma.staticPage.update({ where: { id }, data });
  } else {
    await prisma.staticPage.create({ data: { ...data, nurseryId } });
  }

  revalidatePath('/admin/pages');
  redirect('/admin/pages');
}

export async function deletePage(formData: FormData): Promise<void> {
  await requireModule('static_pages');
  const nurseryId = await resolveNurseryId();
  const id = String(formData.get('id') || '');
  if (!nurseryId || !id) return;
  await prisma.staticPage.deleteMany({ where: { id, nurseryId } });
  revalidatePath('/admin/pages');
  redirect('/admin/pages');
}
