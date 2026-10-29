import type { Nursery } from '@prisma/client';

export type HeroLayout = 'centered' | 'split' | 'image' | 'carousel';

export const HERO_LAYOUTS: HeroLayout[] = ['centered', 'split', 'image', 'carousel'];

/** שקופית בקרוסלת התמונות (טקסט ריק = נלקח מכותרות ה-Hero הכלליות). */
export interface CarouselSlide {
  imageUrl: string;
  headline: string | null;
  subheadline: string | null;
  ctaText: string | null;
  ctaHref: string | null;
}

export interface CarouselConfig {
  slides: CarouselSlide[];
  /** שניות בין שקופיות */
  intervalSec: number;
}

export const MAX_CAROUSEL_SLIDES = 8;

export interface HeroConfig {
  layout: HeroLayout;
  headline: string | null;
  subheadline: string | null;
  imageUrl: string | null;
  ctaText: string | null;
  ctaHref: string | null;
}

/** סגנון הכותרת: classic — סרגל עליון + ניווט תחתון; float — במובייל הסרגל (☰ לוגו 🔍) יורד לתחתית בגלילה. */
export type HeaderStyle = 'classic' | 'float';
export const HEADER_STYLES: HeaderStyle[] = ['classic', 'float'];

/** הודעת סטיקי בראש החנות, עם קישור לדף באתר. */
export interface AnnouncementConfig {
  enabled: boolean;
  text: string | null;
  linkText: string | null;
  /** נתיב באתר (/catalog?category=...) או https */
  href: string | null;
  tone: 'brand' | 'accent';
}

export interface ThemeConfig {
  hero: HeroConfig;
  carousel: CarouselConfig;
  /** background — רקע החנות (למשל בז'); ברירת מחדל לבן */
  colors: { primary: string; accent: string; background: string };
  stickyHeader: boolean;
  headerStyle: HeaderStyle;
  announcement: AnnouncementConfig;
}

export interface OpeningHoursRow {
  label: string;
  value: string;
}

const DEFAULT_PRIMARY = '#16a34a';

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function isHexColor(v: unknown): v is string {
  return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

/** תצורת עיצוב מנורמלת עם ברירות מחדל בטוחות. */
export function getNurseryTheme(
  nursery: Pick<Nursery, 'themeConfig' | 'primaryColor'>,
): ThemeConfig {
  const raw = (nursery.themeConfig ?? {}) as Record<string, unknown>;
  const rawHero = (raw.hero ?? {}) as Record<string, unknown>;
  const rawColors = (raw.colors ?? {}) as Record<string, unknown>;

  const layout: HeroLayout = HERO_LAYOUTS.includes(rawHero.layout as HeroLayout)
    ? (rawHero.layout as HeroLayout)
    : 'centered';

  const primary = isHexColor(rawColors.primary)
    ? rawColors.primary.trim()
    : isHexColor(nursery.primaryColor)
      ? nursery.primaryColor!.trim()
      : DEFAULT_PRIMARY;

  const accent = isHexColor(rawColors.accent) ? rawColors.accent.trim() : primary;
  const background = isHexColor(rawColors.background) ? rawColors.background.trim() : '#ffffff';

  return {
    hero: {
      layout,
      headline: str(rawHero.headline),
      subheadline: str(rawHero.subheadline),
      imageUrl: str(rawHero.imageUrl),
      ctaText: str(rawHero.ctaText),
      ctaHref: str(rawHero.ctaHref),
    },
    carousel: normalizeCarousel(raw.carousel),
    colors: { primary, accent, background },
    stickyHeader: raw.stickyHeader !== false, // ברירת מחדל: sticky פעיל
    headerStyle: HEADER_STYLES.includes(raw.headerStyle as HeaderStyle) ? (raw.headerStyle as HeaderStyle) : 'classic',
    announcement: normalizeAnnouncement(raw.announcement),
  };
}

/** קישור מותר בהודעה: נתיב באתר (לא //) או https. */
export function isSafeLink(href: string): boolean {
  return /^\/(?!\/)[^\s"'<>]*$/.test(href) || /^https:\/\/[^\s"'<>]+$/i.test(href);
}

/** נירמול הודעת הסטיקי (גם לקלט טופס וגם לקריאה מה-DB). הודעה בלי טקסט — כבויה. */
export function normalizeAnnouncement(json: unknown): AnnouncementConfig {
  const raw = (json ?? {}) as Record<string, unknown>;
  const text = str(raw.text)?.slice(0, 140) ?? null;
  const href = str(raw.href);
  return {
    enabled: raw.enabled === true && Boolean(text),
    text,
    linkText: str(raw.linkText)?.slice(0, 40) ?? null,
    href: href && isSafeLink(href) ? href.slice(0, 300) : null,
    tone: raw.tone === 'accent' ? 'accent' : 'brand',
  };
}

/** נירמול תצורת הקרוסלה (גם לקלט טופס וגם לקריאה מה-DB). */
export function normalizeCarousel(json: unknown): CarouselConfig {
  const raw = (json ?? {}) as Record<string, unknown>;
  const slides: CarouselSlide[] = [];
  if (Array.isArray(raw.slides)) {
    for (const item of raw.slides) {
      if (!item || typeof item !== 'object') continue;
      const r = item as Record<string, unknown>;
      const imageUrl = str(r.imageUrl);
      if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) continue;
      slides.push({
        imageUrl,
        headline: str(r.headline)?.slice(0, 120) ?? null,
        subheadline: str(r.subheadline)?.slice(0, 240) ?? null,
        ctaText: str(r.ctaText)?.slice(0, 40) ?? null,
        ctaHref: str(r.ctaHref)?.slice(0, 300) ?? null,
      });
      if (slides.length >= MAX_CAROUSEL_SLIDES) break;
    }
  }
  const interval = Number(raw.intervalSec);
  return {
    slides,
    intervalSec: Number.isFinite(interval) ? Math.min(20, Math.max(3, Math.round(interval))) : 6,
  };
}

/** המרת ה-JSON של שעות הפעילות למערך שורות תצוגה. */
export function normalizeOpeningHours(json: unknown): OpeningHoursRow[] {
  if (!Array.isArray(json)) return [];
  const rows: OpeningHoursRow[] = [];
  for (const item of json) {
    if (!item || typeof item !== 'object') continue;
    const label = str((item as Record<string, unknown>).label);
    const value = str((item as Record<string, unknown>).value);
    if (label && value) rows.push({ label, value });
  }
  return rows;
}

/** פענוח טקסט חופשי (שורה = "תווית: ערך") למבנה שעות הפעילות. */
export function parseOpeningHoursText(text: string): OpeningHoursRow[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx === -1) return { label: line, value: '' };
      return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
    })
    .filter((r) => r.label && r.value);
}

/** מבנה שעות הפעילות חזרה לטקסט לעריכה. */
export function openingHoursToText(json: unknown): string {
  return normalizeOpeningHours(json)
    .map((r) => `${r.label}: ${r.value}`)
    .join('\n');
}
