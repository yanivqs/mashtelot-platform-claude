/**
 * זיהוי קבצי דפוס לפי התוכן (magic bytes) — לא לפי סיומת או סוג שהדפדפן שלח (נספח א.10, PT-08).
 * SVG/HTML וכל פורמט "פעיל" אחר נדחים. מחזיר גם מידות לתמונות PNG/JPEG (לבדיקת רזולוציה אפקטיבית בהמשך).
 */

export interface SniffResult {
  mimeType: 'application/pdf' | 'image/png' | 'image/jpeg' | 'image/tiff' | 'application/postscript';
  ext: string;
  widthPx?: number;
  heightPx?: number;
}

const startsWith = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);
const ascii = (b: Uint8Array, s: string, at = 0) => startsWith(b, [...s].map((c) => c.charCodeAt(0)), at);

export const MAX_PRINT_FILE_BYTES = 50 * 1024 * 1024;
export const ACCEPTED_LABEL = 'PDF, PNG, JPG, TIFF או EPS';

function pngSize(b: Uint8Array) {
  if (b.length < 24 || !ascii(b, 'IHDR', 12)) return {};
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { widthPx: dv.getUint32(16), heightPx: dv.getUint32(20) };
}

function jpegSize(b: Uint8Array) {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1]!;
    // SOF0–SOF15 מלבד DHT(C4), JPG(C8), DAC(CC)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { heightPx: (b[i + 5]! << 8) | b[i + 6]!, widthPx: (b[i + 7]! << 8) | b[i + 8]! };
    }
    const len = (b[i + 2]! << 8) | b[i + 3]!;
    if (len < 2) break;
    i += 2 + len;
  }
  return {};
}

export function sniffPrintFile(bytes: Uint8Array): SniffResult | null {
  if (ascii(bytes, '%PDF-')) return { mimeType: 'application/pdf', ext: 'pdf' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mimeType: 'image/png', ext: 'png', ...pngSize(bytes) };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mimeType: 'image/jpeg', ext: 'jpg', ...jpegSize(bytes) };
  if (startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])) return { mimeType: 'image/tiff', ext: 'tif' };
  if (ascii(bytes, '%!PS')) return { mimeType: 'application/postscript', ext: 'eps' };
  // EPS בינארי (DOS EPS header)
  if (startsWith(bytes, [0xc5, 0xd0, 0xd3, 0xc6])) return { mimeType: 'application/postscript', ext: 'eps' };
  return null;
}

/** שם קובץ בטוח לתצוגה ול-Content-Disposition (ללא נתיבים ותווי בקרה). */
export function safeFileName(name: string, ext: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const clean = base.replace(/[\u0000-\u001f\u007f"<>|*?:]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
  const withoutExt = clean.replace(/\.[^.]*$/, '') || 'file';
  return `${withoutExt}.${ext}`;
}
