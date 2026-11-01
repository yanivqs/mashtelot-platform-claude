import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { Nursery } from '@prisma/client';
import { jsonLdHtml, tenantUrl } from '@/lib/seo';

export interface Crumb {
  label: string;
  /** נתיב באתר; בפריט האחרון (הדף הנוכחי) — ריק */
  href?: string;
}

/** פירורי לחם לניווט + BreadcrumbList לגוגל. הפריט הראשון "בית" נוסף אוטומטית. */
export function Breadcrumbs({
  nursery,
  items,
  className = 'mb-6',
}: {
  nursery: Pick<Nursery, 'subdomain' | 'customDomain'>;
  items: Crumb[];
  className?: string;
}) {
  const all: Crumb[] = [{ label: 'בית', href: '/' }, ...items];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.label,
      ...(c.href ? { item: tenantUrl(nursery, c.href) } : {}),
    })),
  };
  return (
    <nav aria-label="פירורי לחם" className={`text-sm text-gray-600 ${className}`}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }} />
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
        {all.map((c, i) => {
          const last = i === all.length - 1;
          return (
            <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1">
              {c.href && !last ? (
                <Link href={c.href} className="hover:text-gray-900 hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className="truncate text-gray-700">
                  {c.label}
                </span>
              )}
              {!last && <ChevronLeft className="h-3.5 w-3.5 shrink-0 text-gray-600" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** קישור לקטגוריה בקטלוג (כמו בתפריט). */
export function categoryCrumbHref(slug: string): string {
  return `/catalog?category=${encodeURIComponent(slug)}`;
}
