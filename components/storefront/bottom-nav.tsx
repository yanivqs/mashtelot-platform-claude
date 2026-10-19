'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Search, Phone, ShoppingCart, FileText, X } from 'lucide-react';
import { useCart } from '@/components/cart/cart-provider';
import { isNavActive } from '@/lib/nav-active';

/**
 * ניווט תחתון במובייל (R01-04): בית · קטלוג · חיפוש · צור קשר · עגלה.
 * מוסתר במחשב (md ומעלה). החיפוש נפתח כמגירה תחתונה ושולח GET ל-/catalog?q=.
 */
export function BottomNav({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const { count, salesMode } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  const home = basePath || '/';
  const isActive = (href: string) => isNavActive(pathname, href, home);

  const isQuote = salesMode === 'QUOTE';
  const cartHref = `${basePath}/cart`;

  const item = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium';
  const tone = (active: boolean) => (active ? 'text-[var(--brand,#16a34a)]' : 'text-gray-600');

  return (
    <>
      {/* מקום לסרגל כדי שלא יסתיר את תחתית הדף */}
      <div className="h-16 md:hidden" aria-hidden />

      {searchOpen && (
        <div className="fixed inset-0 z-40 bg-black/30 md:hidden" onClick={() => setSearchOpen(false)}>
          <form
            action={`${basePath}/catalog`}
            method="get"
            role="search"
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-x-0 bottom-16 flex gap-2 border-t border-gray-100 bg-white p-3 shadow-lg"
          >
            <input
              ref={inputRef}
              type="search"
              name="q"
              placeholder="חיפוש צמח או מוצר..."
              aria-label="חיפוש"
              className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-base outline-none focus:border-[var(--brand,#16a34a)]"
            />
            <button className="rounded-lg bg-[var(--brand,#16a34a)] px-4 text-sm font-medium text-white">
              חיפוש
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              aria-label="סגירת החיפוש"
              className="rounded-lg px-2 text-gray-500"
            >
              <X className="h-5 w-5" />
            </button>
          </form>
        </div>
      )}

      <nav
        aria-label="ניווט תחתון"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <Link href={home} className={`${item} ${tone(isActive(home))}`} aria-current={isActive(home) ? 'page' : undefined}>
          <Home className="h-5 w-5" />
          בית
        </Link>
        <Link
          href={`${basePath}/catalog`}
          className={`${item} ${tone(isActive(`${basePath}/catalog`))}`}
          aria-current={isActive(`${basePath}/catalog`) ? 'page' : undefined}
        >
          <LayoutGrid className="h-5 w-5" />
          קטלוג
        </Link>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          className={`${item} ${tone(searchOpen)}`}
          aria-expanded={searchOpen}
        >
          <Search className="h-5 w-5" />
          חיפוש
        </button>
        <Link
          href={`${basePath}/contact`}
          className={`${item} ${tone(isActive(`${basePath}/contact`))}`}
          aria-current={isActive(`${basePath}/contact`) ? 'page' : undefined}
        >
          <Phone className="h-5 w-5" />
          צור קשר
        </Link>
        {salesMode !== 'DISABLED' && (
          <Link
            href={cartHref}
            className={`relative ${item} ${tone(isActive(cartHref))}`}
            aria-label={isQuote ? `בקשת הצעת מחיר, ${count} פריטים` : `עגלת קניות, ${count} פריטים`}
          >
            {isQuote ? <FileText className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
            {isQuote ? 'הצעה' : 'עגלה'}
            {count > 0 && (
              <span className="absolute right-1/2 top-1 flex h-4 min-w-4 translate-x-4 items-center justify-center rounded-full bg-[var(--brand,#16a34a)] px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </Link>
        )}
      </nav>
    </>
  );
}
