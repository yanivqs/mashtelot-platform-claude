'use client';

import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCart } from '@/components/cart/cart-provider';

export function CartBadge({ href }: { href: string }) {
  const { count } = useCart();
  return (
    <Link
      href={href}
      className="relative inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
      aria-label={`עגלת קניות, ${count} פריטים`}
    >
      <ShoppingCart className="h-5 w-5" />
      <span className="hidden sm:inline">עגלה</span>
      {count > 0 && (
        <span className="absolute -left-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--brand,#16a34a)] px-1 text-xs font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
