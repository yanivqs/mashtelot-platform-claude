'use client';

import { useState } from 'react';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { formatPrice } from '@/lib/utils';

export interface PurchaseVariant {
  id: string;
  name: string;
  price: number;
  /** מחיר לפני הנחה — רק כשגבוה מהמחיר */
  compareAt: number | null;
  available: number;
  /** תמונות לתצוגה: של הווריאנט קודם, ואחריהן של המוצר */
  images: string[];
}

/**
 * בחירת וריאנט ורכישה בדף המוצר (§7.01): המחיר, הזמינות והתמונות מתחלפים לפי הבחירה.
 * מוצר עם וריאנט יחיד נראה בדיוק כמו קודם (ללא בורר).
 */
export function ProductPurchase({
  productId,
  title,
  slug,
  optionLabel,
  variants,
  header,
  footer,
}: {
  productId: string;
  title: string;
  slug: string;
  optionLabel: string;
  variants: PurchaseVariant[];
  /** שם, סוג ושם לטיני (מרונדרים בשרת) */
  header: React.ReactNode;
  /** עובדות על הצמח (מרונדרות בשרת) */
  footer?: React.ReactNode;
}) {
  const initial = variants.find((v) => v.available > 0) ?? variants[0]!;
  const [selectedId, setSelectedId] = useState(initial.id);
  const [imageIdx, setImageIdx] = useState(0);
  const v = variants.find((x) => x.id === selectedId) ?? initial;
  const outOfStock = v.available <= 0;
  const choice = variants.length > 1;
  const image = v.images[Math.min(imageIdx, v.images.length - 1)] ?? null;

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <div>
        <div className="flex aspect-square items-center justify-center overflow-hidden rounded-2xl bg-brand-50 text-7xl">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt={choice && v.name ? `${title} — ${v.name}` : title} className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>🪴</span>
          )}
        </div>
        {v.images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {v.images.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setImageIdx(i)}
                aria-label={`תמונה ${i + 1}`}
                aria-pressed={i === imageIdx}
                className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${i === imageIdx ? 'border-[var(--brand,#16a34a)]' : 'border-transparent'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col">
        {header}

        <div className="mt-5 flex items-baseline gap-3">
          <span className="text-3xl font-bold text-gray-900" data-testid="variant-price">
            {formatPrice(v.price)}
          </span>
          {v.compareAt !== null && <span className="text-lg text-gray-400 line-through">{formatPrice(v.compareAt)}</span>}
        </div>
        <p className={`mt-1 text-sm ${outOfStock ? 'text-rose-600' : 'text-brand-700'}`}>
          {outOfStock ? 'אזל מהמלאי' : `במלאי (${v.available} יח')`}
        </p>

        {choice && (
          <fieldset className="mt-5">
            <legend className="mb-2 text-sm font-medium text-gray-700">{optionLabel}</legend>
            <div className="flex flex-wrap gap-2">
              {variants.map((opt) => {
                const active = opt.id === v.id;
                const soldOut = opt.available <= 0;
                return (
                  <label
                    key={opt.id}
                    className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
                      active
                        ? 'border-[var(--brand,#16a34a)] bg-brand-50 font-medium ring-1 ring-[var(--brand,#16a34a)]'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${soldOut ? 'text-gray-400' : 'text-gray-800'}`}
                  >
                    <input
                      type="radio"
                      name="variant"
                      value={opt.id}
                      checked={active}
                      onChange={() => {
                        setSelectedId(opt.id);
                        setImageIdx(0);
                      }}
                      className="sr-only"
                    />
                    {opt.name}
                    {soldOut && <span className="mr-1 text-xs">(אזל)</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="mt-6 max-w-sm">
          <AddToCartButton
            // מפתח לפי וריאנט — מאפס כמות והודעת "נוסף" בהחלפה
            key={v.id}
            withQuantity
            disabled={outOfStock}
            product={{
              productId,
              variantId: v.id,
              title: choice && v.name ? `${title} — ${v.name}` : title,
              price: v.price,
              image: v.images[0] ?? null,
              slug,
            }}
          />
        </div>

        {footer}
      </div>
    </div>
  );
}
