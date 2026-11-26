/**
 * שלט צמח: טקסט התיאור.
 * סדר עדיפויות: הטקסט שנשמר בשלט ← התיאור שהמשתלה כתבה למוצר ← הרכבה אוטומטית מנתוני הצמח.
 * ללא תלות בשרת.
 */

export interface SignPlantFields {
  description?: string | null;
  plantType?: string | null;
  uniqueness?: string | null;
  floweringSeason?: string | null;
  flowerColor?: string | null;
  flowering?: string | null;
  height?: string | null;
  evergreen?: string | null;
  coastal?: string | null;
  native?: string | null;
  growthRate?: string | null;
  care?: string | null;
}

/** יעד האורך: עד 4 שורות קריאות בתיבת התיאור */
export const DESCRIPTION_TARGET = 210;
/** תקרה לטקסט שהמשתלה כתבה (הגופן מוקטן אוטומטית עד גבול הקריאות) */
export const DESCRIPTION_MAX = 320;

/** סוג הצמח בקטלוג (ברבים) → צירוף ביחיד לפתיחת התיאור */
const TYPE_PHRASES: Record<string, string> = {
  'רב-שנתיים עשבוניים': 'צמח רב-שנתי עשבוני',
  שיחים: 'שיח',
  'עונתיים של חורף': 'צמח עונתי לחורף',
  מטפסים: 'צמח מטפס',
  עצים: 'עץ',
  'צמחי תבלין וריח': 'צמח תבלין וריח',
  'עונתיים של קיץ': 'צמח עונתי לקיץ',
  'דגניים ודומיהם': 'דגני נוי',
  'רב-שנתיים בשרניים-משתרעים': 'צמח בשרני משתרע',
  'רב-שנתיים בשרניים': 'צמח בשרני רב-שנתי',
  'בן-שיח': 'בן-שיח',
  גאופיט: 'צמח פקעת (גאופיט)',
  'צמח בית': 'צמח בית',
  סחלב: 'סחלב',
};

export function typePhrase(plantType: string | null | undefined): string | null {
  const v = (plantType ?? '').trim();
  if (!v) return null;
  return TYPE_PHRASES[v] ?? v;
}

/** רווחים מיותרים, ו"עונתי- חורפי" → "עונתי-חורפי" */
const clean = (v: string | null | undefined) =>
  (v ?? '')
    .replace(/\s+/g, ' ')
    .replace(/([֐-׿])-\s+(?=[֐-׿])/g, '$1-')
    .trim();

/** רשימה בעברית: "א, ב וג" */
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ו${items[items.length - 1]}`;
}

/** "פריחה שופעת, פריחה בולטת, מושך פרפרים, מושך צופיות" → "פריחה שופעת, בולטת וממושכת, מושך פרפרים וצופיות" */
export function mergeTraits(text: string): string {
  const items = clean(text)
    .split(/\s*,\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
  const groups: Array<{ head: string; rests: string[]; whole: string[] }> = [];
  for (const it of items) {
    const [head, ...rest] = it.split(' ');
    const last = groups[groups.length - 1];
    if (last && rest.length && last.head === head && last.rests.length) {
      last.rests.push(rest.join(' '));
      continue;
    }
    groups.push({ head: head!, rests: rest.length ? [rest.join(' ')] : [], whole: [it] });
  }
  return groups.map((g) => (g.rests.length > 1 ? `${g.head} ${joinList(g.rests)}` : g.whole[0]!)).join(', ');
}

/** משפט: אות פתיחה, בלי פסיק בסוף, עם נקודה. */
function sentence(v: string): string {
  const s = v.replace(/[\s,;:.]+$/, '').trim();
  return s ? `${s}.` : '';
}

/** "מ- 50 ס"מ עד 1 מטר" → "מ-50 ס"מ עד 1 מטר" */
function cleanHeight(v: string): string {
  return v.replace(/מ-\s+/g, 'מ-').replace(/\s+/g, ' ').trim();
}

function seasonPhrase(v: string): string {
  if (/רוב השנה|כל השנה/.test(v)) return 'לאורך רוב השנה';
  return v.startsWith('ב') ? v : `ב${v}`;
}

/** הרכבת פסקה קריאה מנתוני הצמח, עד יעד האורך (משפטים שלמים בלבד). */
export function composeSignDescription(p: SignPlantFields, target = DESCRIPTION_TARGET): string {
  const parts: string[] = [];

  // פתיחה: התיאור הקצר מהקטלוג, או סוג הצמח; ובהמשך הגובה
  const desc = clean(p.description);
  const opening = desc.length >= 4 ? desc : typePhrase(p.plantType);
  const height = clean(p.height);
  if (opening && height) parts.push(sentence(`${opening}, בגובה ${cleanHeight(height)}`));
  else if (opening) parts.push(sentence(opening));
  else if (height) parts.push(sentence(`גובה ${cleanHeight(height)}`));

  const uniq = clean(p.uniqueness);
  if (uniq) parts.push(sentence(mergeTraits(uniq)));

  // פריחה: עונה וצבע (צבע "לא משמעותי" — לא מוזכר)
  const color = clean(p.flowerColor);
  const season = clean(p.floweringSeason);
  const flowering = clean(p.flowering);
  const colorOk = color && !/לא משמעותי/.test(color);
  if (!/לא משמעותית/.test(flowering)) {
    const hue = color === 'שלל צבעים' ? 'בשלל צבעים' : /,| ו/.test(color) ? `בגוונים ${color}` : `בגוון ${color}`;
    if (season && colorOk) parts.push(sentence(`פריחה ${seasonPhrase(season)}, ${hue}`));
    else if (season) parts.push(sentence(`פריחה ${seasonPhrase(season)}`));
    else if (colorOk) parts.push(sentence(`פריחה ${hue}`));
  }

  const ever = clean(p.evergreen);
  if (ever === 'ירוק-עד') parts.push('עלווה ירוקה כל השנה.');
  else if (ever === 'נשיר') parts.push('עלווה נשירה בחורף.');

  if (clean(p.native) === 'כן') parts.push('צמח בר ישראלי.');
  const coastal = clean(p.coastal);
  if (coastal) parts.push(sentence(coastal));

  const growth = clean(p.growthRate);
  if (growth && growth.length <= 20) parts.push(sentence(`קצב צמיחה ${growth}`));

  const care = clean(p.care);
  if (care) parts.push(sentence(care.split(/[.;]/)[0]!));

  let out = '';
  for (const s of parts) {
    if (!s) continue;
    const next = out ? `${out} ${s}` : s;
    if (next.length > target) {
      if (!out) out = truncate(s, target);
      continue;
    }
    out = next;
  }
  return out;
}

/** קיצור במשפט שלם (או במילה, עם שלוש נקודות) עד אורך נתון. */
export function truncate(text: string, max: number): string {
  const t = clean(text);
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > max * 0.4) return cut.slice(0, lastStop + 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).replace(/[\s,;:.]+$/, '')}…`;
}

/** תיאור מותאם של המוצר (HTML מעורך העשיר) → טקסט רציף */
export function plainText(html: string | null | undefined): string {
  return clean(
    (html ?? '')
      .replace(/<\s*(br|\/p|\/div|\/li|\/h\d)\s*\/?>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&'),
  );
}

/** התיאור שיוצג בשלט */
export function signDescription(args: { saved?: string | null; productDescription?: string | null; plant: SignPlantFields }): string {
  const saved = clean(args.saved);
  if (saved) return truncate(saved, DESCRIPTION_MAX);
  const own = plainText(args.productDescription);
  if (own.length >= 20) return truncate(own, DESCRIPTION_MAX);
  return composeSignDescription(args.plant);
}
