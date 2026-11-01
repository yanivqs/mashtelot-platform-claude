import Link from 'next/link';
import { ArrowLeft, Clock, Mail, MapPin, Phone } from 'lucide-react';
import type { Nursery } from '@prisma/client';
import { sanitizeRichHtml } from '@/lib/sanitize';
import { normalizeOpeningHours } from '@/lib/theme';
import { youtubeId, type Block, type BlockOf } from '@/lib/page-blocks';
import type { BlockData } from '@/lib/page-builder';
import { ProductCard } from '@/components/storefront/product-card';
import { HeroCarousel } from '@/components/storefront/hero-carousel';

/**
 * R03 Page Builder — רינדור הבלוקים בחנות (ובתצוגה המקדימה בפורטל — אותם רכיבים).
 * הטקסט העשיר נוקה בשמירה, ומנוקה שוב כאן (הגנה כפולה).
 */

const RICH =
  'leading-relaxed text-gray-700 [&_a]:text-brand-700 [&_a]:underline [&_blockquote]:border-r-2 [&_blockquote]:border-gray-300 [&_blockquote]:pr-3 [&_blockquote]:text-gray-600 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-bold [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pr-6 [&_p]:my-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pr-6';

function visibility(b: Block): string {
  if (b.hideOnMobile && b.hideOnDesktop) return 'hidden';
  if (b.hideOnMobile) return 'hidden md:block';
  if (b.hideOnDesktop) return 'md:hidden';
  return '';
}

function CtaLink({ text, href, light = false }: { text: string; href: string; light?: boolean }) {
  if (!text || !href) return null;
  const external = /^https:/i.test(href);
  const cls = light
    ? 'inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-medium text-brand-800 shadow-sm transition hover:bg-brand-50'
    : 'inline-flex items-center gap-2 rounded-xl bg-[var(--brand,#16a34a)] px-6 py-3 font-medium text-white shadow-sm transition hover:brightness-95';
  const body = (
    <>
      {text}
      <ArrowLeft className="h-4 w-4" />
    </>
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}

function Heading({ level, className, children }: { level: 1 | 2; className: string; children: React.ReactNode }) {
  return level === 1 ? <h1 className={className}>{children}</h1> : <h2 className={className}>{children}</h2>;
}

function HeroBlock({ b, nursery, level }: { b: BlockOf<'hero'>; nursery: Nursery; level: 1 | 2 }) {
  const headline = b.headline || nursery.name;
  if (b.variant === 'carousel' && b.slides.some((s) => s.imageUrl)) {
    return (
      <HeroCarousel
        slides={b.slides.filter((s) => s.imageUrl)}
        intervalSec={6}
        fallback={{ headline, subheadline: b.subheadline, ctaText: b.ctaText || 'לכל הקטלוג', ctaHref: b.ctaHref || '/catalog' }}
      />
    );
  }
  const vid = b.variant === 'video' ? youtubeId(b.videoUrl) : null;
  if (vid) {
    return (
      <section className="border-b border-gray-100 bg-gray-950 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 md:grid-cols-2">
          <div>
            <Heading level={level} className="text-4xl font-bold tracking-tight sm:text-5xl">
              {headline}
            </Heading>
            {b.subheadline && <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/80">{b.subheadline}</p>}
            <div className="mt-8">
              <CtaLink text={b.ctaText} href={b.ctaHref} />
            </div>
          </div>
          <div className="aspect-video overflow-hidden rounded-2xl bg-black">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${vid}?rel=0`}
              title={headline}
              loading="lazy"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full"
            />
          </div>
        </div>
      </section>
    );
  }
  if (b.variant === 'image' && b.imageUrl) {
    return (
      <section className="relative isolate overflow-hidden border-b border-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={b.imageUrl} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
        <div className="mx-auto max-w-5xl px-6 py-28 text-center text-white sm:py-36">
          <Heading level={level} className="text-4xl font-bold tracking-tight drop-shadow-sm sm:text-5xl">
            {headline}
          </Heading>
          {b.subheadline && <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-white/90">{b.subheadline}</p>}
          <div className="mt-9 flex justify-center">
            <CtaLink text={b.ctaText} href={b.ctaHref} />
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="border-b border-gray-100 bg-gradient-to-b from-brand-50 to-white">
      <div className="mx-auto max-w-5xl px-6 py-20 text-center sm:py-24">
        <Heading level={level} className="text-4xl font-bold tracking-tight text-brand-900 sm:text-5xl">
          {headline}
        </Heading>
        {b.subheadline && <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-gray-600">{b.subheadline}</p>}
        <div className="mt-9 flex justify-center">
          <CtaLink text={b.ctaText} href={b.ctaHref} />
        </div>
      </div>
    </section>
  );
}

function SectionTitle({ title }: { title: string }) {
  return title ? <h2 className="mb-6 text-2xl font-bold text-gray-900">{title}</h2> : null;
}

function BlockView({ b, nursery, data, level }: { b: Block; nursery: Nursery; data: BlockData; level: 1 | 2 }) {
  switch (b.type) {
    case 'hero':
      return <HeroBlock b={b} nursery={nursery} level={level} />;
    case 'text':
      return (
        <section className={`mx-auto max-w-3xl px-6 py-10 ${b.align === 'center' ? 'text-center' : ''}`}>
          <div className={RICH} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(b.html) }} />
        </section>
      );
    case 'imageText':
      return (
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-6 py-12 md:grid-cols-2">
          <div className={`aspect-[4/3] overflow-hidden rounded-2xl bg-brand-50 ${b.imageSide === 'left' ? 'md:order-2' : ''}`}>
            {b.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.imageUrl} alt={b.title} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-6xl" aria-hidden>
                🌿
              </span>
            )}
          </div>
          <div>
            {b.title && <h2 className="text-2xl font-bold text-gray-900">{b.title}</h2>}
            <div className={RICH} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(b.html) }} />
            <div className="mt-6">
              <CtaLink text={b.ctaText} href={b.ctaHref} />
            </div>
          </div>
        </section>
      );
    case 'products': {
      const items = data.products[b.id] ?? [];
      return (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="mb-6 flex items-baseline justify-between">
            {b.title ? <h2 className="text-2xl font-bold text-gray-900">{b.title}</h2> : <span />}
            <Link href="/catalog" className="text-sm font-medium text-brand-700 hover:underline">
              הצג הכל
            </Link>
          </div>
          {items.length === 0 ? (
            <p className="rounded-xl bg-gray-50 p-10 text-center text-gray-600">הקטלוג מתעדכן. חזרו בקרוב.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
              {items.map((p) => (
                <ProductCard key={p.id} product={p} basePath="" categoryLabel={b.showCategory ? data.productCategories[p.id] : null} />
              ))}
            </div>
          )}
        </section>
      );
    }
    case 'categories': {
      const cats = data.categories[b.id] ?? [];
      if (cats.length === 0) return null;
      return (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <SectionTitle title={b.title} />
          {/* נייד: שורה אחת בגלילה אופקית; מחשב: רשת */}
          <div className="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
            {cats.map((c) => (
              <Link
                key={c.id}
                href={`/catalog?category=${encodeURIComponent(c.slug)}`}
                className="flex min-h-16 w-32 shrink-0 items-center justify-center rounded-2xl border border-black/5 bg-white p-3 text-center font-bold text-brand-800 shadow-sm transition hover:border-[var(--accent,#16a34a)] hover:text-[var(--accent-strong,#15803d)] sm:min-h-20 sm:w-auto sm:p-4"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      );
    }
    case 'contentCards': {
      const cards = data.cards[b.id] ?? [];
      if (cards.length === 0) return null;
      return (
        <section className="mx-auto max-w-6xl px-6 py-12">
          <SectionTitle title={b.title} />
          {/* נייד: גלילה אופקית; מחשב: רשת */}
          <div className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {cards.map((c, i) => {
              const inner = (
                <>
                  <div className="aspect-[16/10] overflow-hidden bg-brand-50">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-5xl" aria-hidden>
                        🌿
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="text-lg font-bold leading-snug text-gray-900 group-hover:text-brand-700">{c.title}</h3>
                    {c.text && <p className="line-clamp-3 text-sm leading-relaxed text-gray-600">{c.text}</p>}
                    {c.href && (
                      <span className="mt-auto inline-flex items-center gap-1 pt-1 text-sm font-bold text-[var(--accent-strong,#15803d)]">
                        לקריאה
                        <ArrowLeft className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                </>
              );
              const cls = 'group flex w-[78%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:shadow-md sm:w-auto';
              if (!c.href) return <div key={i} className={cls}>{inner}</div>;
              return /^https:/i.test(c.href) ? (
                <a key={i} href={c.href} target="_blank" rel="noopener noreferrer" className={cls}>
                  {inner}
                </a>
              ) : (
                <Link key={i} href={c.href} className={cls}>
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      );
    }
    case 'cta':
      return (
        <section className="mx-auto max-w-6xl px-6 py-10">
          <div className={`rounded-2xl px-6 py-10 text-center sm:px-12 ${b.tone === 'brand' ? 'bg-[var(--brand,#16a34a)] text-white' : 'border border-brand-100 bg-brand-50 text-brand-900'}`}>
            <h2 className="text-2xl font-bold sm:text-3xl">{b.title}</h2>
            {b.text && <p className={`mx-auto mt-3 max-w-2xl whitespace-pre-line ${b.tone === 'brand' ? 'text-white/90' : 'text-gray-700'}`}>{b.text}</p>}
            <div className="mt-6 flex justify-center">
              <CtaLink text={b.ctaText} href={b.ctaHref} light={b.tone === 'brand'} />
            </div>
          </div>
        </section>
      );
    case 'faq':
      if (b.items.length === 0) return null;
      return (
        <section className="mx-auto max-w-3xl px-6 py-12">
          <SectionTitle title={b.title} />
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
            {b.items.map((it, i) => (
              <details key={i} className="group px-5 py-4">
                <summary className="cursor-pointer list-none font-medium text-gray-900 marker:hidden">{it.q}</summary>
                <p className="mt-2 whitespace-pre-line text-gray-700">{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      );
    case 'contact': {
      const hours = b.showHours ? normalizeOpeningHours(nursery.openingHours) : [];
      const address = b.showAddress ? [nursery.addressLine, nursery.city].filter(Boolean).join(', ') : '';
      return (
        <section className="mx-auto max-w-4xl px-6 py-12">
          <SectionTitle title={b.title} />
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-3 text-gray-700">
              {b.showPhone && nursery.phoneNumber && (
                <a href={`tel:${nursery.phoneNumber}`} className="flex items-center gap-3 hover:text-brand-700">
                  <Phone className="h-5 w-5 text-brand-600" />
                  <span dir="ltr">{nursery.phoneNumber}</span>
                </a>
              )}
              {b.showPhone && nursery.contactEmail && (
                <a href={`mailto:${nursery.contactEmail}`} className="flex items-center gap-3 hover:text-brand-700">
                  <Mail className="h-5 w-5 text-brand-600" />
                  <span>{nursery.contactEmail}</span>
                </a>
              )}
              {address && (
                <p className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  <span>{address}</span>
                </p>
              )}
            </div>
            {hours.length > 0 && (
              <div className="rounded-2xl border border-gray-100 p-5">
                <p className="mb-3 flex items-center gap-2 font-medium text-gray-900">
                  <Clock className="h-5 w-5 text-brand-600" />
                  שעות פתיחה
                </p>
                <dl className="space-y-1 text-sm text-gray-700">
                  {hours.map((h, i) => (
                    <div key={i} className="flex justify-between gap-4">
                      <dt>{h.label}</dt>
                      <dd>{h.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </section>
      );
    }
    case 'spacer':
      return <div aria-hidden className={b.size === 'sm' ? 'h-6' : b.size === 'lg' ? 'h-24' : 'h-12'} />;
  }
}

/**
 * רשימת הבלוקים. `title` — כותרת H1 לעמוד כשאין Hero בראש הדף (בדף הבית: שם המשתלה, מוסתר ויזואלית).
 */
export function BlockList({
  blocks,
  nursery,
  data,
  title,
  showTitle = false,
}: {
  blocks: Block[];
  nursery: Nursery;
  data: BlockData;
  title: string;
  showTitle?: boolean;
}) {
  const heroFirst = blocks[0]?.type === 'hero';
  return (
    <div dir="rtl">
      {!heroFirst &&
        (showTitle ? (
          <div className="mx-auto max-w-3xl px-6 pt-12">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
          </div>
        ) : (
          <h1 className="sr-only">{title}</h1>
        ))}
      {blocks.map((b, i) => (
        <div key={b.id} className={visibility(b)} data-block={b.type}>
          <BlockView b={b} nursery={nursery} data={data} level={heroFirst && i === 0 ? 1 : 2} />
        </div>
      ))}
    </div>
  );
}
