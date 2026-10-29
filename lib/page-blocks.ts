/**
 * R03 Page Builder — הבלוקים המאושרים, ערכי ברירת מחדל ו-ולידציה.
 * ללא תלות בשרת — בטוח לייבוא גם בעורך (רכיב לקוח). ניקוי ה-HTML של בלוקי טקסט נעשה בשרת בשמירה.
 * R03-08: אין HTML חופשי ואין סקריפטים — רק השדות שמוגדרים כאן נשמרים; כל שדה אחר נזרק.
 */

export const BLOCK_TYPES = ['hero', 'text', 'imageText', 'products', 'categories', 'contentCards', 'cta', 'faq', 'contact', 'spacer'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: 'כותרת ראשית (Hero)',
  text: 'טקסט',
  imageText: 'תמונה וטקסט',
  products: 'מוצרים',
  categories: 'קטגוריות',
  contentCards: 'דפי תוכן (כרטיסים)',
  cta: 'באנר קריאה לפעולה',
  faq: 'שאלות נפוצות',
  contact: 'שעות פתיחה ויצירת קשר',
  spacer: 'מרווח',
};

export const MAX_BLOCKS = 30;
export const MAX_SLIDES = 8;
export const MAX_FAQ = 20;
export const MAX_PRODUCTS = 24;
export const MAX_CATEGORIES = 12;
export const MAX_CARDS = 12;
const MAX_TEXT = 300;
const MAX_HTML = 20_000;

interface BlockBase {
  id: string;
  hideOnMobile: boolean;
  hideOnDesktop: boolean;
}

export interface Slide {
  imageUrl: string;
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
}

export type HeroVariant = 'plain' | 'image' | 'carousel' | 'video';
/** mixed — מגוון: מוצרים מקטגוריות שונות לסירוגין */
export type ProductSource = 'manual' | 'newest' | 'sale' | 'category' | 'mixed';

/** כרטיס תוכן: תמונה, כותרת, תיאור וקישור לדף באתר */
export interface ContentCard {
  imageUrl: string;
  title: string;
  text: string;
  href: string;
}

export type Block =
  | (BlockBase & { type: 'hero'; variant: HeroVariant; headline: string; subheadline: string; imageUrl: string; videoUrl: string; slides: Slide[]; ctaText: string; ctaHref: string })
  | (BlockBase & { type: 'text'; html: string; align: 'right' | 'center' })
  | (BlockBase & { type: 'imageText'; imageUrl: string; title: string; html: string; imageSide: 'right' | 'left'; ctaText: string; ctaHref: string })
  | (BlockBase & { type: 'products'; title: string; source: ProductSource; productIds: string[]; categoryId: string; limit: number; showCategory: boolean })
  | (BlockBase & { type: 'categories'; title: string; categoryIds: string[] })
  | (BlockBase & { type: 'contentCards'; title: string; source: 'manual' | 'blog'; cards: ContentCard[]; limit: number })
  | (BlockBase & { type: 'cta'; title: string; text: string; ctaText: string; ctaHref: string; tone: 'brand' | 'light' })
  | (BlockBase & { type: 'faq'; title: string; items: Array<{ q: string; a: string }> })
  | (BlockBase & { type: 'contact'; title: string; showHours: boolean; showPhone: boolean; showAddress: boolean })
  | (BlockBase & { type: 'spacer'; size: 'sm' | 'md' | 'lg' });

export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** בלוק חדש עם ערכי ברירת מחדל (בעורך). */
export function newBlock(type: BlockType): Block {
  const base = { id: newId(), hideOnMobile: false, hideOnDesktop: false };
  switch (type) {
    case 'hero':
      return { ...base, type, variant: 'plain', headline: '', subheadline: '', imageUrl: '', videoUrl: '', slides: [], ctaText: 'לכל הקטלוג', ctaHref: '/catalog' };
    case 'text':
      return { ...base, type, html: '', align: 'right' };
    case 'imageText':
      return { ...base, type, imageUrl: '', title: '', html: '', imageSide: 'right', ctaText: '', ctaHref: '' };
    case 'products':
      return { ...base, type, title: 'מוצרים נבחרים', source: 'newest', productIds: [], categoryId: '', limit: 8, showCategory: false };
    case 'categories':
      return { ...base, type, title: 'קטגוריות', categoryIds: [] };
    case 'contentCards':
      return { ...base, type, title: 'מדריכים וטיפים', source: 'blog', cards: [], limit: 3 };
    case 'cta':
      return { ...base, type, title: '', text: '', ctaText: 'לקטלוג', ctaHref: '/catalog', tone: 'brand' };
    case 'faq':
      return { ...base, type, title: 'שאלות נפוצות', items: [] };
    case 'contact':
      return { ...base, type, title: 'שעות פתיחה ויצירת קשר', showHours: true, showPhone: true, showAddress: true };
    case 'spacer':
      return { ...base, type, size: 'md' };
  }
}

/** קישור מותר: נתיב באתר (/...), https, tel: או mailto:. ריק = אין קישור. */
export function isSafeHref(href: string): boolean {
  if (!href) return true;
  if (/^\/(?!\/)/.test(href)) return !/[\s\\]/.test(href);
  return /^(https:\/\/[^\s]+|tel:[+\d\-\s]+|mailto:[^\s@]+@[^\s@]+)$/i.test(href);
}

/** כתובת תמונה מותרת: https או נתיב באתר. */
export function isSafeImageUrl(url: string): boolean {
  return !url || /^https:\/\/[^\s"'<>]+$/i.test(url) || /^\/(?!\/)[^\s"'<>]*$/.test(url);
}

/** מזהה סרטון YouTube מתוך קישור (watch / youtu.be / embed / shorts), או null. */
export function youtubeId(url: string): string | null {
  const m = url.trim().match(/^https:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#].*)?$/);
  return m ? m[1]! : null;
}

type Raw = Record<string, unknown>;

class BlockError extends Error {}

function str(o: Raw, key: string, label: string, max = MAX_TEXT): string {
  const v = o[key];
  if (v === undefined || v === null) return '';
  if (typeof v !== 'string') throw new BlockError(`${label}: ערך לא תקין`);
  const t = v.trim();
  if (t.length > max) throw new BlockError(`${label}: ארוך מדי (עד ${max} תווים)`);
  return t;
}

function bool(o: Raw, key: string, fallback = false): boolean {
  return typeof o[key] === 'boolean' ? (o[key] as boolean) : fallback;
}

function oneOf<T extends string>(o: Raw, key: string, allowed: readonly T[], fallback: T): T {
  const v = o[key];
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

function href(o: Raw, key: string, label: string): string {
  const v = str(o, key, label, 500);
  if (!isSafeHref(v)) throw new BlockError(`${label}: קישור חייב להיות נתיב באתר (/...) או כתובת https`);
  return v;
}

function image(o: Raw, key: string, label: string): string {
  const v = str(o, key, label, 1000);
  if (!isSafeImageUrl(v)) throw new BlockError(`${label}: כתובת תמונה לא תקינה`);
  return v;
}

function ids(o: Raw, key: string, label: string, max: number): string[] {
  const v = o[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !/^[A-Za-z0-9-]{1,64}$/.test(x))) {
    throw new BlockError(`${label}: רשימה לא תקינה`);
  }
  const unique = Array.from(new Set(v as string[]));
  if (unique.length > max) throw new BlockError(`${label}: עד ${max} פריטים`);
  return unique;
}

function list(o: Raw, key: string): Raw[] {
  const v = o[key];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => !x || typeof x !== 'object')) throw new BlockError('רשימה לא תקינה');
  return v as Raw[];
}

function parseBlock(o: Raw): Block {
  const type = o.type;
  if (typeof type !== 'string' || !(BLOCK_TYPES as readonly string[]).includes(type)) throw new BlockError('סוג בלוק לא מוכר');
  const id = typeof o.id === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(o.id) ? o.id : newId();
  const base = { id, hideOnMobile: bool(o, 'hideOnMobile'), hideOnDesktop: bool(o, 'hideOnDesktop') };

  switch (type as BlockType) {
    case 'hero': {
      const variant = oneOf(o, 'variant', ['plain', 'image', 'carousel', 'video'] as const, 'plain');
      const slidesRaw = list(o, 'slides');
      if (slidesRaw.length > MAX_SLIDES) throw new BlockError(`קרוסלה: עד ${MAX_SLIDES} תמונות`);
      const slides = slidesRaw.map((s, i) => ({
        imageUrl: image(s, 'imageUrl', `שקופית ${i + 1}`),
        headline: str(s, 'headline', `שקופית ${i + 1}`),
        subheadline: str(s, 'subheadline', `שקופית ${i + 1}`),
        ctaText: str(s, 'ctaText', `שקופית ${i + 1}`, 60),
        ctaHref: href(s, 'ctaHref', `שקופית ${i + 1}`),
      }));
      const videoUrl = str(o, 'videoUrl', 'וידאו', 500);
      if (videoUrl && !youtubeId(videoUrl)) throw new BlockError('וידאו: יש להדביק קישור YouTube');
      if (variant === 'image' && !o.imageUrl) throw new BlockError('כותרת ראשית: חסרה תמונה');
      if (variant === 'carousel' && slides.filter((s) => s.imageUrl).length === 0) throw new BlockError('קרוסלה: יש להוסיף לפחות תמונה אחת');
      if (variant === 'video' && !videoUrl) throw new BlockError('וידאו: יש להדביק קישור YouTube');
      return {
        ...base,
        type: 'hero',
        variant,
        headline: str(o, 'headline', 'כותרת'),
        subheadline: str(o, 'subheadline', 'כותרת משנה'),
        imageUrl: image(o, 'imageUrl', 'תמונה'),
        videoUrl,
        slides,
        ctaText: str(o, 'ctaText', 'טקסט כפתור', 60),
        ctaHref: href(o, 'ctaHref', 'קישור כפתור'),
      };
    }
    case 'text':
      return { ...base, type: 'text', html: str(o, 'html', 'טקסט', MAX_HTML), align: oneOf(o, 'align', ['right', 'center'] as const, 'right') };
    case 'imageText':
      return {
        ...base,
        type: 'imageText',
        imageUrl: image(o, 'imageUrl', 'תמונה'),
        title: str(o, 'title', 'כותרת'),
        html: str(o, 'html', 'טקסט', MAX_HTML),
        imageSide: oneOf(o, 'imageSide', ['right', 'left'] as const, 'right'),
        ctaText: str(o, 'ctaText', 'טקסט כפתור', 60),
        ctaHref: href(o, 'ctaHref', 'קישור כפתור'),
      };
    case 'products': {
      const source = oneOf(o, 'source', ['manual', 'newest', 'sale', 'category', 'mixed'] as const, 'newest');
      const productIds = ids(o, 'productIds', 'מוצרים', MAX_PRODUCTS);
      const categoryId = str(o, 'categoryId', 'קטגוריה', 64);
      if (source === 'manual' && productIds.length === 0) throw new BlockError('מוצרים: יש לבחור לפחות מוצר אחד');
      if (source === 'category' && !categoryId) throw new BlockError('מוצרים: יש לבחור קטגוריה');
      const limit = Number(o.limit);
      return {
        ...base,
        type: 'products',
        title: str(o, 'title', 'כותרת'),
        source,
        productIds: source === 'manual' ? productIds : [],
        categoryId: source === 'category' ? categoryId : '',
        limit: Number.isInteger(limit) && limit >= 1 && limit <= MAX_PRODUCTS ? limit : 8,
        showCategory: bool(o, 'showCategory', source === 'mixed'),
      };
    }
    case 'categories':
      return { ...base, type: 'categories', title: str(o, 'title', 'כותרת'), categoryIds: ids(o, 'categoryIds', 'קטגוריות', MAX_CATEGORIES) };
    case 'contentCards': {
      const source = oneOf(o, 'source', ['manual', 'blog'] as const, 'blog');
      const raw = list(o, 'cards');
      if (raw.length > MAX_CARDS) throw new BlockError(`דפי תוכן: עד ${MAX_CARDS} כרטיסים`);
      const cards = raw
        .map((c, i) => ({
          imageUrl: image(c, 'imageUrl', `כרטיס ${i + 1}`),
          title: str(c, 'title', `כרטיס ${i + 1}`, 120),
          text: str(c, 'text', `כרטיס ${i + 1}`, 400),
          href: href(c, 'href', `כרטיס ${i + 1}`),
        }))
        .filter((c) => c.title || c.text || c.imageUrl);
      if (source === 'manual' && cards.length === 0) throw new BlockError('דפי תוכן: יש להוסיף לפחות כרטיס אחד');
      if (cards.some((c) => !c.title)) throw new BlockError('דפי תוכן: לכל כרטיס צריכה להיות כותרת');
      const limit = Number(o.limit);
      return {
        ...base,
        type: 'contentCards',
        title: str(o, 'title', 'כותרת'),
        source,
        cards: source === 'manual' ? cards : [],
        limit: Number.isInteger(limit) && limit >= 1 && limit <= MAX_CARDS ? limit : 3,
      };
    }
    case 'cta': {
      const title = str(o, 'title', 'כותרת');
      if (!title) throw new BlockError('באנר: חסרה כותרת');
      return {
        ...base,
        type: 'cta',
        title,
        text: str(o, 'text', 'טקסט', 600),
        ctaText: str(o, 'ctaText', 'טקסט כפתור', 60),
        ctaHref: href(o, 'ctaHref', 'קישור כפתור'),
        tone: oneOf(o, 'tone', ['brand', 'light'] as const, 'brand'),
      };
    }
    case 'faq': {
      const raw = list(o, 'items');
      if (raw.length > MAX_FAQ) throw new BlockError(`שאלות נפוצות: עד ${MAX_FAQ} שאלות`);
      const items = raw
        .map((it, i) => ({ q: str(it, 'q', `שאלה ${i + 1}`), a: str(it, 'a', `תשובה ${i + 1}`, 2000) }))
        .filter((it) => it.q || it.a);
      if (items.some((it) => !it.q || !it.a)) throw new BlockError('שאלות נפוצות: לכל שאלה צריכה להיות תשובה');
      return { ...base, type: 'faq', title: str(o, 'title', 'כותרת'), items };
    }
    case 'contact':
      return {
        ...base,
        type: 'contact',
        title: str(o, 'title', 'כותרת'),
        showHours: bool(o, 'showHours', true),
        showPhone: bool(o, 'showPhone', true),
        showAddress: bool(o, 'showAddress', true),
      };
    case 'spacer':
      return { ...base, type: 'spacer', size: oneOf(o, 'size', ['sm', 'md', 'lg'] as const, 'md') };
  }
}

export type ParseResult = { ok: true; value: Block[] } | { ok: false; error: string };

/** ולידציה מלאה של רשימת בלוקים (קלט מהעורך או JSON מהמסד). */
export function parseBlocks(json: unknown): ParseResult {
  if (!Array.isArray(json)) return { ok: false, error: 'מבנה הדף לא תקין' };
  if (json.length > MAX_BLOCKS) return { ok: false, error: `עד ${MAX_BLOCKS} בלוקים בדף` };
  const out: Block[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < json.length; i++) {
    const raw = json[i];
    if (!raw || typeof raw !== 'object') return { ok: false, error: `בלוק ${i + 1}: לא תקין` };
    try {
      const b = parseBlock(raw as Raw);
      if (seen.has(b.id)) b.id = newId();
      seen.add(b.id);
      out.push(b);
    } catch (e) {
      if (e instanceof BlockError) return { ok: false, error: `בלוק ${i + 1} (${BLOCK_LABELS[(raw as Raw).type as BlockType] ?? '?'}): ${e.message}` };
      throw e;
    }
  }
  return { ok: true, value: out };
}

/** לרינדור: בלוקים שמורים במסד — בלוק פגום מושמט (לא מפיל את הדף). */
export function readStoredBlocks(json: unknown): Block[] {
  if (!Array.isArray(json)) return [];
  const out: Block[] = [];
  for (const raw of json.slice(0, MAX_BLOCKS)) {
    const r = parseBlocks([raw]);
    if (r.ok) out.push(r.value[0]!);
  }
  return out;
}

export interface VersionLike {
  version: number;
  publishAt: Date;
}

/** R03-07: הגרסה החיה = מספר הגרסה הגבוה ביותר שזמן הפרסום שלה הגיע. */
export function pickLiveVersion<T extends VersionLike>(versions: readonly T[], now: Date): T | null {
  let best: T | null = null;
  for (const v of versions) {
    if (v.publishAt.getTime() <= now.getTime() && (!best || v.version > best.version)) best = v;
  }
  return best;
}
