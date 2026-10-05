'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { requireModule } from '@/lib/module-access';
import { sanitizeRichHtml } from '@/lib/sanitize';

export interface BlogFormState {
  error?: string;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,80}[a-z0-9])?$/;

async function resolveNurseryId(): Promise<string | null> {
  const user = await requireUser(['NURSERY_OWNER', 'SUPER_ADMIN']);
  if (user.nurseryId) return user.nurseryId;
  if (user.role === 'SUPER_ADMIN') {
    return (await prisma.nursery.findFirst({ orderBy: { createdAt: 'asc' } }))?.id ?? null;
  }
  return null;
}

export async function saveBlogPost(_prev: BlogFormState, formData: FormData): Promise<BlogFormState> {
  await requireModule('blog');
  const nurseryId = await resolveNurseryId();
  if (!nurseryId) return { error: 'אין משתלה משויכת' };

  const id = String(formData.get('id') || '').trim();
  const title = String(formData.get('title') || '').trim();
  const slug = String(formData.get('slug') || '').trim().toLowerCase();
  const excerpt = String(formData.get('excerpt') || '').trim() || null;
  const contentHtml = sanitizeRichHtml(String(formData.get('contentHtml') || ''));
  const coverImageUrl = String(formData.get('coverImageUrl') || '').trim() || null;
  const isPublished = formData.get('isPublished') === 'on';
  const seoMetaTitle = String(formData.get('seoMetaTitle') || '').trim() || null;
  const seoMetaDescription = String(formData.get('seoMetaDescription') || '').trim() || null;

  if (!title) return { error: 'כותרת היא שדה חובה' };
  if (!SLUG_RE.test(slug)) {
    return { error: 'מזהה כתובת (slug) לא תקין — אותיות אנגלית קטנות, ספרות ומקפים' };
  }

  const clash = await prisma.blogPost.findFirst({
    where: { nurseryId, slug, NOT: id ? { id } : undefined },
    select: { id: true },
  });
  if (clash) return { error: 'כבר קיים פוסט עם מזהה כתובת זה' };

  const existing = id ? await prisma.blogPost.findFirst({ where: { id, nurseryId } }) : null;
  const publishedAt = isPublished
    ? (existing?.publishedAt ?? new Date())
    : null;

  const data = {
    title,
    slug,
    excerpt,
    contentHtml,
    coverImageUrl,
    isPublished,
    publishedAt,
    seoMetaTitle,
    seoMetaDescription,
  };

  if (existing) {
    await prisma.blogPost.update({ where: { id: existing.id }, data });
  } else {
    await prisma.blogPost.create({ data: { ...data, nurseryId } });
  }

  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

export async function deleteBlogPost(formData: FormData): Promise<void> {
  await requireModule('blog');
  const nurseryId = await resolveNurseryId();
  const id = String(formData.get('id') || '');
  if (!nurseryId || !id) return;
  await prisma.blogPost.deleteMany({ where: { id, nurseryId } });
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}
