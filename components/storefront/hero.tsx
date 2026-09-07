import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Nursery } from '@prisma/client';
import type { ThemeConfig } from '@/lib/theme';

interface HeroProps {
  nursery: Nursery;
  theme: ThemeConfig;
}

function ctaHref(theme: ThemeConfig): string {
  return theme.hero.ctaHref || '/catalog';
}

function Cta({ theme }: { theme: ThemeConfig }) {
  return (
    <div className="mt-9 flex flex-wrap items-center gap-3">
      <Link
        href={ctaHref(theme)}
        className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand,#16a34a)] px-7 py-3.5 font-medium text-white shadow-sm transition hover:brightness-95"
      >
        {theme.hero.ctaText || 'לכל הקטלוג'}
        <ArrowLeft className="h-4 w-4" />
      </Link>
    </div>
  );
}

export function Hero({ nursery, theme }: HeroProps) {
  const headline = theme.hero.headline || nursery.name;
  const subheadline =
    theme.hero.subheadline ||
    'צמחים, שתילים וציוד גינון מקצועי — עם מחירים מעודכנים והזמנה אונליין נוחה.';
  const image = theme.hero.imageUrl;

  if (theme.hero.layout === 'image' && image) {
    return (
      <section className="relative isolate overflow-hidden border-b border-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
        <div className="mx-auto max-w-5xl px-6 py-28 text-center text-white sm:py-36">
          <h1 className="text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">
            {headline}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/90">
            {subheadline}
          </p>
          <div className="flex justify-center">
            <Cta theme={theme} />
          </div>
        </div>
      </section>
    );
  }

  if (theme.hero.layout === 'split') {
    return (
      <section className="border-b border-gray-100 bg-gradient-to-b from-brand-50 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-20">
          <div>
            {nursery.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={nursery.logoUrl} alt={nursery.name} className="mb-5 h-14 w-auto" />
            )}
            <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
              {headline}
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-gray-600">{subheadline}</p>
            <Cta theme={theme} />
          </div>
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-brand-100 shadow-sm">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-7xl" aria-hidden>
                🌿
              </span>
            )}
          </div>
        </div>
      </section>
    );
  }

  // centered (ברירת מחדל)
  return (
    <section className="relative overflow-hidden border-b border-gray-100 bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-24">
        {nursery.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={nursery.logoUrl} alt={nursery.name} className="mx-auto mb-6 h-16 w-auto" />
        )}
        <h1 className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">{headline}</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600">{subheadline}</p>
        <div className="flex justify-center">
          <Cta theme={theme} />
        </div>
      </div>
    </section>
  );
}
