/**
 * TOTP (RFC 6238 / RFC 4226) — HMAC-SHA1, צעד של 30 שניות, 6 ספרות. תואם Google/Microsoft Authenticator.
 * טהור (node:crypto בלבד) — בר-בדיקה מול וקטורי הבדיקה של ה-RFC.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function base32Encode(buf: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('invalid base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** מפתח חדש: 20 בתים (160 ביט, כמומלץ ל-SHA1), בקידוד Base32. */
export function generateSecret(): string {
  return base32Encode(randomBytes(20));
}

export function stepAt(now: number = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/** קוד לצעד נתון (HOTP עם counter = הצעד). `key` — בתים גולמיים. */
export function hotp(key: Uint8Array, counter: number, digits = DIGITS, algo: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algo, key).update(msg).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const bin = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totp(secretBase32: string, now: number = Date.now()): string {
  return hotp(base32Decode(secretBase32), stepAt(now));
}

/**
 * בדיקת קוד: הצעד הנוכחי ±1 (סטיית שעון). מחזיר את הצעד שהתאים, או null.
 * `afterStep` — הצעד האחרון שכבר נוצל: קוד מאותו צעד או מוקדם יותר נדחה (מניעת שימוש חוזר).
 */
export function verifyTotp(secretBase32: string, code: string, now: number = Date.now(), afterStep: number | null = null): number | null {
  const c = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(c)) return null;
  const key = base32Decode(secretBase32);
  const current = stepAt(now);
  for (const step of [current - 1, current, current + 1]) {
    if (afterStep !== null && step <= afterStep) continue;
    const expected = Buffer.from(hotp(key, step));
    if (timingSafeEqual(expected, Buffer.from(c))) return step;
  }
  return null;
}

/** כתובת otpauth:// לקוד ה-QR. */
export function otpauthUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) });
  return `otpauth://totp/${label}?${params.toString()}`;
}
