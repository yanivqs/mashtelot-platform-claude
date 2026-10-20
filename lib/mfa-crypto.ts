/**
 * הצפנת מפתח ה-TOTP במנוחה (AES-256-GCM) וגיבוב קודי שחזור.
 * המפתח: MFA_ENCRYPTION_KEY — 32 בתים בקידוד base64, נפרד מ-AUTH_SECRET (החלפת סוד ה-session לא מבטלת MFA).
 * בפיתוח/בדיקות בלי משתנה — מפתח פיתוח קבוע; ב-Production בלי משתנה — שגיאה (לא נופלים בשקט).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const DEV_KEY = createHash('sha256').update('mashtelot-dev-only-mfa-key').digest();

function key(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (raw) {
    const k = Buffer.from(raw, 'base64');
    if (k.length !== 32) throw new Error('MFA_ENCRYPTION_KEY must be 32 bytes (base64)');
    return k;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('MFA_ENCRYPTION_KEY is not set');
  }
  return DEV_KEY;
}

/** האם אפשר להפעיל MFA בסביבה הזו (מוצג במסך במקום שגיאה). */
export function mfaConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

/** פורמט: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function decryptSecret(enc: string): string {
  const [v, iv, tag, ct] = enc.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('bad MFA secret format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

const RC_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // בלי תווים מבלבלים

/** 8 קודי שחזור בפורמט xxxxx-xxxxx. */
export function generateRecoveryCodes(n = 8): string[] {
  return Array.from({ length: n }, () => {
    const b = randomBytes(10);
    const s = Array.from(b, (x) => RC_ALPHABET[x % RC_ALPHABET.length]).join('');
    return `${s.slice(0, 5)}-${s.slice(5)}`;
  });
}

export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(normalizeRecoveryCode(code)).digest('hex');
}
