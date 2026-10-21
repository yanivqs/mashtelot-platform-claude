/**
 * CRM של משתלה (R06-05/07/08/09). מקבל את ה-DB כפרמטר (בר-בדיקה).
 * רשימת הלקוחות = לקוחות רשומים + אורחים מתוך ההזמנות, מאוחדים לפי מייל (lower) — בלי ליצור
 * רשומות מראש. רשומת Customer לאורח נוצרת רק כשבעל המשתלה מוסיף לו תגית/קבוצה/הערה.
 * יצוא לשיווק — **רק מי שהסכים לדיוור** (R06-09), עם הגנה מנוסחאות ב-CSV.
 */
import { Prisma, type PrismaClient, type CustomerType } from '@prisma/client';
import { addEntry, balanceOf, lockCustomer } from '@/lib/loyalty';

export const CRM_PAGE_SIZE = 50;
export const MAX_TAGS = 20;

export interface CrmFilter {
  q?: string;
  tag?: string;
  groupId?: string;
  type?: CustomerType;
  minSpent?: number;
  /** הזמנה אחרונה ב-X הימים האחרונים */
  activeDays?: number;
  consent?: boolean;
}

export interface CrmRow {
  email: string;
  customerId: string | null;
  name: string | null;
  phone: string | null;
  orders: number;
  spent: number;
  lastOrderAt: Date | null;
  tags: string[];
  groupId: string | null;
  groupName: string | null;
  type: CustomerType;
  companyName: string | null;
  marketingConsentAt: Date | null;
  registered: boolean;
}

export function parseCrmFilter(sp: Record<string, string | undefined>): CrmFilter {
  const num = (v?: string) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined);
  return {
    q: sp.q?.trim() || undefined,
    tag: sp.tag?.trim() || undefined,
    groupId: sp.group || undefined,
    type: sp.type === 'BUSINESS' || sp.type === 'PRIVATE' ? sp.type : undefined,
    minSpent: num(sp.minSpent),
    activeDays: num(sp.activeDays),
    consent: sp.consent === '1' ? true : undefined,
  };
}

function baseQuery(nurseryId: string) {
  return Prisma.sql`
    WITH o AS (
      SELECT lower(customer_email) AS email,
             count(*)::int AS orders,
             coalesce(sum(total_amount) FILTER (WHERE status <> 'CANCELLED'), 0)::float8 AS spent,
             max(created_at) AS last_at,
             (array_agg(customer_name ORDER BY created_at DESC))[1] AS name,
             (array_agg(customer_phone ORDER BY created_at DESC))[1] AS phone
      FROM orders WHERE nursery_id = ${nurseryId} GROUP BY lower(customer_email)
    ),
    c AS (SELECT * FROM customers WHERE nursery_id = ${nurseryId}),
    r AS (
      SELECT coalesce(c.email, o.email) AS email, c.id AS "customerId",
             coalesce(c.full_name, o.name) AS name, coalesce(c.phone, o.phone) AS phone,
             coalesce(o.orders, 0) AS orders, coalesce(o.spent, 0) AS spent, o.last_at AS "lastOrderAt",
             coalesce(c.tags, ARRAY[]::text[]) AS tags, c.group_id AS "groupId", g.name AS "groupName",
             coalesce(c.type, 'PRIVATE') AS type, c.company_name AS "companyName",
             c.marketing_consent_at AS "marketingConsentAt", (c.last_login_at IS NOT NULL) AS registered
      FROM o FULL OUTER JOIN c ON c.email = o.email
      LEFT JOIN customer_groups g ON g.id = c.group_id
    )`;
}

function where(f: CrmFilter) {
  const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    conds.push(Prisma.sql`(email ILIKE ${like} OR name ILIKE ${like} OR phone ILIKE ${like} OR "companyName" ILIKE ${like})`);
  }
  if (f.tag) conds.push(Prisma.sql`${f.tag} = ANY(tags)`);
  if (f.groupId) conds.push(Prisma.sql`"groupId" = ${f.groupId}`);
  if (f.type) conds.push(Prisma.sql`type::text = ${f.type}`);
  if (f.minSpent !== undefined) conds.push(Prisma.sql`spent >= ${f.minSpent}`);
  if (f.activeDays !== undefined) conds.push(Prisma.sql`"lastOrderAt" >= now() - make_interval(days => ${Math.floor(f.activeDays)}::int)`);
  if (f.consent) conds.push(Prisma.sql`"marketingConsentAt" IS NOT NULL`);
  return Prisma.join(conds, ' AND ');
}

export async function listCustomers(db: PrismaClient, nurseryId: string, f: CrmFilter, page = 1): Promise<{ rows: CrmRow[]; total: number }> {
  const offset = (Math.max(1, page) - 1) * CRM_PAGE_SIZE;
  const [rows, count] = await Promise.all([
    db.$queryRaw<CrmRow[]>`${baseQuery(nurseryId)} SELECT * FROM r WHERE ${where(f)} ORDER BY "lastOrderAt" DESC NULLS LAST, email LIMIT ${CRM_PAGE_SIZE} OFFSET ${offset}`,
    db.$queryRaw<Array<{ n: number }>>`${baseQuery(nurseryId)} SELECT count(*)::int AS n FROM r WHERE ${where(f)}`,
  ]);
  return { rows, total: count[0]?.n ?? 0 };
}

export async function getCrmRow(db: PrismaClient, nurseryId: string, email: string): Promise<CrmRow | null> {
  const rows = await db.$queryRaw<CrmRow[]>`${baseQuery(nurseryId)} SELECT * FROM r WHERE email = ${email.toLowerCase()} LIMIT 1`;
  return rows[0] ?? null;
}

/** רשומת לקוח ל-CRM: קיימת, או חדשה לאורח שיש לו הזמנות במשתלה (לא ממציאים לקוחות). */
async function ensureCustomer(db: PrismaClient, nurseryId: string, email: string) {
  const e = email.toLowerCase();
  const existing = await db.customer.findUnique({ where: { nurseryId_email: { nurseryId, email: e } } });
  if (existing) return existing;
  const last = await db.order.findFirst({
    where: { nurseryId, customerEmail: { equals: e, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    select: { customerName: true, customerPhone: true },
  });
  if (!last) return null;
  return db.customer.upsert({
    where: { nurseryId_email: { nurseryId, email: e } },
    create: { nurseryId, email: e, fullName: last.customerName, phone: last.customerPhone },
    update: {},
  });
}

export function cleanTags(raw: string): string[] {
  const out: string[] = [];
  for (const t of raw.split(',')) {
    const tag = t.trim().replace(/\s+/g, ' ').slice(0, 30);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, MAX_TAGS);
}

export type CrmResult = { ok: true } | { ok: false; error: string };

export async function updateCrmFields(
  db: PrismaClient,
  nurseryId: string,
  email: string,
  input: { tags: string; groupId: string | null; type: string; companyName?: string | null; taxId?: string | null },
): Promise<CrmResult> {
  if (input.type !== 'PRIVATE' && input.type !== 'BUSINESS') return { ok: false, error: 'סוג לקוח לא תקין' };
  if (input.groupId && !(await db.customerGroup.count({ where: { id: input.groupId, nurseryId } }))) return { ok: false, error: 'הקבוצה לא נמצאה' };
  const c = await ensureCustomer(db, nurseryId, email);
  if (!c) return { ok: false, error: 'הלקוח לא נמצא' };
  const business = input.type === 'BUSINESS';
  await db.customer.update({
    where: { id: c.id },
    data: {
      tags: cleanTags(input.tags),
      groupId: input.groupId || null,
      type: input.type,
      companyName: business ? input.companyName?.trim().slice(0, 120) || null : null,
      taxId: business ? input.taxId?.trim().slice(0, 20) || null : null,
    },
  });
  return { ok: true };
}

export async function addNote(db: PrismaClient, nurseryId: string, email: string, body: string, authorEmail: string | null): Promise<CrmResult> {
  const text = body.trim().slice(0, 2000);
  if (!text) return { ok: false, error: 'ההערה ריקה' };
  const c = await ensureCustomer(db, nurseryId, email);
  if (!c) return { ok: false, error: 'הלקוח לא נמצא' };
  await db.customerNote.create({ data: { customerId: c.id, body: text, authorEmail } });
  return { ok: true };
}

function parseDiscount(raw: unknown): number | null {
  const s = String(raw ?? '').trim();
  if (!s) return 0;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 50 ? Math.round(n * 100) / 100 : null;
}

export async function createGroup(db: PrismaClient, nurseryId: string, name: string, discountPct: unknown = 0): Promise<CrmResult> {
  const n = name.trim().slice(0, 60);
  if (!n) return { ok: false, error: 'יש לתת שם לקבוצה' };
  const pct = parseDiscount(discountPct);
  if (pct === null) return { ok: false, error: 'הנחת קבוצה — בין 0 ל-50%' };
  if (await db.customerGroup.count({ where: { nurseryId, name: n } })) return { ok: false, error: 'קבוצה בשם הזה כבר קיימת' };
  await db.customerGroup.create({ data: { nurseryId, name: n, discountPct: pct } });
  return { ok: true };
}

/** R06-07: הנחה באחוזים לכל הקטלוג ללקוחות הקבוצה (חלה על הזמנות חדשות בלבד). */
export async function setGroupDiscount(db: PrismaClient, nurseryId: string, groupId: string, discountPct: unknown): Promise<CrmResult> {
  const pct = parseDiscount(discountPct);
  if (pct === null) return { ok: false, error: 'הנחת קבוצה — בין 0 ל-50%' };
  const r = await db.customerGroup.updateMany({ where: { id: groupId, nurseryId }, data: { discountPct: pct } });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'הקבוצה לא נמצאה' };
}

/** R06-06: התאמה ידנית של נקודות (חיובית/שלילית) עם סיבה — לקוח קיים במשתלה; לא מתחת לאפס. */
export async function adjustPoints(db: PrismaClient, nurseryId: string, email: string, points: number, note: string, actorEmail: string | null): Promise<CrmResult> {
  if (!Number.isInteger(points) || points === 0 || Math.abs(points) > 1_000_000) return { ok: false, error: 'כמות נקודות לא תקינה' };
  const reason = note.trim().slice(0, 200);
  if (!reason) return { ok: false, error: 'יש לכתוב סיבה' };
  const c = await db.customer.findUnique({ where: { nurseryId_email: { nurseryId, email: email.toLowerCase() } } });
  if (!c) return { ok: false, error: 'ללקוח אין חשבון' };
  return db.$transaction(async (tx) => {
    await lockCustomer(tx, c.id);
    if (points < 0 && (await balanceOf(tx, c.id)) + points < 0) return { ok: false as const, error: 'אין מספיק נקודות' };
    await addEntry(tx, { nurseryId, customerId: c.id, kind: 'ADJUST', points, note: reason, actorEmail });
    return { ok: true as const };
  });
}

export async function deleteGroup(db: PrismaClient, nurseryId: string, groupId: string): Promise<CrmResult> {
  const r = await db.customerGroup.deleteMany({ where: { id: groupId, nurseryId } });
  return r.count === 1 ? { ok: true } : { ok: false, error: 'הקבוצה לא נמצאה' };
}

// ---------- יצוא (R06-08/09) ----------

/** תא CSV: מרכאות, וחסימת נוסחאות (=, +, -, @, טאב) — Excel לא יריץ קוד מהקובץ. */
export function csvCell(v: unknown): string {
  let s = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** יצוא לשיווק: רק לקוחות שהסכימו לדיוור (גם אם הסינון לא ביקש), עד 5,000 שורות. */
export async function exportCustomersCsv(db: PrismaClient, nurseryId: string, f: CrmFilter): Promise<{ csv: string; count: number }> {
  const rows = await db.$queryRaw<CrmRow[]>`${baseQuery(nurseryId)} SELECT * FROM r WHERE ${where({ ...f, consent: true })} ORDER BY email LIMIT 5000`;
  const header = ['אימייל', 'שם', 'טלפון', 'סוג', 'חברה', 'קבוצה', 'תגיות', 'הזמנות', 'סכום רכישות', 'הזמנה אחרונה', 'הסכמה לדיוור'];
  const lines = rows.map((r) =>
    [r.email, r.name, r.phone, r.type === 'BUSINESS' ? 'עסקי' : 'פרטי', r.companyName, r.groupName, r.tags.join(', '), r.orders, r.spent.toFixed(2), r.lastOrderAt, r.marketingConsentAt]
      .map(csvCell)
      .join(','),
  );
  // BOM — כדי ש-Excel יציג עברית נכון
  return { csv: '﻿' + [header.map(csvCell).join(','), ...lines].join('\r\n'), count: rows.length };
}
