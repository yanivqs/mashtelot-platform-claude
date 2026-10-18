/**
 * S-22: הגבלת קצב משותפת (טבלת rate_limits) · S-23: חלונות של מפתחות שונים אינם משפיעים זה על זה.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { hitRateLimit, purgeExpiredRateLimits } from '@/lib/rate-limit-store';

const run = randomUUID().slice(0, 8);
const k = (name: string) => `test:${run}:${name}`;
// "מופעי שרת" נפרדים — חיבורים נפרדים לאותו בסיס נתונים. מאגר חיבורים קטן: ה-pooler של
// Supabase במצב session מוגבל ל-15 לקוחות.
function instance() {
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set('connection_limit', '4');
  return new PrismaClient({ datasources: { db: { url: url.toString() } } });
}
const instanceA = instance();
const instanceB = instance();

afterAll(async () => {
  await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `test:${run}:` } } });
  await instanceA.$disconnect();
  await instanceB.$disconnect();
  await prisma.$disconnect();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('S-22 shared rate limit', () => {
  it('allows up to the limit, then blocks with a retryAfter inside the window', async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push(await hitRateLimit(prisma, k('basic'), 3, 60_000));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0, 0]);
    expect(results[3]!.retryAfter).toBeGreaterThan(0);
    expect(results[3]!.retryAfter).toBeLessThanOrEqual(60);
  });

  it('is shared between server instances (two separate DB clients)', async () => {
    expect((await hitRateLimit(prisma, k('shared'), 2, 60_000)).ok).toBe(true);
    expect((await hitRateLimit(instanceB, k('shared'), 2, 60_000)).ok).toBe(true);
    expect((await hitRateLimit(prisma, k('shared'), 2, 60_000)).ok).toBe(false);
    expect((await hitRateLimit(instanceB, k('shared'), 2, 60_000)).ok).toBe(false);
  });

  it('is atomic under concurrency: 40 parallel hits from 2 instances, limit 10 → exactly 10 allowed', async () => {
    const hits = Array.from({ length: 40 }, (_, i) =>
      hitRateLimit(i % 2 ? instanceA : instanceB, k('race'), 10, 60_000),
    );
    const results = await Promise.all(hits);
    expect(results.filter((r) => r.ok)).toHaveLength(10);
  });

  it('keys are independent', async () => {
    for (let i = 0; i < 3; i++) await hitRateLimit(prisma, k('a'), 1, 60_000);
    expect((await hitRateLimit(prisma, k('b'), 1, 60_000)).ok).toBe(true);
  });

  it('resets after the window expires (fixed window)', async () => {
    expect((await hitRateLimit(prisma, k('expire'), 1, 300)).ok).toBe(true);
    expect((await hitRateLimit(prisma, k('expire'), 1, 300)).ok).toBe(false);
    await sleep(450);
    expect((await hitRateLimit(prisma, k('expire'), 1, 300)).ok).toBe(true);
  });

  it('S-23: a short-window key and purge do not shorten a long-window key', async () => {
    expect((await hitRateLimit(prisma, k('long'), 1, 15 * 60_000)).ok).toBe(true);
    await hitRateLimit(prisma, k('short'), 1, 100);
    await sleep(200);
    await purgeExpiredRateLimits(prisma);
    expect(await prisma.rateLimit.findUnique({ where: { key: k('short') } })).toBeNull();
    expect((await hitRateLimit(prisma, k('long'), 1, 15 * 60_000)).ok).toBe(false);
  });

  it('truncates very long keys instead of failing', async () => {
    const long = k('x'.repeat(2000));
    expect((await hitRateLimit(prisma, long, 1, 60_000)).ok).toBe(true);
    expect((await hitRateLimit(prisma, long, 1, 60_000)).ok).toBe(false);
  });
});
