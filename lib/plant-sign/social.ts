import type { SignSocial, SignSocialLink } from './types';

/**
 * רשתות חברתיות בשלט: במקום שם הרשת — שם המשתמש של המשתלה (מה שהלקוח באמת מקליד בחיפוש),
 * שנגזר מהקישור שכבר הוזן בהגדרות. וואטסאפ — מספר הטלפון. כשאי אפשר לחלץ (קישור שיתוף,
 * מספר פרופיל, עמוד הבית של הרשת) — שם הרשת, כמו קודם. ללא תלות בשרת.
 */

const ORDER: SignSocial[] = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE', 'WHATSAPP'];

const HANDLE_RE = /^[A-Za-z0-9._-]{2,40}$/;

/** נתיבים שאינם שם משתמש */
const RESERVED: Partial<Record<SignSocial, string[]>> = {
  FACEBOOK: [
    'share',
    'sharer',
    'sharer.php',
    'profile.php',
    'pages',
    'groups',
    'people',
    'watch',
    'events',
    'marketplace',
    'story.php',
    'permalink.php',
    'p',
    'reel',
    'photo',
    'photo.php',
    'login',
    'home.php',
  ],
  INSTAGRAM: ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'tv', 's'],
};

function firstPathSegment(value: string): string | null {
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  const seg = u.pathname.split('/').filter(Boolean)[0];
  return seg ? decodeURIComponent(seg) : null;
}

/** "050-1234567" ממספר ששמור בכל צורה (גם wa.me/972…) */
export function formatPhone(value: string): string | null {
  let d = value.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('972')) d = `0${d.slice(3)}`;
  if (/^05\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (/^0\d{8}$/.test(d)) return `${d.slice(0, 2)}-${d.slice(2)}`;
  if (/^07\d{8}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return null;
}

/** שם המשתמש ("@name") או הטלפון מתוך הערך השמור; null — אי אפשר לחלץ */
export function socialHandle(provider: SignSocial, value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (provider === 'WHATSAPP') return formatPhone(v);
  // ערך שהוא כבר שם משתמש ("@name" או "name")
  if (!v.includes('/') && !/\.(com|net|org|co|il|me|ly)\b/i.test(v)) {
    const h = v.replace(/^@/, '');
    return HANDLE_RE.test(h) && !/^\d+$/.test(h) ? `@${h}` : null;
  }
  const seg = firstPathSegment(v);
  if (!seg) return null;
  if (provider === 'TIKTOK' || provider === 'YOUTUBE') {
    // רק כתובת עם @ — /channel/ID או /c/ אינם שם משתמש
    if (!seg.startsWith('@')) return null;
  }
  const h = seg.replace(/^@/, '');
  if (RESERVED[provider]?.includes(h.toLowerCase())) return null;
  if (!HANDLE_RE.test(h) || /^\d+$/.test(h)) return null;
  return `@${h}`;
}

/** הרשתות שמוצגות בשלט (עד 4, בסדר קבוע), עם שם המשתמש של כל אחת */
export function signSocialLinks(channels: Array<{ provider: string; value: string | null }>): SignSocialLink[] {
  const byProvider = new Map(channels.map((c) => [c.provider, c.value]));
  return ORDER.filter((p) => byProvider.has(p))
    .map((provider) => ({ provider, handle: socialHandle(provider, byProvider.get(provider)) }))
    .slice(0, 4);
}

/** רשומה ישנה (רק שם הרשת) → קישור בלי שם משתמש */
export function normalizeSocials(v: unknown): SignSocialLink[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x): SignSocialLink[] => {
    if (typeof x === 'string') return ORDER.includes(x as SignSocial) ? [{ provider: x as SignSocial, handle: null }] : [];
    const o = x as { provider?: unknown; handle?: unknown } | null;
    if (!o || typeof o.provider !== 'string' || !ORDER.includes(o.provider as SignSocial)) return [];
    return [{ provider: o.provider as SignSocial, handle: typeof o.handle === 'string' ? o.handle : null }];
  });
}

export type SocialLayout =
  /** אייקונים בשורה, ומתחת לכל אחד שם הרשת (אין שמות משתמש) */
  | { mode: 'names' }
  /** אותו שם משתמש בכל הרשתות: אייקונים בשורה ושורה אחת "@name" (וטלפון וואטסאפ בשורה נוספת) */
  | { mode: 'shared'; handle: string; phone: string | null }
  /** שמות שונים או ארוכים: רשימה — אייקון קטן ולצדו שם המשתמש / הטלפון / שם הרשת */
  | { mode: 'list' };

export function socialLayout(links: SignSocialLink[]): SocialLayout {
  const handles = links.filter((l) => l.provider !== 'WHATSAPP' && l.handle).map((l) => l.handle!);
  const others = links.filter((l) => l.provider !== 'WHATSAPP');
  const phone = links.find((l) => l.provider === 'WHATSAPP')?.handle ?? null;
  if (!handles.length && !phone) return { mode: 'names' };
  const unique = new Set(handles.map((h) => h.toLowerCase()));
  if (others.length >= 2 && handles.length === others.length && unique.size === 1) return { mode: 'shared', handle: handles[0]!, phone };
  return { mode: 'list' };
}
