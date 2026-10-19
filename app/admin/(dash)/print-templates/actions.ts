'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';
import { recordAudit } from '@/lib/audit';
import {
  createDraftFromLatest,
  createTemplate,
  publishDraft,
  saveDraft,
  validateMeta,
  type TemplateMeta,
} from '@/lib/print-templates-admin';

export interface TemplateFormState {
  ok?: boolean;
  error?: string;
  errors?: string[];
  message?: string;
}

function readMeta(formData: FormData): TemplateMeta {
  const s = (k: string) => String(formData.get(k) || '').trim() || null;
  const lead = s('leadTimeDays');
  return {
    title: String(formData.get('title') || '').trim(),
    description: s('description'),
    category: s('category'),
    imageUrl: s('imageUrl'),
    unitLabel: s('unitLabel'),
    leadTimeDays: lead === null ? null : Number(lead),
    requiresArtwork: formData.get('requiresArtwork') === 'on',
    isActive: formData.get('isActive') === 'on',
  };
}

function revalidate(id?: string) {
  revalidatePath('/admin/print-templates');
  if (id) revalidatePath(`/admin/print-templates/${id}`);
  revalidatePath('/admin/print-shop');
}

export async function createTemplateAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const meta = readMeta(formData);
  const err = validateMeta(meta);
  if (err) return { error: err };
  const t = await createTemplate(prisma, meta, user.email);
  await recordAudit({ actorEmail: user.email, action: 'print.template_created', entityType: 'PrintTemplate', entityId: t.id, metadata: { title: meta.title } });
  revalidate();
  redirect(`/admin/print-templates/${t.id}`);
}

export async function updateTemplateMetaAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const meta = readMeta(formData);
  const err = validateMeta(meta);
  if (err) return { error: err };
  if (meta.isActive) {
    const published = await prisma.printTemplateVersion.count({ where: { templateId: id, status: 'PUBLISHED' } });
    if (!published) return { error: 'אי אפשר להציג למשתלות מוצר בלי גרסה מפורסמת — פרסמו קודם את הטיוטה' };
  }
  await prisma.printTemplate.update({ where: { id }, data: meta });
  await recordAudit({ actorEmail: user.email, action: 'print.template_updated', entityType: 'PrintTemplate', entityId: id, metadata: { isActive: meta.isActive } });
  revalidate(id);
  return { ok: true, message: 'נשמר ✓' };
}

/** שמירת טיוטה: השדות מגיעים כ-JSON מהעורך, ונבדקים במלואם בשרת. */
export async function saveDraftAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  let fields: unknown;
  let pricing: unknown;
  let production: unknown;
  try {
    fields = JSON.parse(String(formData.get('fields') || '[]'));
    pricing = JSON.parse(String(formData.get('pricing') || '{}'));
    production = JSON.parse(String(formData.get('production') || 'null'));
  } catch {
    return { error: 'נתוני העורך אינם תקינים' };
  }
  const res = await saveDraft(prisma, id, { fields, pricing, production, notes: String(formData.get('notes') || '') });
  if (!res.ok) return { errors: res.errors };
  await recordAudit({ actorEmail: user.email, action: 'print.template_draft_saved', entityType: 'PrintTemplate', entityId: id });
  revalidate(id);
  return { ok: true, message: 'הטיוטה נשמרה ✓' };
}

export async function publishDraftAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const res = await publishDraft(prisma, id, user.email);
  if (!res.ok) return { errors: res.errors };
  await recordAudit({ actorEmail: user.email, action: 'print.template_published', entityType: 'PrintTemplate', entityId: id, metadata: { version: res.version } });
  revalidate(id);
  return { ok: true, message: `גרסה ${res.version} פורסמה ✓` };
}

export async function newDraftAction(formData: FormData): Promise<void> {
  const user = await requireUser(['SUPER_ADMIN']);
  const id = String(formData.get('id') || '');
  const res = await createDraftFromLatest(prisma, id, user.email);
  if (res.ok) {
    await recordAudit({ actorEmail: user.email, action: 'print.template_draft_created', entityType: 'PrintTemplate', entityId: id });
  }
  revalidate(id);
}
