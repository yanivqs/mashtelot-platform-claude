/**
 * בדיקת קובץ בסיסית (Preflight, PT-09 חלקי, נספח א.5/א.8). טהור.
 *
 * בודק מול פרופיל הייצור של גרסת התבנית: מידות PDF (MediaBox/TrimBox) מול גודל המוצר עם/בלי גלישה,
 * רזולוציה אפקטיבית לתמונות רסטר מול גודל ההדפסה, יחס צלעות, ו-PDF מוצפן. כשל קריטי חוסם שחרור.
 * זו **אינה** בדיקת דפוס מקצועית (פונטים, פרופיל צבע, שכבות) — כך גם מוצג במסך.
 */
import type { SniffResult } from '@/lib/print-file-sniff';

export interface ProductionProfile {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  minDpi: number;
}

export function parseProfile(json: unknown): { ok: true; value: ProductionProfile | null } | { ok: false; errors: string[] } {
  if (json === null || json === undefined) return { ok: true, value: null };
  const r = (typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const n = (v: unknown, d?: number) => (v === undefined || v === null || v === '' ? d : Number(v));
  const widthMm = n(r.widthMm);
  const heightMm = n(r.heightMm);
  if (widthMm === undefined && heightMm === undefined) return { ok: true, value: null };
  const bleedMm = n(r.bleedMm, 0)!;
  const minDpi = n(r.minDpi, 300)!;
  const errors: string[] = [];
  if (!Number.isFinite(widthMm) || widthMm! <= 0 || widthMm! > 5000) errors.push('רוחב המוצר (מ"מ) לא תקין');
  if (!Number.isFinite(heightMm) || heightMm! <= 0 || heightMm! > 5000) errors.push('גובה המוצר (מ"מ) לא תקין');
  if (!Number.isFinite(bleedMm) || bleedMm < 0 || bleedMm > 20) errors.push('גלישה (Bleed) בין 0 ל-20 מ"מ');
  if (!Number.isInteger(minDpi) || minDpi < 72 || minDpi > 1200) errors.push('רזולוציה מינימלית בין 72 ל-1200 DPI');
  return errors.length ? { ok: false, errors } : { ok: true, value: { widthMm: widthMm!, heightMm: heightMm!, bleedMm, minDpi } };
}

export interface PreflightResult {
  /** חוסם שחרור לייצור */
  critical: string[];
  warnings: string[];
  info: { effectiveDpi?: number; pdfSizeMm?: [number, number] };
  checkedAt: string;
}

const PT_TO_MM = 25.4 / 72;
const round1 = (x: number) => Math.round(x * 10) / 10;

/** קופסת הדף הראשונה שנמצאת בטקסט ה-PDF (TrimBox עדיף על MediaBox). PDF עם object streams דחוסים — לא יימצא. */
export function pdfBoxMm(bytes: Uint8Array): [number, number] | null {
  const text = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 2 * 1024 * 1024)));
  const box = (name: string) => {
    const m = text.match(new RegExp(`/${name}\\s*\\[\\s*(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s+(-?[\\d.]+)\\s*\\]`));
    if (!m) return null;
    const [x0, y0, x1, y1] = m.slice(1, 5).map(Number) as [number, number, number, number];
    return [Math.abs(x1 - x0) * PT_TO_MM, Math.abs(y1 - y0) * PT_TO_MM] as [number, number];
  };
  return box('TrimBox') ?? box('MediaBox');
}

const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const fits = (got: [number, number], w: number, h: number, tol: number) =>
  (near(got[0], w, tol) && near(got[1], h, tol)) || (near(got[0], h, tol) && near(got[1], w, tol));

export function preflight(bytes: Uint8Array, sniff: SniffResult, profile: ProductionProfile | null, now = new Date()): PreflightResult {
  const critical: string[] = [];
  const warnings: string[] = [];
  const info: PreflightResult['info'] = {};

  if (!profile) {
    warnings.push('לא הוגדר פרופיל ייצור (מידות) למוצר — המידות והרזולוציה לא נבדקו');
  }

  if (sniff.mimeType === 'application/pdf') {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, Math.min(bytes.length, 2 * 1024 * 1024)));
    if (/\/Encrypt\b/.test(head)) critical.push('ה-PDF מוצפן/מוגן בסיסמה — לא ניתן להדפיס ממנו בבטחה');
    const size = pdfBoxMm(bytes);
    if (size) info.pdfSizeMm = [round1(size[0]), round1(size[1])];
    if (profile) {
      if (!size) {
        warnings.push('לא ניתן לקרוא את מידות הדף מה-PDF (קובץ דחוס) — יש לוודא את המידות ידנית');
      } else {
        const trimOk = fits(size, profile.widthMm, profile.heightMm, 1);
        const bleedOk = fits(size, profile.widthMm + 2 * profile.bleedMm, profile.heightMm + 2 * profile.bleedMm, 1);
        if (!trimOk && !bleedOk) {
          critical.push(
            `מידות הדף ${round1(size[0])}×${round1(size[1])} מ"מ אינן תואמות למוצר ${profile.widthMm}×${profile.heightMm} מ"מ` +
              (profile.bleedMm ? ` (או ${profile.widthMm + 2 * profile.bleedMm}×${profile.heightMm + 2 * profile.bleedMm} עם גלישה)` : ''),
          );
        } else if (profile.bleedMm > 0 && trimOk && !bleedOk) {
          warnings.push(`הקובץ בגודל הסופי ללא גלישה של ${profile.bleedMm} מ"מ — רקע עד הקצה עלול להיחתך לבן`);
        }
      }
    }
  } else if (sniff.mimeType === 'image/png' || sniff.mimeType === 'image/jpeg') {
    if (profile && sniff.widthPx && sniff.heightPx) {
      const w = profile.widthMm + 2 * profile.bleedMm;
      const h = profile.heightMm + 2 * profile.bleedMm;
      // הכיוון שמתאים יותר לתמונה
      const landscapeImg = sniff.widthPx >= sniff.heightPx;
      const [pw, ph] = landscapeImg === w >= h ? [w, h] : [h, w];
      const dpi = Math.floor(Math.min(sniff.widthPx / (pw / 25.4), sniff.heightPx / (ph / 25.4)));
      info.effectiveDpi = dpi;
      if (dpi < profile.minDpi * 0.75) critical.push(`רזולוציה אפקטיבית ${dpi} DPI — נמוכה מדי להדפסה (נדרש ${profile.minDpi})`);
      else if (dpi < profile.minDpi) warnings.push(`רזולוציה אפקטיבית ${dpi} DPI — מתחת ל-${profile.minDpi} המומלצים; ייתכן טשטוש`);
      const ratioImg = sniff.widthPx / sniff.heightPx;
      const ratioPrint = pw / ph;
      if (Math.abs(ratioImg - ratioPrint) / ratioPrint > 0.03) warnings.push('יחס הרוחב-גובה של התמונה שונה מהמוצר — חלק מהתמונה ייחתך או יימתח');
    } else if (profile) {
      warnings.push('לא ניתן לקרוא את מידות התמונה');
    }
  } else {
    // TIFF / EPS — אין קריאת מידות בבדיקה הבסיסית
    if (profile) warnings.push('המידות והרזולוציה של קובץ TIFF/EPS לא נבדקו אוטומטית — יש לוודא ידנית');
  }

  return { critical, warnings, info, checkedAt: now.toISOString() };
}
