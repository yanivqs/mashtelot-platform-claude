/**
 * בחירת אזור משלוח לפי עיר ומיקוד (§11.01) — טהור, משותף ל-checkout בדפדפן ולשרת.
 * מיקוד שתואם אזור גובר על העיר; כמה אזורים תואמים — ההתחלה הארוכה ביותר. אין התאמה למיקוד → לפי העיר.
 */

/** נירמול שם עיר להשוואה (רווחים מיותרים + case). */
export function normalizeCityName(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** מיקוד של לקוח: 7 ספרות (רווחים/מקפים מותרים). '' = לא הוזן; null = לא תקין. */
export function normalizePostcode(raw: string | null | undefined): string | null {
  const s = (raw ?? '').replace(/[\s-]/g, '');
  if (!s) return '';
  return /^\d{7}$/.test(s) ? s : null;
}

/** רשימת מיקודים לאזור: שורה (או פסיק) לכל מיקוד או התחלה של 1–7 ספרות. */
export function parsePostcodePrefixes(text: string): { ok: true; value: string[] } | { ok: false; error: string } {
  const out: string[] = [];
  for (const part of text.split(/[\n,]/)) {
    const p = part.replace(/[\s-]/g, '');
    if (!p) continue;
    if (!/^\d{1,7}$/.test(p)) return { ok: false, error: `מיקוד לא תקין: "${part.trim()}" — עד 7 ספרות` };
    if (!out.includes(p)) out.push(p);
  }
  return { ok: true, value: out };
}

export interface ZoneMatchInput {
  cities: string[];
  postcodes: string[];
}

export function pickZone<Z extends ZoneMatchInput>(zones: Z[], city: string | null | undefined, postcode: string | null | undefined): Z | null {
  const pc = normalizePostcode(postcode);
  if (pc) {
    let best: { zone: Z; len: number } | null = null;
    for (const z of zones) {
      for (const prefix of z.postcodes) {
        if (pc.startsWith(prefix) && (!best || prefix.length > best.len)) best = { zone: z, len: prefix.length };
      }
    }
    if (best) return best.zone;
  }
  const c = normalizeCityName(city ?? '');
  if (!c) return null;
  return zones.find((z) => z.cities.some((x) => normalizeCityName(x) === c)) ?? null;
}
