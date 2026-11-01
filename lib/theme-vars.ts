import type { ThemeConfig } from '@/lib/theme';

/**
 * משתני CSS של ערכת הצבעים בחנות: --brand / --accent / --surface, וגווני brand-50…900
 * כערוצי RGB (כדי ש-bg-brand-50/40 של Tailwind יעבוד). גווני הבהיר מעורבבים עם לבן,
 * הכהים עם שחור. בלי המשתנים (ממשק הניהול) — הירוק של ברירת המחדל ב-tailwind.config.
 */
const SHADES: Record<number, [mix: 'white' | 'black', amount: number]> = {
  50: ['white', 0.92],
  100: ['white', 0.84],
  200: ['white', 0.68],
  300: ['white', 0.48],
  400: ['white', 0.24],
  500: ['white', 0.08],
  600: ['white', 0],
  700: ['black', 0.15],
  800: ['black', 0.3],
  900: ['black', 0.45],
};

function rgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function shadeChannels(hex: string, mix: 'white' | 'black', amount: number): string {
  const target = mix === 'white' ? 255 : 0;
  return rgb(hex)
    .map((c) => Math.round(c + (target - c) * amount))
    .join(' ');
}

function luminance(channels: number[]): number {
  const [r, g, b] = channels.map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** ניגודיות מול לבן לפי WCAG. */
export function contrastWithWhite(hex: string): number {
  return 1.05 / (luminance(rgb(hex)) + 0.05);
}

/**
 * הצבע הראשי משמש רקע לכפתורים עם טקסט לבן וגם צבע לקישורים על לבן. צבע בהיר מדי
 * מוכהה בדיוק עד ניגודיות 4.5:1 (WCAG AA); צבע שעומד בזה נשאר כמו שהוא.
 */
export function readableOnWhite(hex: string, minRatio = 4.5): string {
  let current = hex;
  for (let amount = 0.02; contrastWithWhite(current) < minRatio && amount <= 1; amount += 0.02) {
    const channels = shadeChannels(hex, 'black', amount).split(' ').map(Number);
    current = `#${channels.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }
  return current;
}

export function themeStyleVars(theme: Pick<ThemeConfig, 'colors'>): Record<string, string> {
  const primary = readableOnWhite(theme.colors.primary);
  const vars: Record<string, string> = {
    '--brand': primary,
    '--accent': theme.colors.accent,
    // צבע משני כטקסט או כרקע לטקסט לבן; 5.2 כדי לעמוד ב-4.5 גם על רקע מגוון בהיר של אותו צבע
    '--accent-strong': readableOnWhite(theme.colors.accent, 5.2),
    '--surface': theme.colors.background,
  };
  for (const [shade, [mix, amount]] of Object.entries(SHADES)) vars[`--brand-${shade}`] = shadeChannels(primary, mix, amount);
  return vars;
}
