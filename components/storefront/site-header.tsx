import Link from 'next/link';
import type { Nursery } from '@prisma/client';
import { CartBadge } from './cart-badge';

export function SiteHeader({ nursery, basePath }: { nursery: Nursery; basePath: string }) {
  const nav = [
    { href: basePath || '/', label: 'בית' },
    { href: `${basePath}/catalog`, label: 'קטלוג' },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href={basePath || '/'} className="flex items-center gap-3">
          {nursery.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nursery.logoUrl} alt={nursery.name} className="h-9 w-auto" />
          ) : (
            <span className="text-xl" aria-hidden>
              🌿
            </span>
          )}
          <span className="text-lg font-bold text-gray-900">{nursery.name}</span>
        </Link>

        <nav className="flex items-center gap-1">
          {nav.map((item) => (
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
      </div>
    </header>
  );
}
