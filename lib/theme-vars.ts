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

export function themeStyleVars(theme: Pick<ThemeConfig, 'colors'>): Record<string, string> {
  const vars: Record<string, string> = {
    '--brand': theme.colors.primary,
    '--accent': theme.colors.accent,
    '--surface': theme.colors.background,
  };
  for (const [shade, [mix, amount]] of Object.entries(SHADES)) vars[`--brand-${shade}`] = shadeChannels(theme.colors.primary, mix, amount);
  return vars;
}
