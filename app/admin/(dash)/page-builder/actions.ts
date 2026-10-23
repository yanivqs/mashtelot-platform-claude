'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { auditAsCurrentUser } from '@/lib/audit-actor';
import { nurseryActionScope } from '@/lib/nursery-scope';
import { sanitizeRichHtml } from '@/lib/sanitize';
import { parseIsraelLocal } from '@/lib/il-time';
import { parseBlocks, readStoredBlocks, type Block } from '@/lib/page-blocks';
import {
  LayoutError,
  cancelScheduled,
  publishDraft,
  restoreVersion,
  saveDraft,
  setLayoutActive,
  targetKey,
  type LayoutTarget,
} from '@/lib/page-builder-admin';

export interface BuilderState {
  ok?: boolean;
  error?: string;
  message?: string;
  /** שמירת טיוטה: זמן השמירה — מרענן את התצוגה המקדימה */
  savedAt?: number;
  /** שחזור: הבלוקים שהועתקו לטיוטה (העורך נטען מהם) */
  blocks?: Block[];
}

/** יעד מהטופס: 'home' או מזהה עמוד סטטי. */
function readTarget(formData: FormData): LayoutTarget {
  const t = String(formData.get('target') || '');
  if (t === 'home') return { kind: 'home' };
  if (/^[A-Za-z0-9-]{1,64}$/.test(t)) return { kind: 'page', staticPageId: t };
  throw new LayoutError('יעד לא תקין');
}

/**
 * הרשאות (C-P1-01 + R06): דף הבית — בעלים ועובד; עמוד סטטי — גם כותב תוכן.
 * המודול page_builder חייב להיות פעיל (ולעמודים — גם static_pages).
 */
async function scopeFor(target: LayoutTarget) {
  return target.kind === 'home'
    ? nurseryActionScope({ all: ['page_builder'], area: 'general' })
    : nurseryActionScope({ all: ['page_builder', 'static_pages'], area: 'content' });
}

function cleanBlocks(blocks: Block[]): Block[] {
  return blocks.map((b) => (b.type === 'text' || b.type === 'imageText' ? { ...b, html: sanitizeRichHtml(b.html) } : b));
}

async function revalidateStore(nurseryId: string, target: LayoutTarget) {
  const nursery = await prisma.nursery.findUnique({ where: { id: nurseryId }, select: { subdomain: true } });
  if (!nursery) return;
  if (target.kind === 'home') revalidatePath(`/${nursery.subdomain}`);
  else {
    const page = await prisma.staticPage.findFirst({ where: { id: target.staticPageId, nurseryId }, select: { slug: true } });
    if (page) revalidatePath(`/${nursery.subdomain}/${page.slug}`);
  }
}

/** `refresh: false` — שמירת טיוטה אוטומטית לא מרעננת את מסך העורך (העורך מחזיק את המצב). */
async function run(
  formData: FormData,
  fn: (ctx: { nurseryId: string; email: string; target: LayoutTarget }) => Promise<string>,
  refresh = true,
): Promise<BuilderState> {
  try {
    const target = readTarget(formData);
    const scope = await scopeFor(target);
    if (!scope.ok) return { error: scope.error };
    const message = await fn({ nurseryId: scope.nurseryId, email: scope.user.email, target });
    if (refresh) {
      revalidatePath('/admin/page-builder');
      revalidatePath('/admin/pages', 'layout');
    }
    return { ok: true, message };
  } catch (e) {
    if (e instanceof LayoutError) return { error: e.message };
    throw e;
  }
}

export async function saveDraftAction(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  let json: unknown;
  try {
    json = JSON.parse(String(formData.get('blocks') || '[]'));
  } catch {
    return { error: 'מבנה הדף לא תקין' };
  }
  const parsed = parseBlocks(json);
  if (!parsed.ok) return { error: parsed.error };
  const r = await run(
    formData,
    async ({ nurseryId, target }) => {
      await saveDraft(prisma, nurseryId, target, cleanBlocks(parsed.value));
      return 'הטיוטה נשמרה ✓';
    },
    false,
  );
  return r.ok ? { ...r, savedAt: Date.now() } : r;
}

export async function publishAction(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  const when = String(formData.get('when') || 'now');
  let publishAt = new Date();
  if (when === 'schedule') {
    const at = parseIsraelLocal(String(formData.get('publishAt') || ''));
    if (!at) return { error: 'יש לבחור תאריך ושעה לפרסום' };
    if (at.getTime() <= Date.now()) return { error: 'מועד הפרסום חייב להיות בעתיד' };
    if (at.getTime() > Date.now() + 366 * 24 * 3600_000) return { error: 'אפשר לתזמן עד שנה קדימה' };
    publishAt = at;
  }
  return run(formData, async ({ nurseryId, email, target }) => {
    const v = await publishDraft(prisma, nurseryId, target, publishAt, email);
    await auditAsCurrentUser({
      nurseryId,
      action: when === 'schedule' ? 'page_layout.scheduled' : 'page_layout.published',
      entityType: 'PageLayout',
      entityId: targetKey(target),
      metadata: { version: v.version, publishAt: publishAt.toISOString() },
    });
    await revalidateStore(nurseryId, target);
    return when === 'schedule' ? `גרסה ${v.version} תוזמנה לפרסום ✓` : `גרסה ${v.version} פורסמה ✓`;
  });
}

export async function restoreAction(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  const version = Number(formData.get('version'));
  if (!Number.isInteger(version) || version < 1) return { error: 'גרסה לא תקינה' };
  let blocks: Block[] = [];
  const r = await run(formData, async ({ nurseryId, target }) => {
    const layout = await restoreVersion(prisma, nurseryId, target, version);
    blocks = readStoredBlocks(layout.draftBlocks);
    await auditAsCurrentUser({ nurseryId, action: 'page_layout.restored', entityType: 'PageLayout', entityId: targetKey(target), metadata: { version } });
    return `גרסה ${version} הועתקה לטיוטה — בדקו ופרסמו`;
  });
  return r.ok ? { ...r, blocks } : r;
}

export async function cancelScheduleAction(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  const version = Number(formData.get('version'));
  if (!Number.isInteger(version) || version < 1) return { error: 'גרסה לא תקינה' };
  return run(formData, async ({ nurseryId, target }) => {
    await cancelScheduled(prisma, nurseryId, target, version);
    await auditAsCurrentUser({ nurseryId, action: 'page_layout.schedule_cancelled', entityType: 'PageLayout', entityId: targetKey(target), metadata: { version } });
    return 'התזמון בוטל';
  });
}

export async function setActiveAction(_prev: BuilderState, formData: FormData): Promise<BuilderState> {
  const isActive = formData.get('active') === '1';
  return run(formData, async ({ nurseryId, target }) => {
    await setLayoutActive(prisma, nurseryId, target, isActive);
    await auditAsCurrentUser({ nurseryId, action: isActive ? 'page_layout.enabled' : 'page_layout.disabled', entityType: 'PageLayout', entityId: targetKey(target) });
    await revalidateStore(nurseryId, target);
    return isActive ? 'הדף מוצג מהבלוקים' : 'החנות חזרה לתצוגה הרגילה';
  });
}

/** רשימת מוצרים לבחירה ידנית בבלוק "מוצרים" (רק של המשתלה). */
export async function searchProductsAction(target: string, q: string): Promise<Array<{ id: string; title: string }>> {
  const t: LayoutTarget = target === 'home' ? { kind: 'home' } : { kind: 'page', staticPageId: target };
  const scope = await scopeFor(t);
  if (!scope.ok) return [];
  const term = q.trim().slice(0, 60);
  const rows = await prisma.nurseryProduct.findMany({
    where: {
      nurseryId: scope.nurseryId,
      isActive: true,
      ...(term
        ? { OR: [{ customTitle: { contains: term, mode: 'insensitive' } }, { plant: { hebrewName: { contains: term, mode: 'insensitive' } } }, { supply: { title: { contains: term, mode: 'insensitive' } } }] }
        : {}),
    },
    select: { id: true, customTitle: true, plant: { select: { hebrewName: true } }, supply: { select: { title: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((r) => ({ id: r.id, title: r.customTitle || r.plant?.hebrewName || r.supply?.title || 'מוצר' }));
}
