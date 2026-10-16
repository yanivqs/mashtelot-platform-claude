/**
 * שומר הבטיחות של בסיס הנתונים לבדיקות (E01 / C-P0-04).
 *
 * בדיקות אינטגרציה יוצרות ומוחקות נתונים, וסקריפט ההכנה מריץ `prisma migrate reset`.
 * לכן מותר להריץ אותן רק מול יעד שאומת במפורש כסביבת בדיקות (אפיון §22.04, §38):
 * - Postgres מקומי, ושם בסיס הנתונים מסתיים ב-`_test`; או
 * - פרויקט Supabase שמזהה ה-ref שלו מופיע ברשימת ההיתר `TEST_DB_ALLOWED_REFS`.
 * בכל מקרה היעד חייב להיות שונה מכתובות ה-Production (מ-`.env`), גם בכתובת וגם ב-ref.
 * טהור — ללא תלות ב-env/קבצים — כדי שיהיה בר-בדיקה.
 */

export class UnsafeTestDatabaseError extends Error {}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

interface ParsedDbUrl {
  host: string;
  database: string;
  /** מזהה פרויקט Supabase, אם ניתן לחלץ */
  ref: string | null;
  normalized: string;
}

export function parseDbUrl(raw: string): ParsedDbUrl {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeTestDatabaseError('TEST_DATABASE_URL אינה כתובת תקינה');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new UnsafeTestDatabaseError('TEST_DATABASE_URL חייבת להיות כתובת PostgreSQL');
  }
  const host = url.hostname.toLowerCase();
  const user = decodeURIComponent(url.username);
  // pooler: user = postgres.<ref> · direct: host = db.<ref>.supabase.co
  const ref =
    user.match(/^postgres\.([a-z0-9]{20})$/)?.[1] ??
    host.match(/^db\.([a-z0-9]{20})\.supabase\.co$/)?.[1] ??
    host.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] ??
    null;
  return {
    host,
    database: url.pathname.replace(/^\//, ''),
    ref,
    normalized: `${user}@${host}:${url.port || '5432'}/${url.pathname.replace(/^\//, '')}`,
  };
}

export interface GuardOptions {
  /** כתובות ה-Production (DATABASE_URL / DIRECT_URL מ-.env) שאסור לגעת בהן */
  productionUrls: Array<string | undefined>;
  /** מזהי Supabase שאושרו במפורש כסביבת בדיקות */
  allowedRefs: string[];
}

/** זורק אם היעד אינו סביבת בדיקות מאומתת. מחזיר תיאור קצר (ללא סיסמה) להדפסה. */
export function assertSafeTestDatabaseUrl(testUrl: string | undefined, opts: GuardOptions): string {
  if (!testUrl || !testUrl.trim()) {
    throw new UnsafeTestDatabaseError(
      'TEST_DATABASE_URL לא מוגדרת — בדיקות בסיס נתונים לא ירוצו (ראו .env.test)',
    );
  }
  const target = parseDbUrl(testUrl.trim());

  for (const prodRaw of opts.productionUrls) {
    if (!prodRaw?.trim()) continue;
    let prod: ParsedDbUrl;
    try {
      prod = parseDbUrl(prodRaw.trim());
    } catch {
      continue;
    }
    if (prod.normalized === target.normalized) {
      throw new UnsafeTestDatabaseError('TEST_DATABASE_URL זהה לכתובת ה-Production');
    }
    if (prod.ref && target.ref && prod.ref === target.ref) {
      throw new UnsafeTestDatabaseError(`TEST_DATABASE_URL מצביעה לפרויקט ה-Production (${prod.ref})`);
    }
  }

  if (LOCAL_HOSTS.has(target.host)) {
    if (!target.database.endsWith('_test')) {
      throw new UnsafeTestDatabaseError(
        `בסיס נתונים מקומי לבדיקות חייב להסתיים ב-_test (התקבל "${target.database}")`,
      );
    }
    return `local:${target.database}`;
  }

  const allowed = new Set(opts.allowedRefs.map((r) => r.trim()).filter(Boolean));
  if (target.ref && allowed.has(target.ref)) {
    return `supabase:${target.ref}`;
  }

  throw new UnsafeTestDatabaseError(
    `יעד הבדיקות ${target.host} אינו מקומי ואינו ברשימת TEST_DB_ALLOWED_REFS`,
  );
}

export function parseAllowedRefs(raw: string | undefined): string[] {
  return (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}
