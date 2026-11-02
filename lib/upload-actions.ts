'use server';

import { requireUser } from '@/lib/auth';
import { isNurseryBlocked } from '@/lib/nursery-account';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { storeImage } from '@/lib/image-storage';

export interface UploadResult {
  url?: string;
  error?: string;
}

const FOLDERS = new Set(['plants', 'logos', 'artwork', 'misc']);

/** מעלה תמונה יחידה לאחסון ומחזיר URL ציבורי. */
export async function uploadImage(formData: FormData): Promise<UploadResult> {
  // R06: גם צוות המשתלה (כותב תוכן — תמונות לבלוג/עמודים)
  const user = await requireUser(['SUPER_ADMIN', 'NURSERY_OWNER', 'NURSERY_STAFF', 'NURSERY_WRITER']);
  if (user.role !== 'SUPER_ADMIN' && (await isNurseryBlocked(user.nurseryId))) throw new Error('הגישה לניהול המשתלה מוגבלת');

  if (!(await rateLimit(`upload:ip:${await clientIp()}`, 40, 10 * 60_000)).ok) {
    return { error: 'יותר מדי העלאות בזמן קצר. נסו שוב בעוד מספר דקות.' };
  }

  const folderRaw = String(formData.get('folder') || 'misc');
  const stored = await storeImage(formData.get('file'), FOLDERS.has(folderRaw) ? folderRaw : 'misc');
  return 'error' in stored ? { error: stored.error } : { url: stored.url };
}
