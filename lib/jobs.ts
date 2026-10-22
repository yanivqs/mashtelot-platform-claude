/**
 * משימות רקע (§21). מקבל את ה-DB כפרמטר (בר-בדיקה).
 * כל ריצה נרשמת ב-job_runs (סטטוס, משך, תוצאה, שגיאה) — כשל אינו נעלם בשקט ומוצג ב"מיילים ומערכת".
 * המשימות אידמפוטנטיות (עדכונים מותנים) — ריצה כפולה או חופפת אינה מזיקה.
 */
import type { Prisma, PrismaClient } from '@prisma/client';
import { releaseExpiredReservations } from '@/lib/order-service';
import { processEmailQueue, type SendFn } from '@/lib/email-outbox';

export const JOB_NAMES = ['reservations', 'emails', 'cleanup'] as const;
export type JobName = (typeof JOB_NAMES)[number];

export const JOB_LABELS: Record<JobName, string> = {
  reservations: 'שחרור שמירות מלאי שפגו',
  emails: 'שליחה חוזרת של מיילים',
  cleanup: 'ניקוי נתונים זמניים',
};

export async function runJob<T>(db: PrismaClient, name: JobName, fn: () => Promise<T>): Promise<{ ok: boolean; result?: T; error?: string }> {
  const run = await db.jobRun.create({ data: { name } });
  try {
    const result = await fn();
    await db.jobRun.update({ where: { id: run.id }, data: { status: 'SUCCEEDED', finishedAt: new Date(), result: (result ?? null) as Prisma.InputJsonValue } });
    return { ok: true, result };
  } catch (e) {
    const error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    await db.jobRun.update({ where: { id: run.id }, data: { status: 'FAILED', finishedAt: new Date(), error: error.slice(0, 2000) } });
    console.error(JSON.stringify({ level: 'error', service: 'jobs', job: name, error }));
    return { ok: false, error };
  }
}

/** שמירות שפגו בכל המשתלות — עד 500 בריצה. */
export async function releaseReservationsJob(db: PrismaClient, now = new Date()) {
  let released = 0;
  for (let i = 0; i < 10; i++) {
    const n = await releaseExpiredReservations(db, { now, limit: 50 });
    released += n;
    if (n < 50) break;
  }
  return { released };
}

export async function emailsJob(db: PrismaClient, send: SendFn, now = new Date()) {
  return processEmailQueue(db, send, now, 50);
}

const DAY = 24 * 60 * 60_000;

/** ניקוי: קודי כניסה (יום), חלונות הגבלת קצב שפגו, מיילים שנשלחו (30 יום — מכילים פרטים אישיים), ריצות ישנות (30 יום). */
export async function cleanupJob(db: PrismaClient, now = new Date()) {
  const [otps, rateLimits, emails, runs] = await Promise.all([
    db.customerOtp.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - DAY) } } }),
    db.rateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.emailJob.deleteMany({ where: { status: { in: ['SENT', 'SKIPPED'] }, createdAt: { lt: new Date(now.getTime() - 30 * DAY) } } }),
    db.jobRun.deleteMany({ where: { startedAt: { lt: new Date(now.getTime() - 30 * DAY) } } }),
  ]);
  return { otps: otps.count, rateLimits: rateLimits.count, emails: emails.count, jobRuns: runs.count };
}
