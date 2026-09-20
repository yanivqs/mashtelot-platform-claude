/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  experimental: {
    // ברירת המחדל (1MB) קטנה מדי לקובץ ה-CSV של ייבוא הקטלוג הבוטני (~1.5MB)
    serverActionsBodySizeLimit: '5mb',
  },
};

module.exports = nextConfig;