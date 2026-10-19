/**
 * הפניות קבועות לכתובות ישנות (§14.01, R07-07). טהור — ללא Prisma/Next, בר-בדיקה.
 *
 * - הכתובת הישנה נשמרת כנתיב מנורמל (אפשר להדביק URL מלא של האתר הישן — נלקח רק הנתיב).
 * - היעד חייב להיות נתיב באותו אתר ("/catalog"), לא דומיין חיצוני — מונע Open Redirect.
 * - ההפניה מופעלת רק כשהכתובת לא קיימת בחנות (במקום 404), ולכן אינה מוסיפה עומס לגלישה רגילה.
 * - שרשראות מקוצרות אוטומטית (A→B ואז B→C ⇒ A→C), ולולאות נדחות.
 */

export const MAX_PATH_LENGTH = 1000;
export const MAX_IMPORT_ROWS = 2000;

/** סיומות של דפים מאתרים ישנים שה-proxy מעביר לחנות (ולא מתייחס אליהן כקבצים סטטיים). */
export const LEGACY_PAGE_EXTENSIONS = ['html', 'htm', 'php', 'asp', 'aspx', 'jsp', 'cfm'];

export function isLegacyPagePath(pathname: string): boolean {
  const m = pathname.toLowerCase().match(/\.([a-z0-9]+)$/);
  return Boolean(m && LEGACY_PAGE_EXTENSIONS.includes(m[1]!));
}

/**
 * נרמול נתיב: מפענח קידוד, מסיר דומיין/פרוטוקול, query ו-#, לוכסנים כפולים ולוכסן סופי,
 * ואותיות לטיניות קטנות. מחזיר null לקלט לא תקין.
 */
export function normalizeRedirectPath(raw: string): string | null {
  let s = raw.trim();
  if (!s) return null;
  // URL מלא של האתר הישן → רק הנתיב
  if (/^https?:\/\//i.test(s)) {
    try {
      s = new URL(s).pathname;
    } catch {
      return null;
    }
  }
  s = s.split('#')[0]!.split('?')[0]!;
  try {
    s = decodeURIComponent(s);
  } catch {
    /* נשאר מקודד */
  }
  if (!s.startsWith('/')) s = `/${s}`;
  s = s.replace(/\/{2,}/g, '/');
  if (s.length > 1) s = s.replace(/\/+$/, '');
  if (/[\s<>"\\]/.test(s) || /[\u0000-\u001F]/.test(s)) return null;
  if (s.length > MAX_PATH_LENGTH) return null;
  return s.replace(/[A-Z]/g, (c) => c.toLowerCase());
}

/** יעד: נתיב פנימי בלבד (לא "//host", לא "http..."), אפשר עם query. */
export function normalizeRedirectTarget(raw: string): string | null {
  const s = raw.trim();
  if (!s.startsWith('/') || s.startsWith('//') || s.startsWith('/\\')) return null;
  if (/[\s<>"\\]/.test(s) || s.length > MAX_PATH_LENGTH) return null;
  const [path, query] = s.split('?', 2) as [string, string | undefined];
  const p = normalizeRedirectPath(path);
  if (!p) return null;
  return query ? `${p}?${query}` : p;
}

export type RuleCheck = { ok: true; from: string; to: string } | { ok: false; error: string };

export function checkRule(fromRaw: string, toRaw: string): RuleCheck {
  const from = normalizeRedirectPath(fromRaw);
  if (!from) return { ok: false, error: 'הכתובת הישנה אינה תקינה' };
  if (from === '/') return { ok: false, error: 'אי אפשר להפנות את דף הבית' };
  const to = normalizeRedirectTarget(toRaw);
  if (!to) return { ok: false, error: 'היעד חייב להיות נתיב באתר, שמתחיל ב-/ (למשל /catalog)' };
  if (to.split('?')[0] === from) return { ok: false, error: 'הכתובת הישנה והיעד זהים' };
  return { ok: true, from, to };
}

export interface ExistingRule {
  fromPath: string;
  toPath: string;
}

export interface PlannedRule {
  from: string;
  to: string;
  /** כללים קיימים שמפנים לכתובת הישנה החדשה — יעודכנו ישירות ליעד (קיצור שרשרת) */
  retarget: string[];
}

/**
 * מתכנן שמירת כלל מול הכללים הקיימים: מקצר שרשראות ודוחה לולאות.
 * - היעד הוא בעצמו כתובת ישנה של כלל אחר → מפנים ישר ליעד הסופי.
 * - כללים קיימים שמפנים לכתובת הישנה → מעודכנים ליעד החדש.
 */
export function planRule(from: string, to: string, existing: ExistingRule[]): PlannedRule | { error: string } {
  const bySource = new Map(existing.filter((r) => r.fromPath !== from).map((r) => [r.fromPath, r.toPath]));
  let target = to;
  const seen = new Set([from]);
  for (let i = 0; i < 20; i++) {
    const path = target.split('?')[0]!;
    if (seen.has(path)) return { error: 'ההפניה יוצרת לולאה' };
    const next = bySource.get(path);
    if (!next) break;
    seen.add(path);
    target = next;
  }
  if (target.split('?')[0] === from) return { error: 'ההפניה יוצרת לולאה' };
  const retarget = existing.filter((r) => r.fromPath !== from && r.toPath.split('?')[0] === from).map((r) => r.fromPath);
  return { from, to: target, retarget };
}

export interface CsvParseResult {
  rows: Array<{ from: string; to: string; line: number }>;
  errors: Array<{ line: number; error: string }>;
}

/** CSV: עמודה ראשונה = כתובת ישנה, שנייה = יעד. שורת כותרת אופציונלית. מפריד פסיק/נקודה-פסיק/טאב. */
export function parseRedirectCsv(text: string): CsvParseResult {
  const out: CsvParseResult = { rows: [], errors: [] };
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const line = i + 1;
    if (!rawLine.trim()) return;
    const cells = rawLine.split(/[,;\t]/).map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
    if (i === 0 && !cells[0]?.includes('/') && !/^https?:/i.test(cells[0] ?? '')) return; // כותרת
    if (out.rows.length >= MAX_IMPORT_ROWS) {
      out.errors.push({ line, error: `מעבר למגבלה של ${MAX_IMPORT_ROWS} שורות` });
      return;
    }
    const check = checkRule(cells[0] ?? '', cells[1] ?? '');
    if (!check.ok) out.errors.push({ line, error: check.error });
    else out.rows.push({ from: check.from, to: check.to, line });
  });
  return out;
}
