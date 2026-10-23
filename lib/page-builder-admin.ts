import type { Prisma, PrismaClient } from '@prisma/client';
import { pickLiveVersion, readStoredBlocks, type Block } from '@/lib/page-blocks';

/**
 * R03 Page Builder — לוגיקת הטיוטה, הפרסום והשחזור, מופרדת מה-Server Actions כדי שתהיה
 * ניתנת לבדיקה מול בסיס נתונים. ה-Action אחראי לזיהוי המשתמש, למודול, לולידציה ולסניטציה;
 * כאן נאכף שהפריסה (והעמוד הסטטי) שייכים למשתלה.
 */

type Db = PrismaClient | Prisma.TransactionClient;

export const HOME_KEY = 'home';
export const pageKey = (staticPageId: string) => `page:${staticPageId}`;

export type LayoutTarget = { kind: 'home' } | { kind: 'page'; staticPageId: string };

export function targetKey(t: LayoutTarget): string {
  return t.kind === 'home' ? HOME_KEY : pageKey(t.staticPageId);
}

export class LayoutError extends Error {}

/** הפריסה של היעד במשתלה (יוצרת ריקה אם אין). עמוד סטטי של משתלה אחרת → שגיאה. */
export async function getOrCreateLayout(db: Db, nurseryId: string, target: LayoutTarget) {
  const key = targetKey(target);
  const existing = await db.pageLayout.findUnique({ where: { nurseryId_key: { nurseryId, key } } });
  if (existing) return existing;
  if (target.kind === 'page') {
    const page = await db.staticPage.findFirst({ where: { id: target.staticPageId, nurseryId }, select: { id: true } });
    if (!page) throw new LayoutError('העמוד לא נמצא');
  }
  return db.pageLayout.upsert({
    where: { nurseryId_key: { nurseryId, key } },
    create: { nurseryId, key, staticPageId: target.kind === 'page' ? target.staticPageId : null, draftBlocks: [] },
    update: {},
  });
}

/** שמירת טיוטה — הבלוקים כבר עברו ולידציה וסניטציה. */
export async function saveDraft(db: Db, nurseryId: string, target: LayoutTarget, blocks: Block[]) {
  const layout = await getOrCreateLayout(db, nurseryId, target);
  return db.pageLayout.update({ where: { id: layout.id }, data: { draftBlocks: blocks as unknown as Prisma.InputJsonValue } });
}

/** פרסום הטיוטה כגרסה חדשה, עכשיו או בזמן עתידי (תזמון). מפעיל את הפריסה. */
export async function publishDraft(db: PrismaClient, nurseryId: string, target: LayoutTarget, publishAt: Date, actorEmail: string | null) {
  return db.$transaction(async (tx) => {
    const layout = await getOrCreateLayout(tx, nurseryId, target);
    const blocks = readStoredBlocks(layout.draftBlocks);
    if (blocks.length === 0) throw new LayoutError('אי אפשר לפרסם דף ריק — הוסיפו לפחות בלוק אחד');
    const last = await tx.pageLayoutVersion.findFirst({ where: { layoutId: layout.id }, orderBy: { version: 'desc' }, select: { version: true } });
    const version = await tx.pageLayoutVersion.create({
      data: { layoutId: layout.id, version: (last?.version ?? 0) + 1, blocks: blocks as unknown as Prisma.InputJsonValue, publishAt, createdByEmail: actorEmail },
    });
    await tx.pageLayout.update({ where: { id: layout.id }, data: { isActive: true } });
    return version;
  });
}

/** שחזור: מעתיק גרסה קודמת לטיוטה (לא מפרסם — מפרסמים אחרי בדיקה). */
export async function restoreVersion(db: Db, nurseryId: string, target: LayoutTarget, version: number) {
  const layout = await db.pageLayout.findUnique({ where: { nurseryId_key: { nurseryId, key: targetKey(target) } } });
  if (!layout) throw new LayoutError('הפריסה לא נמצאה');
  const v = await db.pageLayoutVersion.findUnique({ where: { layoutId_version: { layoutId: layout.id, version } } });
  if (!v) throw new LayoutError('הגרסה לא נמצאה');
  return db.pageLayout.update({ where: { id: layout.id }, data: { draftBlocks: v.blocks as Prisma.InputJsonValue } });
}

/** ביטול תזמון: מוחק גרסה שעוד לא פורסמה. */
export async function cancelScheduled(db: Db, nurseryId: string, target: LayoutTarget, version: number, now = new Date()) {
  const layout = await db.pageLayout.findUnique({ where: { nurseryId_key: { nurseryId, key: targetKey(target) } } });
  if (!layout) throw new LayoutError('הפריסה לא נמצאה');
  const r = await db.pageLayoutVersion.deleteMany({ where: { layoutId: layout.id, version, publishAt: { gt: now } } });
  if (r.count === 0) throw new LayoutError('אפשר לבטל רק פרסום מתוזמן שעוד לא התחיל');
}

/** הפעלה/כיבוי של הפריסה (כבויה = התצוגה הרגילה של החנות). */
export async function setLayoutActive(db: Db, nurseryId: string, target: LayoutTarget, isActive: boolean) {
  const r = await db.pageLayout.updateMany({ where: { nurseryId, key: targetKey(target) }, data: { isActive } });
  if (r.count === 0) throw new LayoutError('הפריסה לא נמצאה');
}

/** הבלוקים החיים כרגע ליעד, או null (אין פריסה פעילה / אין גרסה שפורסמה). */
export async function liveBlocks(db: Db, nurseryId: string, key: string, now = new Date()): Promise<Block[] | null> {
  const layout = await db.pageLayout.findUnique({
    where: { nurseryId_key: { nurseryId, key } },
    select: { isActive: true, versions: { where: { publishAt: { lte: now } }, orderBy: { version: 'desc' }, take: 1, select: { version: true, publishAt: true, blocks: true } } },
  });
  if (!layout?.isActive) return null;
  const live = pickLiveVersion(layout.versions, now);
  return live ? readStoredBlocks(live.blocks) : null;
}

/** מצב העורך: טיוטה, היסטוריה, הגרסה החיה והאם יש מתוזמנת. */
export async function editorState(db: Db, nurseryId: string, target: LayoutTarget, now = new Date()) {
  const layout = await getOrCreateLayout(db, nurseryId, target);
  const versions = await db.pageLayoutVersion.findMany({
    where: { layoutId: layout.id },
    orderBy: { version: 'desc' },
    take: 30,
    select: { version: true, publishAt: true, createdAt: true, createdByEmail: true },
  });
  const live = pickLiveVersion(versions, now);
  return {
    isActive: layout.isActive,
    draft: readStoredBlocks(layout.draftBlocks),
    versions: versions.map((v) => ({
      ...v,
      state: v.publishAt > now ? ('scheduled' as const) : live && v.version === live.version ? ('live' as const) : ('past' as const),
    })),
  };
}
