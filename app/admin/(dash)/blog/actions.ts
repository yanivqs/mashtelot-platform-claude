'use server';

import { revalidatePath } from 'next/cache';
import { auditAsCurrentUser } from '@/lib/audit-actor';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { sanitizeRichHtml } from '@/lib/sanitize';

export interface BlogFormState {
  error?: string;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,80}[a-z0-9])?$/;

/** הקשר המשתלה של המשתמש המחובר בלבד + אכיפת המודול (C-P1-01). */
async function resolveNurseryId(): Promise<string> {
  return (await requireNurseryAction({ all: ['blog'], area: 'content' })).nurseryId;
}

export async function saveBlogPost(_prev: BlogFormState, formData: FormData): Promise<BlogFormState> {
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

  const saved = existing
    ? await prisma.blogPost.update({ where: { id: existing.id }, data })
    : await prisma.blogPost.create({ data: { ...data, nurseryId } });
  // §20.02: פרסום/הסתרה ושמירה של תוכן ציבורי
  await auditAsCurrentUser({ nurseryId, action: existing ? 'blog.post_updated' : 'blog.post_created', entityType: 'BlogPost', entityId: saved.id, metadata: { slug, isPublished, wasPublished: existing?.isPublished ?? false } });

  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

export async function deleteBlogPost(formData: FormData): Promise<void> {
  const nurseryId = await resolveNurseryId();
  const id = String(formData.get('id') || '');
  if (!nurseryId || !id) return;
  const r = await prisma.blogPost.deleteMany({ where: { id, nurseryId } });
  if (r.count) await auditAsCurrentUser({ nurseryId, action: 'blog.post_deleted', entityType: 'BlogPost', entityId: id });
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}
