/** @type {import('next').NextConfig} */
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
};

module.exports = nextConfig;
