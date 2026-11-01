/** @type {import('next').NextConfig} */
const ROOT_DOMAIN = process.env.ROOT_DOMAIN || 'localhost:3000';
const isDev = process.env.NODE_ENV === 'development';

/**
 * CSP: חוסם סקריפטים, הטמעות וטפסים ממקורות זרים, ומונע הטמעת האתר באתר אחר (clickjacking).
 * 'unsafe-inline' בסקריפטים נדרש לסקריפטים שמוטמעים בדף ע"י Next.js (המעבר ל-nonce הוא שדרוג עתידי).
 * תמונות: כל https — תמונות מוצר מגיעות מ-Supabase וממקורות חיצוניים.
 * connect-src: העלאת קובצי דפוס ישירות ל-Supabase Storage.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co${isDev ? ' ws:' : ''}`,
  "frame-src 'self' https://www.youtube-nocookie.com https://*.google.com https://*.google.co.il",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), usb=(), browsing-topics=()' },
];

const nextConfig = {
  reactStrictMode: true,
  // אין `images.remotePatterns`: האפליקציה אינה משתמשת ב-next/image (תמונות מוצגות ב-<img>),
  // ותצורת hostname '**' אפשרה ל-/_next/image למשוך ולעבד תמונה מכל דומיין — משטח התקיפה של
  // advisories קריטיים (RCE ב-Image Optimization API עם AVIF, DoS). ללא תצורה — נדחה. C-P1-03 שלב 0.
  experimental: {
    serverActions: {
      // ברירת המחדל (1MB) קטנה מדי לקובץ ה-CSV של ייבוא הקטלוג הבוטני (~1.5MB)
      bodySizeLimit: '5mb',
    },
  },
  async headers() {
    const rules = [{ source: '/:path*', headers: securityHeaders }];
    // includeSubDomains רק על דומיין הפלטפורמה: בדומיין מותאם של משתלה הוא היה מחייב HTTPS
    // גם בתת-דומיינים אחרים שלה, שאינם בשליטתנו
    if (!ROOT_DOMAIN.startsWith('localhost')) {
      rules.push({
        source: '/:path*',
        has: [{ type: 'host', value: `(.*\\.)?${ROOT_DOMAIN.replace(/\./g, '\\.')}` }],
        headers: [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }],
      });
    }
    return rules;
  },
};

module.exports = nextConfig;
