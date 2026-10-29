'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ChevronDown, FileText, Menu, Search, ShoppingCart, X } from 'lucide-react';
import { useCart } from '@/components/cart/cart-provider';
import type { CategoryNode } from '@/lib/catalog';

interface NavItem {
  href: string;
  label: string;
}

/**
 * סרגל נייד "צף" (סגנון כותרת float): ☰ · לוגו · חיפוש · עגלה. בראש הדף הוא בכותרת;
 * כשהוא יוצא מהמסך בגלילה — עותק קבוע מופיע בתחתית המסך (בהישג האגודל), ונעלם כשחוזרים למעלה.
 * ההמבורגר פותח מגירה עם קטגוריות ותתי-קטגוריות; החיפוש שולח GET ל-/catalog?q=.
 */
export function MobileFloatBar({
  basePath,
  logoUrl,
  name,
  nav,
  categories,
}: {
  basePath: string;
  logoUrl: string | null;
  name: string;
  nav: NavItem[];
  categories: CategoryNode[];
}) {
  const topRef = useRef<HTMLDivElement>(null);
  const [docked, setDocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const el = topRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      // רק כשהסרגל יצא מלמעלה (גלילה למטה), לא כשהוא מתחת למסך
      setDocked(!entry!.isIntersecting && entry!.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!menuOpen && !searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [menuOpen, searchOpen]);

  const home = basePath || '/';
  const bar = (where: 'top' | 'bottom') => (
    <Bar
      where={where}
      home={home}
      cartHref={`${basePath}/cart`}
      logoUrl={logoUrl}
      name={name}
      onMenu={() => setMenuOpen(true)}
      onSearch={() => setSearchOpen(true)}
    />
  );

  return (
    <div className="md:hidden">
      <div ref={topRef}>{bar('top')}</div>

      <div
        data-testid="float-bar"
        data-docked={docked ? 'true' : 'false'}
        aria-hidden={!docked}
        inert={!docked}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-6px_20px_rgba(0,0,0,0.08)] backdrop-blur transition-transform duration-300 ${
          docked ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {bar('bottom')}
      </div>

      {/* מגירה וחיפוש — ב-portal לשורש החנות: הכותרת היא stacking context (z-30) מתחת להודעת הסטיקי.
          נפתחים רק אחרי לחיצה, כך שאין רינדור בשרת */}
      {menuOpen &&
        createPortal(
          <div dir="rtl" className="fixed inset-0 z-50 bg-black/40" onClick={() => setMenuOpen(false)}>
            <nav
              aria-label="תפריט ראשי"
              onClick={(e) => {
                e.stopPropagation();
                if ((e.target as HTMLElement).closest('a')) setMenuOpen(false);
              }}
              className="absolute inset-y-0 right-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-surface shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
                <span className="font-bold text-brand-800">{name}</span>
                <button type="button" onClick={() => setMenuOpen(false)} aria-label="סגירת התפריט" className="rounded-full p-2 text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {categories.length > 0 && (
                <div className="border-b border-black/5 px-2 py-2">
                  <p className="px-2 py-1 text-xs font-bold text-gray-500">קטגוריות</p>
                  {categories.map((c) =>
                    c.children.length > 0 ? (
                      <details key={c.id} className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-2.5 text-[15px] font-semibold text-gray-900">
                          {c.name}
                          <ChevronDown className="h-4 w-4 text-gray-500 transition group-open:rotate-180" />
                        </summary>
                        <div className="mb-1 mr-3 border-r-2 border-[var(--accent)] pr-2">
                          <Link
                            href={`${basePath}/catalog?category=${encodeURIComponent(c.slug)}`}
                            className="block rounded-lg px-2 py-2 text-sm font-medium text-brand-700"
                          >
                            כל ה{c.name}
                          </Link>
                          {c.children.map((child) => (
                            <Link
                              key={child.id}
                              href={`${basePath}/catalog?category=${encodeURIComponent(child.slug)}`}
                              className="block rounded-lg px-2 py-2 text-sm text-gray-700"
                            >
                              {child.name}
                            </Link>
                          ))}
                        </div>
                      </details>
                    ) : (
                      <Link
                        key={c.id}
                        href={`${basePath}/catalog?category=${encodeURIComponent(c.slug)}`}
                        className="block rounded-lg px-2 py-2.5 text-[15px] font-semibold text-gray-900"
                      >
                        {c.name}
                      </Link>
                    ),
                  )}
                </div>
              )}
              <div className="px-2 py-2">
                {nav.map((item) => (
                  <Link key={item.href} href={item.href} className="block rounded-lg px-2 py-2.5 text-[15px] text-gray-800">
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>,
          portalRoot(),
        )}

      {searchOpen &&
        createPortal(
          <div dir="rtl" className="fixed inset-0 z-50 bg-black/40" onClick={() => setSearchOpen(false)}>
            <form
              action={`${basePath}/catalog`}
              method="get"
              role="search"
              onClick={(e) => e.stopPropagation()}
              className={`absolute inset-x-0 flex gap-2 bg-white p-3 shadow-lg ${docked ? 'bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]' : 'top-0'}`}
            >
              <input
                autoFocus
                type="search"
                name="q"
                placeholder="חיפוש צמח, פרח או מוצר..."
                aria-label="חיפוש"
                className="min-w-0 flex-1 rounded-full border border-gray-200 bg-surface px-4 py-2.5 text-base outline-none focus:border-[var(--brand)]"
              />
              <button className="rounded-full bg-[var(--accent)] px-4 text-sm font-bold text-white">חיפוש</button>
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="סגירת החיפוש" className="px-1 text-gray-500">
                <X className="h-5 w-5" />
              </button>
            </form>
          </div>,
          portalRoot(),
        )}
    </div>
  );
}

/** יעד ה-portal: שורש החנות (נושא את משתני הצבע), או body. */
function portalRoot(): HTMLElement {
  return document.querySelector<HTMLElement>('[data-store-root]') ?? document.body;
}

function Bar({
  where,
  home,
  cartHref,
  logoUrl,
  name,
  onMenu,
  onSearch,
}: {
  where: 'top' | 'bottom';
  home: string;
  cartHref: string;
  logoUrl: string | null;
  name: string;
  onMenu: () => void;
  onSearch: () => void;
}) {
  const { count, salesMode } = useCart();
  const icon = 'flex h-11 w-11 items-center justify-center rounded-full text-brand-800 active:bg-brand-50';
  const suffix = where === 'bottom' ? ' (סרגל תחתון)' : '';
  return (
    <div className="flex h-14 items-center gap-1 px-2">
      <button type="button" onClick={onMenu} aria-label={`תפריט וקטגוריות${suffix}`} className={icon}>
        <Menu className="h-6 w-6" />
      </button>
      <Link href={home} className="flex min-w-0 flex-1 items-center justify-center gap-2" aria-label={`${name} — דף הבית`}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-9 w-auto max-w-[9rem] object-contain" />
        ) : (
          <span className="truncate text-lg font-extrabold tracking-tight text-brand-800">{name}</span>
        )}
      </Link>
      <button type="button" onClick={onSearch} aria-label={`חיפוש${suffix}`} className={icon}>
        <Search className="h-5 w-5" />
      </button>
      {salesMode !== 'DISABLED' && (
        <Link
          href={cartHref}
          aria-label={`${salesMode === 'QUOTE' ? 'בקשת הצעת מחיר' : 'עגלת קניות'}, ${count} פריטים${suffix}`}
          className={`relative ${icon}`}
        >
          {salesMode === 'QUOTE' ? <FileText className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
          {count > 0 && (
            <span className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-bold text-white">
              {count}
            </span>
          )}
        </Link>
      )}
    </div>
  );
}
