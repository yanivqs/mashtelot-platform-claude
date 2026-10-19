'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireNurseryAction } from '@/lib/nursery-scope';
import { recordAudit } from '@/lib/audit';
import { deleteRedirect, importRedirects, saveRedirect } from '@/lib/redirects-admin';

export interface RedirectFormState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** הקלט שנשלח — נשמר בשגיאה (React 19 מאפס טפסים, UX-01) */
  from?: string;
  to?: string;
  csv?: string;
  importErrors?: Array<{ line: number; error: string }>;
}

/** דף שנשמר כ-404 ב-ISR יוצג מחדש מיד עם ההפניה החדשה (ולא אחרי עד 5 דקות). */
async function revalidateStorePath(nurseryId: string, path: string) {
  const nursery = await prisma.nursery.findUnique({ where: { id: nurseryId }, select: { subdomain: true } });
  if (nursery) revalidatePath(`/${nursery.subdomain}${path}`);
}

export async function saveRedirectAction(_prev: RedirectFormState, formData: FormData): Promise<RedirectFormState> {
  const { user, nurseryId } = await requireNurseryAction();
  const from = String(formData.get('from') || '');
  const to = String(formData.get('to') || '');

  const res = await saveRedirect(prisma, nurseryId, from, to);
  if (!res.ok) return { error: res.error, from, to };

  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'seo.redirect_saved',
    entityType: 'Redirect',
    metadata: { from: res.from, to: res.to, retargeted: res.retargeted },
  });
  await revalidateStorePath(nurseryId, res.from);
  revalidatePath('/admin/redirects');
  return {
    ok: true,
    message: res.retargeted
      ? `נשמר ✓ (${res.retargeted} הפניות קיימות עודכנו ישירות ליעד, כדי למנוע שרשרת)`
      : res.to !== to.trim()
        ? `נשמר ✓ — היעד קוצר ל-${res.to} כדי למנוע שרשרת הפניות`
        : 'נשמר ✓',
  };
}

export async function importRedirectsAction(_prev: RedirectFormState, formData: FormData): Promise<RedirectFormState> {
  const { user, nurseryId } = await requireNurseryAction();
  let csv = String(formData.get('csv') || '');
  const file = formData.get('file');
  if (file instanceof File && file.size > 0) {
    if (file.size > 1024 * 1024) return { error: 'הקובץ גדול מ-1MB', csv };
    csv = await file.text();
  }
  if (!csv.trim()) return { error: 'יש להדביק שורות או לבחור קובץ CSV', csv };

  const res = await importRedirects(prisma, nurseryId, csv);
  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'seo.redirects_imported',
    entityType: 'Redirect',
    metadata: { saved: res.saved, errors: res.errors.length },
  });
  revalidatePath('/admin/redirects');
  return {
    ok: res.saved > 0,
    message: `נשמרו ${res.saved} הפניות${res.errors.length ? `, ${res.errors.length} שורות נדחו` : ''}`,
    importErrors: res.errors.slice(0, 50),
    // בשגיאה חלקית — משאירים את הקלט לתיקון
    csv: res.errors.length ? csv : '',
  };
}

export async function deleteRedirectAction(formData: FormData): Promise<void> {
  const { user, nurseryId } = await requireNurseryAction();
  const id = String(formData.get('id') || '');
  const rule = await prisma.redirect.findFirst({ where: { id, nurseryId }, select: { fromPath: true, toPath: true } });
  if (!rule || !(await deleteRedirect(prisma, nurseryId, id))) return;
  await recordAudit({
    nurseryId,
    actorEmail: user.email,
    action: 'seo.redirect_deleted',
    entityType: 'Redirect',
    entityId: id,
    metadata: { from: rule.fromPath, to: rule.toPath },
  });
  await revalidateStorePath(nurseryId, rule.fromPath);
  revalidatePath('/admin/redirects');
}
