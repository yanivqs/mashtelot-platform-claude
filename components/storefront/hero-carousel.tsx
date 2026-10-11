'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CarouselSlide } from '@/lib/theme';

interface Fallback {
  headline: string;
  subheadline: string;
  ctaText: string;
  ctaHref: string;
}

/** קרוסלת תמונות ל-Hero: מעבר אוטומטי, חיצים, נקודות והחלקה במגע. */
export function HeroCarousel({
  slides,
  intervalSec,
  fallback,
}: {
  slides: CarouselSlide[];
  intervalSec: number;
  fallback: Fallback;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const count = slides.length;

  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = window.setTimeout(() => go(index + 1), intervalSec * 1000);
    return () => window.clearTimeout(t);
  }, [index, paused, count, intervalSec, go]);

  return (
    <section
      className="relative isolate overflow-hidden border-b border-gray-100 bg-gray-900"
      aria-roledescription="carousel"
      aria-label="תמונות ראשיות"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        // RTL: החלקה שמאלה = השקופית הבאה
        if (Math.abs(dx) > 40) go(dx < 0 ? index + 1 : index - 1);
      }}
    >
      <div className="relative h-[60vh] min-h-[360px] max-h-[620px]">
        {slides.map((slide, i) => {
          const active = i === index;
          const headline = slide.headline || fallback.headline;
          const sub = slide.subheadline || (slide.headline ? null : fallback.subheadline);
          const ctaHref = slide.ctaHref || fallback.ctaHref;
          const ctaText = slide.ctaText || fallback.ctaText;
          return (
            <div
              key={i}
              role="group"
              aria-roledescription="slide"
              aria-label={`${i + 1} מתוך ${count}`}
              aria-hidden={!active}
              className={`absolute inset-0 transition-opacity duration-700 ${
                active ? 'opacity-100' : 'pointer-events-none opacity-0'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.imageUrl}
                alt=""
                loading={i === 0 ? 'eager' : 'lazy'}
                className="absolute inset-0 -z-10 h-full w-full object-cover"
              />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/35 to-black/10" />
              <div className="mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-6 text-center text-white">
                {i === 0 ? (
                  <h1 className="text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">{headline}</h1>
                ) : (
                  <h2 className="text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">{headline}</h2>
                )}
                {sub && <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/90">{sub}</p>}
                <Link
                  href={ctaHref}
                  tabIndex={active ? 0 : -1}
                  className="mt-9 inline-flex items-center gap-2 rounded-xl bg-[var(--brand,#16a34a)] px-7 py-3.5 font-medium text-white shadow-sm transition hover:brightness-95"
                >
                  {ctaText}
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="השקופית הקודמת"
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition hover:bg-black/50"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="השקופית הבאה"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/30 p-2 text-white backdrop-blur transition hover:bg-black/50"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => go(i)}
                aria-label={`מעבר לשקופית ${i + 1}`}
                aria-current={i === index}
                className={`h-2.5 rounded-full transition-all ${
                  i === index ? 'w-7 bg-white' : 'w-2.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
