/**
 * בדיקה אוטומטית של התוכן שבעל המשתלה מזין: מה שקוד הפלטפורמה לא יכול לתקן בשבילו.
 * לא נותנת ציון ולא קובעת עמידה בתקן. לפי הנציבות רק כשליש מהבדיקה אפשר לבצע בכלים אוטומטיים.
 */
import type { PrismaClient } from '@prisma/client';
import { getNurseryTheme } from '@/lib/theme';
import { parseAccessibilityInfo } from '@/lib/accessibility';

export type AuditLevel = 'fix' | 'review';

export interface AuditFinding {
  id: string;
  level: AuditLevel;
  title: string;
  detail: string;
  href?: string;
}

function channels(hex: string): number[] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance(hex: string): number {
  const [r, g, b] = channels(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** יחס ניגודיות לפי WCAG. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

export interface RichTextIssues {
  imagesWithoutAlt: number;
  emptyLinks: number;
  vagueLinks: number;
  documents: number;
  videos: number;
  skippedHeadings: boolean;
}

const VAGUE_LINK = /^(לחץ כאן|לחצו כאן|כאן|קרא עוד|קראו עוד|click here|here|read more)$/i;

/** תוכן עשיר נבדק כטקסט: התוכן עובר ניקוי בשמירה, אז הצורה שלו צפויה. */
export function auditRichHtml(html: string): RichTextIssues {
  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const imagesWithoutAlt = imgs.filter((tag) => !/\balt\s*=\s*("[^"]+"|'[^']+')/i.test(tag)).length;
  let emptyLinks = 0;
  let vagueLinks = 0;
  let documents = 0;
  for (const [, attrs, inner] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const label = inner!.replace(/<[^>]+>/g, '').trim();
    if (!label && !/<img\b[^>]*\balt\s*=\s*("[^"]+"|'[^']+')/i.test(inner!)) emptyLinks++;
    else if (VAGUE_LINK.test(label)) vagueLinks++;
    if (/href\s*=\s*["'][^"']+\.(pdf|docx?|xlsx?|pptx?)(\?[^"']*)?["']/i.test(attrs!)) documents++;
  }
  const videos = (html.match(/<(video|iframe)\b/gi) ?? []).length;
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  const skippedHeadings = levels.some((level, i) => i > 0 && level - levels[i - 1]! > 1);
  return { imagesWithoutAlt, emptyLinks, vagueLinks, documents, videos, skippedHeadings };
}

/** בדיקת הצבעים שנבחרו. הצבע הראשי מוכהה אוטומטית בחנות, ולכן נבדק כאן הרקע. */
export function auditThemeColors(colors: { primary: string; accent: string; background: string }): AuditFinding[] {
  const out: AuditFinding[] = [];
  if (contrastRatio('#374151', colors.background) < 4.5) {
    out.push({
      id: 'theme-background',
      level: 'fix',
      title: 'רקע החנות כהה מדי',
      detail: `הטקסט הרגיל של החנות לא בולט מספיק על הרקע שנבחר (${colors.background}). נדרשת ניגודיות של 4.5:1 לפחות.`,
      href: '/admin/settings',
    });
  }
  return out;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

interface ContentItem {
  title: string;
  html: string;
  href: string;
}

function contentFindings(items: ContentItem[]): AuditFinding[] {
  const out: AuditFinding[] = [];
  const add = (id: string, level: AuditLevel, title: string, detail: string, hit: ContentItem[]) => {
    if (hit.length === 0) return;
    const names = hit.slice(0, 5).map((i) => i.title).join(', ');
    out.push({ id, level, title, detail: `${detail} (${names}${hit.length > 5 ? ` ועוד ${hit.length - 5}` : ''})`, href: hit[0]!.href });
  };
  const audited = items.map((item) => ({ item, issues: auditRichHtml(item.html) }));
  const where = (test: (i: RichTextIssues) => boolean) => audited.filter((a) => test(a.issues)).map((a) => a.item);
  add('content-alt', 'fix', 'תמונות בלי תיאור בעמודים', 'קורא מסך לא יכול לתאר תמונה בלי טקסט חלופי. תמונה לקישוט בלבד אפשר להשאיר בלי תיאור.', where((i) => i.imagesWithoutAlt > 0));
  add('content-empty-links', 'fix', 'קישורים בלי טקסט', 'קישור חייב טקסט שמסביר לאן הוא מוביל.', where((i) => i.emptyLinks > 0));
  add('content-vague-links', 'review', 'קישורים כמו "לחצו כאן"', 'עדיף לכתוב לאן הקישור מוביל, כי בקורא מסך שומעים לפעמים רק את הקישורים.', where((i) => i.vagueLinks > 0));
  add('content-headings', 'review', 'דילוג ברמות הכותרות', 'כותרות צריכות לרדת ברמה אחת בכל פעם, למשל מכותרת 2 לכותרת 3.', where((i) => i.skippedHeadings));
  add('content-documents', 'review', 'מסמכים שצריך להנגיש בנפרד', 'קובץ PDF או Word שעלה לאתר חייב להיות נגיש בעצמו. המערכת לא בודקת את תוכן הקובץ.', where((i) => i.documents > 0));
  add('content-videos', 'review', 'סרטונים בעמודים', 'סרטון שנושא מידע צריך כתוביות או חלופה בכתב. עסק במחזור מעל 5 מיליון ש"ח חייב בכתוביות.', where((i) => i.videos > 0));
  return out;
}

export async function runAccessibilityAudit(db: PrismaClient, nurseryId: string): Promise<AuditFinding[]> {
  const nursery = await db.nursery.findUniqueOrThrow({ where: { id: nurseryId } });
  const info = parseAccessibilityInfo(nursery.accessibilityInfo);
  const findings: AuditFinding[] = [];

  if (!nursery.phoneNumber && !nursery.contactEmail) {
    findings.push({
      id: 'statement-contact',
      level: 'fix',
      title: 'אין פרטי קשר בהצהרה',
      detail: 'ההצהרה חייבת לכלול דרך לפנות בנושא נגישות. מומלץ להוסיף טלפון ואימייל בהגדרות המשתלה.',
      href: '/admin/settings',
    });
  }
  if (!info.coordinatorName) {
    findings.push({
      id: 'statement-coordinator',
      level: 'review',
      title: 'לא הוזן רכז נגישות',
      detail: 'מי שחייב במינוי רכז נגישות (לפי החוק, עסק עם 25 עובדים ומעלה) חייב לפרסם את פרטיו בהצהרה.',
    });
  }
  if (!info.physicalArrangements) {
    findings.push({
      id: 'statement-physical',
      level: 'review',
      title: 'לא תוארו הסדרי הנגישות במשתלה עצמה',
      detail: 'כדאי לתאר חניה, גישה לכיסא גלגלים ועזרה בנשיאה, אם יש.',
    });
  }
  if (!info.auditedAt) {
    findings.push({
      id: 'statement-audit',
      level: 'review',
      title: 'עדיין לא נעשתה בדיקה ידנית',
      detail: 'הבדיקה כאן אוטומטית וחלקית. בדיקה בידי מומחה נגישות, כולל קורא מסך, היא הדרך לדעת שהאתר באמת עומד בתקן.',
    });
  }

  findings.push(...auditThemeColors(getNurseryTheme(nursery).colors));

  const [pages, posts] = await Promise.all([
    db.staticPage.findMany({ where: { nurseryId }, select: { id: true, title: true, contentHtml: true } }),
    db.blogPost.findMany({ where: { nurseryId }, select: { id: true, title: true, contentHtml: true } }),
  ]);
  findings.push(
    ...contentFindings([
      ...pages.map((p) => ({ title: p.title, html: p.contentHtml, href: `/admin/pages/${p.id}` })),
      ...posts.map((p) => ({ title: p.title, html: p.contentHtml, href: `/admin/blog/${p.id}` })),
    ]),
  );

  const overdue = await db.accessibilityReport.count({ where: { nurseryId, status: { not: 'RESOLVED' }, dueAt: { lt: new Date() } } });
  if (overdue > 0) {
    findings.push({
      id: 'reports-overdue',
      level: 'fix',
      title: plural(overdue, 'פנייה אחת עברה', 'פניות עברו') + ' את מועד הטיפול',
      detail: 'לפי התקנות יש לתקן בתוך 60 ימים מיום ההודעה.',
    });
  }
  return findings.sort((a, b) => (a.level === b.level ? 0 : a.level === 'fix' ? -1 : 1));
}
