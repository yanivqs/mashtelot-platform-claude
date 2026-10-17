/**
 * אילו ערכי עיצוב נשמרים כשבעל משתלה שומר את הגדרות המשתלה (C-P1-01). טהור.
 * בלי מודול "שליטה בעיצוב" — כל העיצוב השמור נשאר כפי שהוא, גם אם הטופס שלח ערכים.
 * עם המודול אך בלי הרשאת קרוסלה — רק הקרוסלה השמורה נשמרת.
 */

export interface DesignState {
  themeConfig: unknown;
  primaryColor: string | null;
}

export function resolveDesignUpdate(
  submitted: DesignState,
  stored: DesignState,
  rights: { designEnabled: boolean; carouselAllowed: boolean },
): DesignState {
  if (!rights.designEnabled) return { themeConfig: stored.themeConfig, primaryColor: stored.primaryColor };
  if (!rights.carouselAllowed) {
    const storedTheme = (stored.themeConfig ?? {}) as Record<string, unknown>;
    const submittedTheme = (submitted.themeConfig ?? {}) as Record<string, unknown>;
    return {
      themeConfig: { ...submittedTheme, carousel: storedTheme.carousel ?? null },
      primaryColor: submitted.primaryColor,
    };
  }
  return submitted;
}
