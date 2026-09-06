'use server';

import { requireUser } from '@/lib/auth';
import { rateLimit, clientIp } from '@/lib/rate-limit';

export interface UploadResult {
  url?: string;
  error?: string;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const FOLDERS = new Set(['plants', 'logos', 'artwork', 'misc']);
const BUCKET = 'uploads';

/**
 * מעלה תמונה יחידה ל-Supabase Storage (REST, ללא SDK) ומחזיר URL ציבורי.
 *
 * דורש: SUPABASE_URL (כמו https://xxxx.supabase.co) + SUPABASE_SERVICE_ROLE_KEY,
 * וקיום bucket ציבורי בשם "uploads" בפרויקט Supabase.
 */
export async function uploadImage(formData: FormData): Promise<UploadResult> {
  await requireUser(['SUPER_ADMIN', 'NURSERY_OWNER']);

  if (!rateLimit(`upload:ip:${clientIp()}`, 40, 10 * 60_000).ok) {
    return { error: 'יותר מדי העלאות בזמן קצר. נסו שוב בעוד מספר דקות.' };
  }

  const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !key) {
    return { error: 'אחסון הקבצים לא מוגדר (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY חסרים).' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'לא נבחר קובץ' };
  }
  if (file.size > MAX_BYTES) {
    return { error: 'הקובץ גדול מ-5MB' };
  }
  if (!ALLOWED.has(file.type)) {
    return { error: 'סוג קובץ לא נתמך (JPG, PNG, WEBP, GIF, AVIF)' };
  }

  const folderRaw = String(formData.get('folder') || 'misc');
  const folder = FOLDERS.has(folderRaw) ? folderRaw : 'misc';
  const path = `${folder}/${crypto.randomUUID()}.${EXT[file.type]}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        apikey: key,
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

    return { url: `${baseUrl}/storage/v1/object/public/${BUCKET}/${path}` };
  } catch (e) {
    console.error('[upload] שגיאת רשת', e);
    return { error: 'העלאת הקובץ נכשלה' };
  } finally {
    clearTimeout(timeout);
  }
}
