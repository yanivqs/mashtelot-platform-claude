/**
 * תור מיילים (Outbox, §21): כל מייל עסקי נרשם לפני השליחה, נשלח מיד, ואם נכשל — נשלח שוב
 * במשימת רקע עם השהיה גדלה (Backoff). אחרי 6 ניסיונות → FAILED, גלוי ב"מיילים ומערכת" עם "שליחה חוזרת".
 * - שליחה מותנית בסטטוס (claim): שתי ריצות מקבילות לא ישלחו את אותו מייל פעמיים.
 * - קודי כניסה (OTP) אינם עוברים בתור — הקוד תקף 10 דקות ולא נשמר בגלוי במסד.
 * - פונקציית השליחה מוזרקת (בר-בדיקה).
 */
import type { PrismaClient } from '@prisma/client';

export interface SendFn {
  (msg: { to: string[]; subject: string; html: string; replyTo?: string }): Promise<{ ok: boolean; id?: string; skipped?: boolean; error?: string }>;
}

/** השהיה לפני ניסיון n+1 (דקות): 1, 5, 30, 120, 360. */
export const BACKOFF_MINUTES = [1, 5, 30, 120, 360];
export const MAX_ATTEMPTS = BACKOFF_MINUTES.length + 1;

export function nextAttemptAfter(attempts: number, now: Date): Date | null {
  if (attempts >= MAX_ATTEMPTS) return null;
  const m = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)] ?? 1;
  return new Date(now.getTime() + m * 60_000);
}

export interface OutboxMessage {
  nurseryId?: string | null;
  kind: string;
  refId?: string | null;
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string | null;
}

/** ניסיון שליחה אחד למייל שכבר "נתפס" (attempts הוגדל). */
async function attempt(db: PrismaClient, id: string, send: SendFn, now: Date) {
  const job = await db.emailJob.findUniqueOrThrow({ where: { id } });
  let res: Awaited<ReturnType<SendFn>>;
  try {
    res = await send({ to: job.to, subject: job.subject, html: job.html, replyTo: job.replyTo ?? undefined });
  } catch (e) {
    res = { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
  if (res.ok) {
    await db.emailJob.update({ where: { id }, data: { status: 'SENT', sentAt: now, providerId: res.id ?? null, lastError: null } });
    return 'SENT' as const;
  }
  if (res.skipped) {
    // אין הגדרת שליחה בסביבה (מפתח חסר) — לא מנסים שוב בלי סוף
    await db.emailJob.update({ where: { id }, data: { status: 'SKIPPED', lastError: 'email not configured' } });
    return 'SKIPPED' as const;
  }
  const next = nextAttemptAfter(job.attempts, now);
  await db.emailJob.update({
    where: { id },
    data: next ? { status: 'PENDING', nextAttemptAt: next, lastError: (res.error ?? 'send failed').slice(0, 500) } : { status: 'FAILED', lastError: (res.error ?? 'send failed').slice(0, 500) },
  });
  return next ? ('RETRY' as const) : ('FAILED' as const);
}

/** תופס מייל לשליחה: PENDING ובשל, ומספר הניסיונות כמו שנקרא — אחרת מישהו אחר כבר תפס. */
async function claim(db: PrismaClient, id: string, attempts: number, now: Date): Promise<boolean> {
  const r = await db.emailJob.updateMany({
    where: { id, status: 'PENDING', attempts, nextAttemptAt: { lte: now } },
    data: { attempts: { increment: 1 }, nextAttemptAt: new Date(now.getTime() + 10 * 60_000) },
  });
  return r.count === 1;
}

/** רישום + ניסיון מיידי. מחזיר את התוצאה (לתיעוד ב-Audit). */
export async function sendViaOutbox(db: PrismaClient, msg: OutboxMessage, send: SendFn, now = new Date()) {
  const to = (Array.isArray(msg.to) ? msg.to : [msg.to]).filter(Boolean);
  const job = await db.emailJob.create({
    data: { nurseryId: msg.nurseryId ?? null, kind: msg.kind, refId: msg.refId ?? null, to, subject: msg.subject, html: msg.html, replyTo: msg.replyTo ?? null, nextAttemptAt: now },
  });
  if (!(await claim(db, job.id, 0, now))) return { id: job.id, status: 'PENDING' as const };
  return { id: job.id, status: await attempt(db, job.id, send, now) };
}

/** משימת הרקע: מיילים שהגיע זמנם לניסיון חוזר. */
export async function processEmailQueue(db: PrismaClient, send: SendFn, now = new Date(), limit = 20) {
  const due = await db.emailJob.findMany({
    where: { status: 'PENDING', nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: 'asc' },
    take: limit,
    select: { id: true, attempts: true },
  });
  const counts = { sent: 0, retry: 0, failed: 0, skipped: 0, claimedElsewhere: 0 };
  for (const j of due) {
    if (!(await claim(db, j.id, j.attempts, now))) {
      counts.claimedElsewhere++;
      continue;
    }
    const s = await attempt(db, j.id, send, now);
    if (s === 'SENT') counts.sent++;
    else if (s === 'RETRY') counts.retry++;
    else if (s === 'FAILED') counts.failed++;
    else counts.skipped++;
  }
  return counts;
}

/** "שליחה חוזרת" ידנית למייל שנכשל סופית. */
export async function retryFailedEmail(db: PrismaClient, id: string, now = new Date()): Promise<boolean> {
  const r = await db.emailJob.updateMany({ where: { id, status: 'FAILED' }, data: { status: 'PENDING', attempts: 0, nextAttemptAt: now } });
  return r.count === 1;
}
