'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, ShoppingCart, FileText } from 'lucide-react';
import { useCart, type CartItem } from './cart-provider';
import { cn } from '@/lib/utils';

interface Props {
  product: Omit<CartItem, 'quantity'>;
  disabled?: boolean;
  className?: string;
  withQuantity?: boolean;
}

export function AddToCartButton({ product, disabled, className, withQuantity }: Props) {
  const { add, salesMode } = useCart();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function handleAdd() {
    add(product, qty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  if (salesMode === 'DISABLED') {
    return (
      <Link
        href="/contact"
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50',
          className,
        )}
      >
        צרו קשר לפרטים ורכישה
      </Link>
    );
  }

  const isQuote = salesMode === 'QUOTE';
  const idleLabel = isQuote ? 'הוסף לבקשת הצעה' : 'הוסף לעגלה';
  const doneLabel = isQuote ? 'נוסף לבקשה' : 'נוסף לעגלה';

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {withQuantity && (
        <div className="flex items-center rounded-lg border border-gray-200">
          <button
            type="button"
            aria-label="הפחת כמות"
            className="px-3 py-2 text-lg leading-none text-gray-500 hover:text-gray-900"
            onClick={() => setQty((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-medium">{qty}</span>
          <button
            type="button"
            aria-label="הוסף כמות"
            className="px-3 py-2 text-lg leading-none text-gray-500 hover:text-gray-900"
            onClick={() => setQty((q) => q + 1)}
          >
            +
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={handleAdd}
        disabled={disabled}
        className={cn(
          'inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition',
          'bg-[var(--brand,#16a34a)] hover:brightness-95',
          'disabled:cursor-not-allowed disabled:bg-gray-300',
        )}
      >
        {added ? (
          <>
            <Check className="h-4 w-4" /> {doneLabel}
          </>
        ) : disabled ? (
          'אזל מהמלאי'
        ) : (
          <>
            {isQuote ? <FileText className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {idleLabel}
          </>
        )}
      </button>
    </div>
  );
}
