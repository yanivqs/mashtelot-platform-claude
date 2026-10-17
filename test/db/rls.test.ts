/**
 * C-P0-02: RLS וחשיפה לתפקידים הציבוריים של Supabase (אפיון §1.03, §4.07, §19.01, R10-03).
 *
 * 1. אינווריאנט (כל יעד): לכל טבלה בסכמת public מופעל RLS — כולל טבלאות עתידיות,
 *    כך שמיגרציה שתוסיף טבלה בלי RLS תיכשל כאן.
 * 2. Supabase בלבד (כשקיימים התפקידים anon/authenticated): בתוך טרנזקציה עם
 *    `SET LOCAL ROLE` — כמו ש-PostgREST עושה — אין קריאה או כתיבה לאף טבלה.
 * הטרנזקציות תמיד מבוטלות (rollback), כך שהבדיקה אינה משנה נתונים.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

const PUBLIC_ROLES = ['anon', 'authenticated'] as const;

let f: TenantFixtures;
let tables: string[] = [];
let hasSupabaseRoles = false;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  tables = (
    await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  ).map((r) => r.tablename);
  const roles = await prisma.$queryRaw<Array<{ rolname: string }>>`
    SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`;
  hasSupabaseRoles = roles.length === PUBLIC_ROLES.length;
});

afterAll(async () => {
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

class Rollback extends Error {}

/** מריץ פעולה בתפקיד נתון בתוך טרנזקציה שתמיד מבוטלת. מחזיר את התוצאה או את השגיאה. */
type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };

async function asRole<T>(role: string, fn: (tx: typeof prisma) => Promise<T>): Promise<Outcome<T>> {
  // ההשמה קורית בתוך ה-callback של הטרנזקציה; ה-cast מונע מ-TS לצמצם לערך ההתחלתי
  let outcome = { ok: false, error: 'not run' } as Outcome<T>;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${role}`);
      try {
        outcome = { ok: true, value: await fn(tx as unknown as typeof prisma) };
      } catch (e) {
        outcome = { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
      throw new Rollback();
    });
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }
  return outcome;
}

describe('C-P0-02 row level security', () => {
  it('found the application tables', () => {
    expect(tables).toEqual(expect.arrayContaining(['nurseries', 'orders', 'audit_events', 'blog_posts']));
  });

  it('every table in schema public has RLS enabled', async () => {
    const rows = await prisma.$queryRaw<Array<{ relname: string }>>`
      SELECT c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      ORDER BY c.relname`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  for (const role of PUBLIC_ROLES) {
    it(`${role} cannot read any row from any table (Supabase only)`, async (ctx) => {
      if (!hasSupabaseRoles) ctx.skip();
      const leaks: string[] = [];
      for (const table of tables) {
        const res = await asRole(role, (tx) =>
          tx.$queryRawUnsafe<Array<{ n: bigint }>>(`SELECT count(*) AS n FROM "public"."${table}"`),
        );
        // מותר: שגיאת הרשאה, או 0 שורות גלויות. אסור: שורות גלויות.
        if (res.ok && Number(res.value[0].n) > 0) leaks.push(`${table} (${res.value[0].n} rows)`);
      }
      expect(leaks).toEqual([]);
    });

    it(`${role} cannot insert, update or delete (Supabase only)`, async (ctx) => {
      if (!hasSupabaseRoles) ctx.skip();
      const writes = [
        ['nurseries', `INSERT INTO "public"."nurseries" (id, name, subdomain, owner_email, updated_at) VALUES (gen_random_uuid(), 'x', 'rls-probe', 'x@example.invalid', now())`],
        ['static_pages', `UPDATE "public"."static_pages" SET title = 'pwned' WHERE id = '${f.B.pageId}'`],
        ['blog_posts', `DELETE FROM "public"."blog_posts" WHERE id = '${f.A.blogPostId}'`],
        ['audit_events', `INSERT INTO "public"."audit_events" (id, action, entity_type) VALUES (gen_random_uuid(), 'probe', 'probe')`],
        ['_prisma_migrations', `DELETE FROM "public"."_prisma_migrations"`],
      ] as const;
      const allowed: string[] = [];
      for (const [table, sql] of writes) {
        const res = await asRole(role, (tx) => tx.$executeRawUnsafe(sql));
        // UPDATE/DELETE ש"הצליחו" על 0 שורות (RLS) נחשבים חסומים; כל שורה שהושפעה = דליפה
        if (res.ok && res.value > 0) allowed.push(`${table} (${res.value} rows)`);
      }
      expect(allowed).toEqual([]);
    });
  }

  it('the application role still reads and writes normally (regression)', async () => {
    const page = await prisma.staticPage.update({
      where: { id: f.A.pageId },
      data: { title: 'עדיין עובד' },
    });
    expect(page.title).toBe('עדיין עובד');
  });
});
