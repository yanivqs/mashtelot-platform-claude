import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/prisma';
import { sendEmail } from '@/lib/email';
import { cleanupJob, emailsJob, JOB_NAMES, releaseReservationsJob, runJob, type JobName } from '@/lib/jobs';

/**
 * משימות רקע (§21) — מופעלות ב-Vercel Cron (vercel.json). Vercel שולח `Authorization: Bearer $CRON_SECRET`.
 * בלי CRON_SECRET בסביבה — המשימות לא רצות (503), כדי שאף אחד מבחוץ לא יוכל להפעיל אותן.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request, ctx: { params: Promise<{ job: string }> }) {
  const { job } = await ctx.params;
  if (!process.env.CRON_SECRET) return new Response('cron not configured', { status: 503 });
  if (!authorized(req)) return new Response('Unauthorized', { status: 401 });
  if (!(JOB_NAMES as readonly string[]).includes(job)) return new Response('Not found', { status: 404 });

  const name = job as JobName;
  const r = await runJob<Record<string, number>>(prisma, name, () =>
    name === 'reservations' ? releaseReservationsJob(prisma) : name === 'emails' ? emailsJob(prisma, sendEmail) : cleanupJob(prisma),
  );
  return Response.json(r, { status: r.ok ? 200 : 500 });
}
