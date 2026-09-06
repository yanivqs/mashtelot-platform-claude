import Link from 'next/link';
import type { Metadata } from 'next';
import { Leaf, Store, Search, ShieldCheck, ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { tenantOrigin } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'פלטפורמת משתלות SaaS | חנות מקוונת וקטלוג בוטני למשתלות',
  description:
    'הקימו חנות מקוונת למשתלה שלכם על דומיין משלכם, מבוססת קטלוג בוטני של אלפי צמחים עם מחירים, מלאי ותוכן ייחודי לכל משתלה.',
};

export const revalidate = 3600;

const features = [
  {
    icon: Store,
    title: 'חנות על דומיין משלכם',
    body: 'כל משתלה מקבלת חנות עצמאית עם מיתוג, לוגו, צבעים ופרטי קשר משלה.',
  },
  {
    icon: Leaf,
    title: 'קטלוג בוטני מרכזי',
    body: 'אלפי צמחים עם נתוני גידול, השקיה, תאורה ועונות פריחה - מוכנים לשימוש.',
  },
  {
    icon: Search,
    title: 'SEO מובנה',
    body: 'עמודי מוצר מרונדרים בשרת עם כותרות, תיאורים ו-Schema.org ייחודיים לכל דומיין.',
  },
  {
    icon: ShieldCheck,
    title: 'ניהול מלא',
    body: 'מלאי, מחירים, קופונים, פופאפים והזמנות - הכל מלוח בקרה אחד.',
  },
];

export default async function LandingPage() {
  const [plantCount, nurseryCount, demoNursery] = await Promise.all([
    prisma.plant.count(),
    prisma.nursery.count({ where: { isActive: true } }),
    prisma.nursery.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { subdomain: true, customDomain: true },
    }),
  ]);

  return (
    <div dir="rtl" className="bg-white text-gray-900">
      {/* Hero */}
      <section className="bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto max-w-6xl px-6 py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-100 px-4 py-1.5 text-sm font-medium text-brand-800">
            <Leaf className="h-4 w-4" />
            פלטפורמת SaaS למשתלות
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
            חנות מקוונת למשתלה שלכם,
            <br />
            מבוססת קטלוג בוטני חכם
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
            {plantCount.toLocaleString('he-IL')} צמחים במאגר · {nurseryCount} משתלות פעילות.
            נהלו מחירים, מלאי ותוכן ייחודי - ותנו ל-Google למצוא אתכם.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="mailto:hello@mashtelot.com"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 font-medium text-white transition hover:bg-brand-700"
            >
              פתחו חנות למשתלה
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {demoNursery && (
              <a
                href={tenantOrigin(demoNursery)}
                className="rounded-lg border border-brand-200 px-6 py-3 font-medium text-brand-800 transition hover:bg-brand-50"
              >
                לחנות הדגמה
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <Icon className="h-8 w-8 text-brand-600" />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} פלטפורמת משתלות · כל הזכויות שמורות
      </footer>
    </div>
  );
}
