/**
 * §21: תור מיילים ומשימות רקע מול ה-DB — שליחה מיידית, Backoff, כשל סופי, שליחה חוזרת,
 * בלי שליחה כפולה בריצות מקבילות, תיעוד ריצה שנכשלה, שחרור שמירות שפגו וניקוי.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { MAX_ATTEMPTS, nextAttemptAfter, processEmailQueue, retryFailedEmail, sendViaOutbox, type SendFn } from '@/lib/email-outbox';
import { cleanupJob, runJob } from '@/lib/jobs';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;
const RUN = `jobs-${Date.now()}`;
const ok: SendFn = async () => ({ ok: true, id: 'prov-1' });
const fail: SendFn = async () => ({ ok: false, error: 'smtp down' });

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.emailJob.deleteMany({ where: { kind: { startsWith: RUN } } });
  await prisma.jobRun.deleteMany({ where: { name: 'cleanup', error: { contains: RUN } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const msg = (kind = RUN) => ({ nurseryId: f.A.nurseryId, kind, to: 'x@test.invalid', subject: 's', html: '<p>h</p>' });

describe('§21 email outbox', () => {
  it('backoff schedule; gives up after MAX_ATTEMPTS', () => {
    const t0 = new Date('2026-10-23T00:00:00Z');
    expect(nextAttemptAfter(1, t0)?.toISOString()).toBe('2026-10-23T00:01:00.000Z');
    expect(nextAttemptAfter(2, t0)?.toISOString()).toBe('2026-10-23T00:05:00.000Z');
    expect(nextAttemptAfter(MAX_ATTEMPTS, t0)).toBeNull();
  });

  it('immediate success → SENT; skipped (no provider) → SKIPPED', async () => {
    const a = await sendViaOutbox(prisma, msg(), ok);
    expect(a.status).toBe('SENT');
    expect(await prisma.emailJob.findUniqueOrThrow({ where: { id: a.id } })).toMatchObject({ status: 'SENT', attempts: 1, providerId: 'prov-1' });
    const b = await sendViaOutbox(prisma, msg(), async () => ({ ok: false, skipped: true }));
    expect(b.status).toBe('SKIPPED');
  });

  it('failure → retried by the job with backoff → FAILED after the last attempt → manual retry → SENT', async () => {
    let now = new Date('2026-10-23T10:00:00Z');
    const r = await sendViaOutbox(prisma, msg(`${RUN}-retry`), fail, now);
    expect(r.status).toBe('RETRY');
    // לפני שהגיע הזמן — לא נוגעים
    expect((await processEmailQueue(prisma, ok, new Date(now.getTime() + 30_000))).sent).toBe(0);
    for (let i = 2; i <= MAX_ATTEMPTS; i++) {
      now = new Date(now.getTime() + 7 * 60 * 60_000);
      await processEmailQueue(prisma, fail, now);
    }
    const j = await prisma.emailJob.findUniqueOrThrow({ where: { id: r.id } });
    expect(j).toMatchObject({ status: 'FAILED', attempts: MAX_ATTEMPTS, lastError: 'smtp down' });
    expect(await retryFailedEmail(prisma, r.id, now)).toBe(true);
    expect(await retryFailedEmail(prisma, r.id, now)).toBe(false);
    await processEmailQueue(prisma, ok, now);
    expect((await prisma.emailJob.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('SENT');
  });

  it('two concurrent queue runs never send the same email twice', async () => {
    const now = new Date('2026-10-24T10:00:00Z');
    const r = await sendViaOutbox(prisma, msg(`${RUN}-race`), fail, now);
    let sends = 0;
    const counting: SendFn = async () => {
      sends++;
      await new Promise((res) => setTimeout(res, 50));
      return { ok: true };
    };
    const later = new Date(now.getTime() + 2 * 60_000);
    await Promise.all([processEmailQueue(prisma, counting, later), processEmailQueue(prisma, counting, later)]);
    expect(sends).toBe(1);
    expect((await prisma.emailJob.findUniqueOrThrow({ where: { id: r.id } })).status).toBe('SENT');
  });
});

describe('§21 jobs', () => {
  it('a failing job is recorded as FAILED with the error, not lost', async () => {
    const res = await runJob(prisma, 'cleanup', async () => {
      throw new Error(`boom ${RUN}`);
    });
    expect(res.ok).toBe(false);
    const run = await prisma.jobRun.findFirstOrThrow({ where: { error: { contains: RUN } } });
    expect(run.status).toBe('FAILED');
    expect(run.finishedAt).not.toBeNull();
  });

  it('cleanup removes old OTPs and expired rate-limit windows only', async () => {
    const old = new Date(Date.now() - 2 * 24 * 60 * 60_000);
    await prisma.customerOtp.create({ data: { nurseryId: f.A.nurseryId, email: `${RUN}@x`, codeHash: 'h', expiresAt: old, createdAt: old } });
    await prisma.customerOtp.create({ data: { nurseryId: f.A.nurseryId, email: `${RUN}-new@x`, codeHash: 'h', expiresAt: new Date(Date.now() + 60_000) } });
    await prisma.rateLimit.create({ data: { key: `${RUN}-old`, windowStart: old, count: 1, expiresAt: old } });
    await prisma.rateLimit.create({ data: { key: `${RUN}-live`, windowStart: new Date(), count: 1, expiresAt: new Date(Date.now() + 60_000) } });
    await cleanupJob(prisma);
    expect(await prisma.customerOtp.count({ where: { email: { startsWith: RUN } } })).toBe(1);
    expect(await prisma.rateLimit.findUnique({ where: { key: `${RUN}-old` } })).toBeNull();
    expect(await prisma.rateLimit.findUnique({ where: { key: `${RUN}-live` } })).not.toBeNull();
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: RUN } } });
  });
});
