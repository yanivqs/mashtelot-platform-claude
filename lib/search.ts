/**
 * חיפוש חכם בעברית לקטלוג החנות (R04-03). טהור — ללא Prisma/Next, בר-בדיקה.
 *
 * - נרמול: ניקוד, אותיות סופיות, גרשיים/מרכאות, מקפים וסימני פיסוק, אותיות קטנות.
 * - תחיליות: ו/ה/ב/ל/מ/ש/כ (עד שתיים, למשל "והורדים") — רק כשנשאר שורש של 3 אותיות לפחות.
 * - ריבוי: ים/ות — "ורדים" ↔ "ורד".
 * - שגיאות כתיב: מרחק Damerau-Levenshtein — טעות אחת במילה של 4+ אותיות, שתיים ב-8+.
 * - מילים נרדפות: מילון גלובלי (טבלת search_synonyms) — כל מילה בקבוצה מרחיבה לשאר.
 * - כל מילות השאילתה חייבות להימצא (AND); דירוג: מדויק > תחילת מילה > מכיל > שגיאת כתיב.
 */

const NIQQUD = /[֑-ׇ]/g;
const FINALS: Record<string, string> = { ך: 'כ', ם: 'מ', ן: 'נ', ף: 'פ', ץ: 'צ' };
const PREFIX_LETTERS = new Set(['ו', 'ה', 'ב', 'ל', 'מ', 'ש', 'כ']);
const MIN_STEM = 3;

/** נרמול טקסט לחיפוש. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(NIQQUD, '')
    .replace(/[ךםןףץ]/g, (c) => FINALS[c]!)
    .replace(/["'`׳״‘’“”]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokenize(s: string): string[] {
  const n = normalizeText(s);
  return n ? n.split(' ') : [];
}

const isHebrew = (t: string) => /[א-ת]/.test(t);

/** צורות בסיס של מילה עברית: בלי תחיליות ובלי סיומת ריבוי. כולל את המילה עצמה. */
export function wordForms(token: string): string[] {
  const forms = new Set([token]);
  if (!isHebrew(token)) return [...forms];
  // תחיליות (עד שתיים)
  let t = token;
  for (let i = 0; i < 2 && t.length - 1 >= MIN_STEM && PREFIX_LETTERS.has(t[0]!); i++) {
    t = t.slice(1);
    forms.add(t);
  }
  // ריבוי
  for (const f of [...forms]) {
    if (f.length - 2 >= MIN_STEM - 1 && (f.endsWith('ימ') || f.endsWith('ות'))) forms.add(f.slice(0, -2));
  }
  return [...forms];
}

/** מרחק Damerau-Levenshtein (עם חילוף אותיות סמוכות), עם עצירה מוקדמת מעל `max`. */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const m = a.length;
  const n = b.length;
  let prev2: number[] = [];
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2]! + 1);
      cur.push(v);
      rowMin = Math.min(rowMin, v);
    }
    if (rowMin > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[n]!;
}

/** כמה שגיאות מותרות למילה באורך נתון. */
export function allowedTypos(len: number): number {
  if (len >= 8) return 2;
  if (len >= 4) return 1;
  return 0;
}

// ---------- מילון נרדפות ----------

/** מילה/ביטוי מנורמל → כל הביטויים המנורמלים בקבוצה. */
export type SynonymIndex = Map<string, string[]>;

export function buildSynonymIndex(groups: string[][]): SynonymIndex {
  const index: SynonymIndex = new Map();
  for (const group of groups) {
    const terms = [...new Set(group.map(normalizeText).filter(Boolean))];
    if (terms.length < 2) continue;
    for (const t of terms) {
      const existing = index.get(t) ?? [];
      index.set(t, [...new Set([...existing, ...terms])]);
    }
  }
  return index;
}

/** פירוק קלט ניהול ("א, ב, ג") לקבוצת מונחים. */
export function parseSynonymGroup(raw: string): string[] {
  return [...new Set(raw.split(/[,\n،;]+/).map((s) => s.trim()).filter(Boolean))];
}

// ---------- שאילתה ----------

interface QueryTerm {
  /** המילה כפי שהוקלדה (מנורמלת) — היחידה שנבדקת לשגיאות כתיב */
  original: string;
  /** התאמה מדויקת: צורות בסיס של המילה ושל הנרדפות שלה */
  exact: string[];
  /** התאמת תחילת מילה / הכלה: המילה המקורית והנרדפות — בלי צורות מקוצרות, כדי ש"שמיר"→"מיר" לא יתאים ל"מירטוס" */
  prefixes: string[];
}

export interface CompiledQuery {
  raw: string;
  terms: QueryTerm[];
  /** ביטויים נרדפים לשאילתה כולה (למשל "צמחי בית" → "צמחי פנים") */
  phrases: string[];
}

export function compileQuery(q: string | undefined | null, synonyms: SynonymIndex = new Map()): CompiledQuery | null {
  const raw = normalizeText(q ?? '');
  if (!raw) return null;
  const tokens = raw.split(' ');
  const terms = tokens.map((tok) => {
    const exact = new Set<string>();
    const prefixes = new Set<string>([tok]);
    for (const f of wordForms(tok)) {
      exact.add(f);
      for (const syn of synonyms.get(f) ?? []) {
        if (syn.includes(' ')) continue;
        prefixes.add(syn);
        for (const sf of wordForms(syn)) exact.add(sf);
      }
    }
    return { original: tok, exact: [...exact], prefixes: [...prefixes] };
  });
  const phrases = (synonyms.get(raw) ?? []).filter((p) => p !== raw);
  return { raw, terms, phrases };
}

/** מבנה מסמך מוכן לחיפוש (נבנה פעם אחת לכל מוצר באינדקס). */
export interface SearchDoc {
  text: string;
  /** המילים כפי שהן (מנורמלות) */
  tokens: string[];
  /** כל צורות הבסיס של כל המילים במסמך */
  forms: string[];
}

export function buildSearchDoc(parts: Array<string | null | undefined>): SearchDoc {
  const text = normalizeText(parts.filter(Boolean).join(' '));
  const tokens = text ? text.split(' ') : [];
  const forms = new Set<string>();
  for (const tok of tokens) for (const f of wordForms(tok)) forms.add(f);
  return { text, tokens, forms: [...forms] };
}

function termScore(term: QueryTerm, doc: SearchDoc): number {
  const forms = new Set(doc.forms);
  if (term.exact.some((e) => forms.has(e))) return 4;
  for (const p of term.prefixes) {
    if (p.length >= 2 && (doc.tokens.some((t) => t.startsWith(p)) || doc.forms.some((f) => f.startsWith(p)))) return 3;
  }
  for (const p of term.prefixes) if (p.length >= 3 && doc.text.includes(p)) return 2;
  // שגיאות כתיב — רק על המילה שהוקלדה (לא על נרדפות, כדי לא להתרחב מדי)
  const k = allowedTypos(term.original.length);
  if (k === 0) return 0;
  for (const f of doc.forms) {
    if (editDistance(term.original, f, k) <= k) return 1;
    // שגיאה בתחילת מילה ארוכה יותר ("לבנדר" מול "לבנדרים")
    if (f.length > term.original.length && editDistance(term.original, f.slice(0, term.original.length), k) <= k) return 1;
  }
  return 0;
}

/** ציון התאמה (0 = לא מתאים). כל מילות השאילתה חייבות להתאים, או ביטוי נרדף לשאילתה כולה. */
export function scoreDoc(query: CompiledQuery, doc: SearchDoc): number {
  let total = 0;
  let allMatch = true;
  for (const term of query.terms) {
    const s = termScore(term, doc);
    if (s === 0) {
      allMatch = false;
      break;
    }
    total += s;
  }
  if (allMatch) return total + (doc.text.includes(query.raw) ? 2 : 0);
  for (const p of query.phrases) if (doc.text.includes(p)) return 3;
  return 0;
}
