import 'server-only';

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const BUCKET = 'uploads';

function storageConfig(): { baseUrl: string; key: string } | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // מקבלים גם אם הודבק עם סיומת נתיב (למשל .../rest/v1/) — לוקחים רק את ה-origin
  let baseUrl: string | undefined;
  try {
    if (process.env.SUPABASE_URL) baseUrl = new URL(process.env.SUPABASE_URL).origin;
  } catch {
    baseUrl = undefined;
  }
  return baseUrl && key ? { baseUrl, key } : null;
}

export type StoredImage = { url: string; path: string } | { error: string };

/**
 * מעלה תמונה יחידה ל-Supabase Storage (REST, ללא SDK) ומחזיר URL ציבורי ונתיב.
 *
 * דורש: SUPABASE_URL (כמו https://xxxx.supabase.co) + SUPABASE_SERVICE_ROLE_KEY,
 * וקיום bucket ציבורי בשם "uploads" בפרויקט Supabase.
 */
export async function storeImage(file: FormDataEntryValue | null, dir: string): Promise<StoredImage> {
  const config = storageConfig();
  if (!config) {
    return { error: 'אחסון הקבצים לא מוגדר (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY חסרים).' };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'לא נבחר קובץ' };
  }
  if (file.size > MAX_BYTES) {
    return { error: 'הקובץ גדול מ-5MB' };
  }
  if (!ALLOWED.has(file.type)) {
    return { error: 'סוג קובץ לא נתמך (JPG, PNG, WEBP, GIF, AVIF)' };
  }

  const path = `${dir}/${crypto.randomUUID()}.${EXT[file.type]}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${config.baseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.key}`,
        apikey: config.key,
        'Content-Type': file.type,
        'Cache-Control': 'max-age=31536000',
        'x-upsert': 'false',
      },
      body: Buffer.from(await file.arrayBuffer()),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[upload] נכשל', res.status, detail);
      if (res.status === 404) return { error: 'ה-bucket "uploads" לא קיים ב-Supabase Storage.' };
      return { error: 'העלאת הקובץ נכשלה' };
    }

    return { url: `${config.baseUrl}/storage/v1/object/public/${BUCKET}/${path}`, path };
  } catch (e) {
    console.error('[upload] שגיאת רשת', e);
    return { error: 'העלאת הקובץ נכשלה' };
  } finally {
    clearTimeout(timeout);
  }
}

/** מוחק קובץ מהאחסון. כשל לא חוסם — נשאר קובץ יתום, בלי השפעה על החנות. */
export async function removeStoredImage(path: string): Promise<void> {
  const config = storageConfig();
  if (!config) return;
  try {
    const res = await fetch(`${config.baseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.key}`, apikey: config.key },
    });
    if (!res.ok) console.error('[upload] מחיקה נכשלה', res.status, path);
  } catch (e) {
    console.error('[upload] שגיאת רשת במחיקה', e);
  }
}
