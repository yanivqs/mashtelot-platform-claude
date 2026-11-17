/** תמונות נוספות למוצר (גלריה). טהור, משותף לשרת ולבדיקות. */
export const MAX_GALLERY_IMAGES = 8;

/**
 * ניקוי רשימת התמונות מהטופס: כתובות http(s) בלבד, בלי כפילויות, בלי התמונה הראשית, עד 8 בסדר שנשלח.
 */
export function parseGalleryUrls(values: unknown[], mainImage: string | null): string[] {
  const out: string[] = [];
  for (const raw of values) {
    const url = String(raw ?? '').trim();
    if (!url || url === mainImage || out.includes(url)) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' && u.protocol !== 'http:') continue;
    } catch {
      continue;
    }
    out.push(url);
    if (out.length === MAX_GALLERY_IMAGES) break;
  }
  return out;
}

/** כל תמונות המוצר: הראשית ואחריה הגלריה, בלי כפילויות. */
export function productImages(mainImage: string | null, gallery: readonly string[] | null | undefined): string[] {
  const out = mainImage ? [mainImage] : [];
  for (const url of gallery ?? []) if (url && !out.includes(url)) out.push(url);
  return out;
}
