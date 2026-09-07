import type { Nursery } from '@prisma/client';

export type HeroLayout = 'centered' | 'split' | 'image';

export interface HeroConfig {
  layout: HeroLayout;
  headline: string | null;
  subheadline: string | null;
  imageUrl: string | null;
  ctaText: string | null;
  ctaHref: string | null;
}

export interface ThemeConfig {
  hero: HeroConfig;
  colors: { primary: string; accent: string };
  stickyHeader: boolean;
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

  const layout: HeroLayout =
    rawHero.layout === 'split' || rawHero.layout === 'image' ? rawHero.layout : 'centered';

  const primary = isHexColor(rawColors.primary)
    ? rawColors.primary.trim()
    : isHexColor(nursery.primaryColor)
      ? nursery.primaryColor!.trim()
      : DEFAULT_PRIMARY;

  const accent = isHexColor(rawColors.accent) ? rawColors.accent.trim() : primary;

  return {
    hero: {
      layout,
      headline: str(rawHero.headline),
      subheadline: str(rawHero.subheadline),
      imageUrl: str(rawHero.imageUrl),
      ctaText: str(rawHero.ctaText),
      ctaHref: str(rawHero.ctaHref),
    },
    colors: { primary, accent },
    stickyHeader: raw.stickyHeader !== false, // ברירת מחדל: sticky פעיל
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
