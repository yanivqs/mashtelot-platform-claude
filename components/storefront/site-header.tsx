import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { Nursery } from '@prisma/client';
import type { CategoryNode } from '@/lib/catalog';
import { CartBadge } from './cart-badge';
import { MobileMenu } from './mobile-menu';

function categoryHref(basePath: string, slug: string) {
  return `${basePath}/catalog?category=${encodeURIComponent(slug)}`;
}

/** תפריט קטגוריות נפתח (מחשב): קטגוריות-על ותתי-הקטגוריות שלהן. */
function CategoriesMenu({ basePath, categories }: { basePath: string; categories: CategoryNode[] }) {
  const wide = categories.some((c) => c.children.length > 0);
  return (
    <div className="group relative">
      <Link
        href={`${basePath}/catalog`}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        aria-haspopup="true"
      >
        קטגוריות
        <ChevronDown className="h-3.5 w-3.5 transition group-hover:rotate-180" />
      </Link>
      {/* pt-2 שומר על רצף ה-hover בין הכפתור לפאנל */}
      <div className="invisible absolute right-0 top-full z-40 pt-2 opacity-0 transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
        <div
          className={`max-h-[70vh] overflow-y-auto rounded-xl border border-gray-100 bg-white p-4 shadow-lg ${
            wide ? 'grid w-[min(42rem,90vw)] grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3' : 'w-56'
          }`}
        >
          {categories.map((c) => (
            <div key={c.id} className={wide ? '' : 'py-0.5'}>
              <Link
                href={categoryHref(basePath, c.slug)}
                className="block rounded-md px-2 py-1 text-sm font-semibold text-gray-900 hover:bg-gray-50"
              >
                {c.name}
              </Link>
              {c.children.length > 0 && (
                <ul className="mt-0.5">
                  {c.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={categoryHref(basePath, child.slug)}
                        className="block rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      >
                        {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader({
  nursery,
  basePath,
  sticky = true,
  navPages = [],
  categories = [],
}: {
  nursery: Nursery;
  basePath: string;
  sticky?: boolean;
  navPages?: { slug: string; title: string }[];
  categories?: CategoryNode[];
}) {
  const nav = [
    { href: basePath || '/', label: 'בית' },
    { href: `${basePath}/catalog`, label: 'קטלוג' },
    ...navPages.map((p) => ({ href: `${basePath}/${p.slug}`, label: p.title })),
    { href: `${basePath}/contact`, label: 'צור קשר' },
  ];

  return (
    <header
      className={`${
        sticky ? 'sticky top-0' : ''
      } z-30 border-b border-gray-100 bg-white/90 backdrop-blur`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href={basePath || '/'} className="flex min-w-0 items-center gap-3">
          {nursery.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nursery.logoUrl} alt={nursery.name} className="h-9 w-auto" />
          ) : (
            <span className="text-xl" aria-hidden>
              🌿
            </span>
          )}
          <span className="truncate text-lg font-bold text-gray-900">{nursery.name}</span>
        </Link>

        {/* מחשב */}
        <nav className="hidden items-center gap-1 md:flex">
          {nav.slice(0, 2).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
          {categories.length > 0 && <CategoriesMenu basePath={basePath} categories={categories} />}
          {nav.slice(2).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
          <CartBadge href={`${basePath}/cart`} />
        </nav>

        {/* נייד */}
        <div className="flex items-center gap-1 md:hidden">
          <CartBadge href={`${basePath}/cart`} />
          <MobileMenu>
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-lg px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
                >
                  {item.label}
                </Link>
              ))}
              {categories.length > 0 && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <p className="px-3 py-1 text-xs font-bold uppercase text-gray-400">קטגוריות</p>
                  {categories.map((c) => (
                    <div key={c.id}>
                      <Link
                        href={categoryHref(basePath, c.slug)}
                        className="block rounded-lg px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
                      >
                        {c.name}
                      </Link>
                      {c.children.map((child) => (
                        <Link
                          key={child.id}
                          href={categoryHref(basePath, child.slug)}
                          className="block rounded-lg py-1 pl-3 pr-7 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
