/**
 * שומר יעד לסקריפטי seed (C-P0-03): seed יוצר משתמשים/נתוני הדגמה ואסור שירוץ על
 * Production. מותר רק מול Postgres מקומי, או פרויקט Supabase שה-ref שלו מופיע
 * במפורש ב-SEED_ALLOWED_REFS (מופרד בפסיקים). את ה-ref של Production אין להוסיף לרשימה.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

function describeTarget(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('DATABASE_URL אינה כתובת תקינה');
  }
  const host = url.hostname.toLowerCase();
  const user = decodeURIComponent(url.username);
  const ref =
    (user.match(/^postgres\.([a-z0-9]{20})$/) || [])[1] ||
    (host.match(/^db\.([a-z0-9]{20})\.supabase\.co$/) || [])[1] ||
    null;
  return { host, ref, local: LOCAL_HOSTS.has(host) };
}

/** זורק אם היעד אינו מקומי ואינו ברשימת ההיתר. מחזיר תיאור ללא סיסמה. */
function assertSeedTargetAllowed(env = process.env) {
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL לא מוגדרת');
  const t = describeTarget(env.DATABASE_URL);
  if (t.local) return `local:${t.host}`;
  const allowed = (env.SEED_ALLOWED_REFS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (t.ref && allowed.includes(t.ref)) return `supabase:${t.ref}`;
  throw new Error(
    `seed חסום: היעד ${t.ref ? `supabase:${t.ref}` : t.host} אינו מקומי ואינו ב-SEED_ALLOWED_REFS. ` +
      'אין להריץ seed על Production.',
  );
}

module.exports = { assertSeedTargetAllowed, describeTarget };
