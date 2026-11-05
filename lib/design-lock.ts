/**
 * אילו ערכי עיצוב נשמרים כשבעל משתלה שומר את הגדרות המשתלה (C-P1-01). טהור.
 * בלי מודול "שליטה בעיצוב" — כל העיצוב השמור נשאר כפי שהוא, גם אם הטופס שלח ערכים.
 * עם המודול אך בלי הרשאת קרוסלה או כותרת נדבקת — הערך השמור של אותו חלק נשמר.
 */

export interface DesignState {
  themeConfig: unknown;
  primaryColor: string | null;
}

export function resolveDesignUpdate(
  submitted: DesignState,
  stored: DesignState,
  rights: { designEnabled: boolean; carouselAllowed: boolean; stickyAllowed: boolean },
): DesignState {
  if (!rights.designEnabled) return { themeConfig: stored.themeConfig, primaryColor: stored.primaryColor };
  if (rights.carouselAllowed && rights.stickyAllowed) return submitted;
  const storedTheme = (stored.themeConfig ?? {}) as Record<string, unknown>;
  const theme = { ...((submitted.themeConfig ?? {}) as Record<string, unknown>) };
  if (!rights.carouselAllowed) theme.carousel = storedTheme.carousel ?? null;
  if (!rights.stickyAllowed) {
    // ערך שלא נשמר מעולם נשאר חסר, כדי שברירת המחדל של התבנית תמשיך לחול
    if ('stickyHeader' in storedTheme) theme.stickyHeader = storedTheme.stickyHeader;
    else delete theme.stickyHeader;
  }
  return { themeConfig: theme, primaryColor: submitted.primaryColor };
}
