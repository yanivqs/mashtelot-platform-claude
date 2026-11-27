import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "פלטפורמת משתלות SaaS",
  description: "מערכת ניהול וחנויות מקוונות למשתלות",
  // ברירת מחדל; חנות של משתלה יכולה להחליף באייקון משלה (Nursery.faviconUrl, app/[tenant]/layout.tsx)
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // התאמות הנגישות של הגולש נוספות ל-<html> לפני ההידרציה (lib/a11y-settings.ts)
    <html lang="he" dir="rtl" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}