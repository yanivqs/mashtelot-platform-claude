/**
 * עזרי סקריפטי נתונים: הורדת תמונה מבוקרת (קצב, ניסיונות חוזרים) והעלאה ל-Supabase Storage (bucket "uploads").
 * דורש SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (המפתח הסודי) בסביבה.
 */
const BUCKET = 'uploads';
const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function storageConfig(): { baseUrl: string; key: string } {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const raw = process.env.SUPABASE_URL;
  if (!key || !raw) throw new Error('חסרים SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return { baseUrl: new URL(raw).origin, key };
}

/** הורדה עם השהיה בין ניסיונות; 429/5xx — המתנה ארוכה יותר. */
export async function downloadImage(url: string, referer?: string): Promise<{ bytes: Buffer; type: string }> {
  let lastError = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8', ...(referer ? { Referer: referer } : {}) },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = `HTTP ${res.status}`;
        await sleep(5_000 * attempt);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const type = (res.headers.get('content-type') || '').split(';')[0]!.trim().toLowerCase();
      if (!EXT[type]) throw new Error(`סוג לא נתמך: ${type || 'ריק'}`);
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length === 0) throw new Error('קובץ ריק');
      if (bytes.length > MAX_BYTES) throw new Error(`גדול מ-5MB (${bytes.length})`);
      return { bytes, type };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      if (/HTTP 4\d\d|סוג לא נתמך|ריק|5MB/.test(lastError)) break;
      await sleep(2_000 * attempt);
    }
  }
  throw new Error(lastError || 'הורדה נכשלה');
}

/** העלאה לנתיב קבוע (upsert) — הרצה חוזרת לא יוצרת כפילויות. מחזיר את הכתובת הציבורית. */
export async function uploadToStorage(pathWithoutExt: string, file: { bytes: Buffer; type: string }): Promise<string> {
  const { baseUrl, key } = storageConfig();
  const path = `${pathWithoutExt}.${EXT[file.type]}`;
  const res = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': file.type,
      'Cache-Control': 'max-age=31536000',
      'x-upsert': 'true',
    },
    body: new Uint8Array(file.bytes),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`העלאה נכשלה ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${baseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** יעד ה-DB לתצוגה ולשמירה מפני הרצה בטעות על Production. */
export function requireTargetConfirmation(args: string[], token: string): { production: boolean; label: string } {
  const url = new URL(process.env.DATABASE_URL || 'postgres://x@missing/x');
  const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  const label = local ? `local:${url.hostname}` : url.hostname;
  if (!local && !args.includes(`--confirm-production=${token}`)) {
    throw new Error(`יעד לא מקומי (${label}) — נדרש --confirm-production=${token}`);
  }
  return { production: !local, label };
}
