import { SignJWT, jwtVerify } from 'jose';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import type { PrintFileKind } from '@prisma/client';

/**
 * אחסון פרטי לקבצי דפוס (PT-08, נספח א.10).
 *
 * - Production: Supabase Storage, bucket פרטי `print-private` (נוצר אוטומטית בשימוש הראשון —
 *   אושר ע"י הבעלים). המפתח נשאר בשרת; העלאה ישירה מהדפדפן בקישור חתום (ללא מגבלת 4.5MB של Vercel).
 * - פיתוח/בדיקות: דיסק מקומי, עם אותו ממשק.
 * - הורדה רק דרך `/api/print-files/[id]?t=` — כרטיס חתום ל-5 דקות + בדיקת הרשאה בכל בקשה.
 */

export const PRINT_BUCKET = 'print-private';
const UPLOAD_TTL = '15m';
const DOWNLOAD_TTL = '5m';

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || 'dev-only-insecure-secret-change-me');

// ---------- כרטיסים חתומים ----------

export interface UploadTicket {
  key: string;
  nurseryId: string;
  kind: PrintFileKind;
  /** יעד: גרסת גרפיקה חדשה למוצר קבוע/הזמנה, או הגהה לגרסה */
  target: { savedProductId?: string; printOrderId?: string; versionId?: string; productionOrderId?: string };
}

export async function signUploadTicket(t: UploadTicket): Promise<string> {
  return new SignJWT({ p: 'up', ...t }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(UPLOAD_TTL).sign(secret());
}

export async function verifyUploadTicket(token: string): Promise<UploadTicket | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.p !== 'up' || typeof payload.key !== 'string' || typeof payload.nurseryId !== 'string') return null;
    return { key: payload.key, nurseryId: payload.nurseryId, kind: payload.kind as PrintFileKind, target: (payload.target ?? {}) as UploadTicket['target'] };
  } catch {
    return null;
  }
}

export async function signDownloadUrl(fileId: string): Promise<string> {
  const t = await new SignJWT({ p: 'dl', f: fileId }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(DOWNLOAD_TTL).sign(secret());
  return `/api/print-files/${encodeURIComponent(fileId)}?t=${encodeURIComponent(t)}`;
}

export async function verifyDownloadToken(fileId: string, token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.p === 'dl' && payload.f === fileId;
  } catch {
    return false;
  }
}

// ---------- מנהלי אחסון ----------

export interface UploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

interface Driver {
  name: 'supabase' | 'local';
  uploadTarget(key: string, ticket: string): Promise<UploadTarget>;
  read(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

function supabaseConfig() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let base: string | undefined;
  try {
    if (process.env.SUPABASE_URL) base = new URL(process.env.SUPABASE_URL).origin;
  } catch {
    base = undefined;
  }
  return base && key ? { base, key } : null;
}

let bucketReady = false;

function supabaseDriver(cfg: { base: string; key: string }): Driver {
  const auth = { Authorization: `Bearer ${cfg.key}`, apikey: cfg.key };
  const objectPath = (key: string) => `${PRINT_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;

  async function ensureBucket() {
    if (bucketReady) return;
    const r = await fetch(`${cfg.base}/storage/v1/bucket/${PRINT_BUCKET}`, { headers: auth, cache: 'no-store' });
    if (!r.ok) {
      const c = await fetch(`${cfg.base}/storage/v1/bucket`, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: PRINT_BUCKET, name: PRINT_BUCKET, public: false, file_size_limit: 50 * 1024 * 1024 }),
      });
      if (!c.ok && c.status !== 409) throw new Error(`יצירת אחסון פרטי נכשלה (${c.status})`);
    }
    bucketReady = true;
  }

  return {
    name: 'supabase',
    async uploadTarget(key) {
      await ensureBucket();
      const r = await fetch(`${cfg.base}/storage/v1/object/upload/sign/${objectPath(key)}`, { method: 'POST', headers: auth });
      if (!r.ok) throw new Error(`יצירת קישור העלאה נכשלה (${r.status})`);
      const { url } = (await r.json()) as { url: string };
      return { url: `${cfg.base}/storage/v1${url}`, method: 'PUT', headers: {} };
    },
    async read(key) {
      const r = await fetch(`${cfg.base}/storage/v1/object/authenticated/${objectPath(key)}`, { headers: auth, cache: 'no-store' });
      if (!r.ok) return null;
      return Buffer.from(await r.arrayBuffer());
    },
    async remove(key) {
      await fetch(`${cfg.base}/storage/v1/object/${objectPath(key)}`, { method: 'DELETE', headers: auth });
    },
  };
}

export function localDir(): string {
  return process.env.PRINT_LOCAL_DIR || path.join(os.tmpdir(), 'mashtelot-print-files');
}

/** נתיב מקומי בטוח: המפתח מורכב רק ממזהים שהשרת יצר; בדיקה כפולה נגד יציאה מהתיקייה. */
export function localPath(key: string): string {
  if (!/^[0-9a-f-]{36}\/(ARTWORK|PROOF|PRODUCTION)\/[0-9a-f-]{36}$/.test(key)) throw new Error('invalid storage key');
  const root = path.resolve(localDir());
  const p = path.resolve(root, key);
  if (!p.startsWith(root + path.sep)) throw new Error('invalid storage key');
  return p;
}

const localDriver: Driver = {
  name: 'local',
  async uploadTarget(_key, ticket) {
    return { url: `/api/print-files/upload?t=${encodeURIComponent(ticket)}`, method: 'PUT', headers: {} };
  },
  async read(key) {
    try {
      return await fs.readFile(localPath(key));
    } catch {
      return null;
    }
  },
  async remove(key) {
    await fs.rm(localPath(key), { force: true });
  },
};

/** מפתח ציבורי של Supabase: החדש (sb_publishable_) או JWT ישן עם role=anon. */
export function isPublicKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(parts[1]!, 'base64url').toString()).role === 'anon';
  } catch {
    return false;
  }
}

export function storageDriver(): Driver {
  const cfg = supabaseConfig();
  // מפתח ציבורי (publishable/anon) לא עוקף RLS — האחסון הפרטי ייכשל בהודעה לא ברורה; עדיף לעצור מיד
  if (cfg && isPublicKey(cfg.key)) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY מוגדר עם המפתח הציבורי — יש להגדיר את המפתח הסודי (service_role / sb_secret)');
  }
  if (cfg) return supabaseDriver(cfg);
  if (process.env.NODE_ENV !== 'production' || process.env.E2E === '1') return localDriver;
  throw new Error('אחסון הקבצים לא מוגדר (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY חסרים)');
}

export function newStorageKey(nurseryId: string, kind: PrintFileKind): string {
  return `${nurseryId}/${kind}/${crypto.randomUUID()}`;
}
