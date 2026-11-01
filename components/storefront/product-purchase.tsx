'use client';

import { useState } from 'react';
import { AddToCartButton } from '@/components/cart/add-to-cart-button';
import { formatPrice } from '@/lib/utils';
import { optionMatrix, type OptionValue } from '@/lib/variants';

export interface PurchaseVariant {
  id: string;
  name: string;
  option1: string | null;
  option2: string | null;
  colorHex: string | null;
  price: number;
  /** מחיר לפני הנחה — רק כשגבוה מהמחיר */
  compareAt: number | null;
  available: number;
  /** תמיד במלאי — בלי הצגת כמות */
  unlimited?: boolean;
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
  option2Label,
  variants,
  header,
  footer,
  preview = false,
}: {
  productId: string;
  title: string;
  slug: string;
  optionLabel: string;
  /** שם הציר השני (רק כשיש וריאנטים עם ערך בציר השני) */
  option2Label?: string;
  variants: PurchaseVariant[];
  /** שם, סוג ושם לטיני (מרונדרים בשרת) */
  header: React.ReactNode;
  /** עובדות על הצמח (מרונדרות בשרת) */
  footer?: React.ReactNode;
  /** תצוגה מקדימה מהאדמין (מוצר מוסתר) — בלי הוספה לסל */
  preview?: boolean;
}) {
  const initial = variants.find((v) => v.available > 0) ?? variants[0]!;
  const [selectedId, setSelectedId] = useState(initial.id);
  const [imageIdx, setImageIdx] = useState(0);
  const v = variants.find((x) => x.id === selectedId) ?? initial;
  const outOfStock = v.available <= 0;
  const choice = variants.length > 1;
  const image = v.images[Math.min(imageIdx, v.images.length - 1)] ?? null;
  const matrix = optionMatrix(variants);
  const twoAxes = matrix.axis2.length > 0;
  const sel1 = v.option1?.trim() || v.name.trim();
  const sel2 = v.option2?.trim() ?? '';
  const select = (next: PurchaseVariant | undefined) => {
    if (!next) return;
    setSelectedId(next.id);
    setImageIdx(0);
  };
  // בחירה בציר אחד: אם השילוב עם הציר השני הנוכחי קיים — אותו; אחרת הראשון הזמין עם הערך
  const pick1 = (value: string) =>
    select(
      matrix.find(value, sel2) ??
        variants.find((x) => (x.option1?.trim() || x.name.trim()) === value && x.available > 0) ??
        variants.find((x) => (x.option1?.trim() || x.name.trim()) === value),
    );
  const pick2 = (value: string) => select(matrix.find(sel1, value));

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
          {outOfStock ? 'אזל מהמלאי' : v.unlimited ? 'במלאי' : `במלאי (${v.available} יח')`}
        </p>

        {choice && twoAxes && (
          <>
            <OptionGroup
              label={optionLabel}
              name="option1"
              values={matrix.axis1}
              selected={sel1}
              state={(o) => {
                const any = variants.filter((x) => (x.option1?.trim() || x.name.trim()) === o.value);
                return any.some((x) => x.available > 0) ? 'ok' : 'soldout';
              }}
              onPick={pick1}
            />
            <OptionGroup
              label={option2Label ?? 'צבע'}
              name="option2"
              values={matrix.axis2}
              selected={sel2}
              state={(o) => {
                const combo = matrix.find(sel1, o.value);
                return !combo ? 'missing' : combo.available > 0 ? 'ok' : 'soldout';
              }}
              onPick={pick2}
            />
          </>
        )}

        {choice && !twoAxes && matrix.axis1.some((o) => o.colorHex) && (
          <OptionGroup
            label={optionLabel}
            name="option1"
            values={matrix.axis1}
            selected={sel1}
            state={(o) => (matrix.find(o.value, '')?.available ?? 0) > 0 ? 'ok' : 'soldout'}
            onPick={(value) => select(matrix.find(value, ''))}
          />
        )}

        {choice && !twoAxes && !matrix.axis1.some((o) => o.colorHex) && (
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
          {preview ? (
            <p className="rounded-lg bg-gray-100 px-4 py-3 text-sm text-gray-600">תצוגה מקדימה — לא ניתן להוסיף לסל</p>
          ) : (
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
          )}
        </div>

        {footer}
      </div>
    </div>
  );
}

type OptionState = 'ok' | 'soldout' | 'missing';

/** קבוצת ערכים בציר אחד: כפתורים, או עיגולי צבע כשלערכים יש דוגמית. שילוב שלא קיים — מושבת. */
function OptionGroup({
  label,
  name,
  values,
  selected,
  state,
  onPick,
}: {
  label: string;
  name: string;
  values: OptionValue[];
  selected: string;
  state: (o: OptionValue) => OptionState;
  onPick: (value: string) => void;
}) {
  const swatches = values.some((o) => o.colorHex);
  return (
    <fieldset className="mt-5">
      <legend className="mb-2 text-sm font-medium text-gray-700">
        {label}
        {swatches && selected && <span className="mr-1 font-normal text-gray-500">: {selected}</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
        {values.map((o) => {
          const st = state(o);
          const active = o.value === selected;
          const disabled = st === 'missing';
          return (
            <label
              key={o.value}
              title={o.value}
              className={`relative transition ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'} ${
                swatches
                  ? `flex h-10 w-10 items-center justify-center rounded-full border-2 ${active ? 'border-[var(--brand,#16a34a)]' : 'border-transparent'}`
                  : `rounded-lg border px-3 py-2 text-sm ${
                      active
                        ? 'border-[var(--brand,#16a34a)] bg-brand-50 font-medium ring-1 ring-[var(--brand,#16a34a)]'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${st === 'soldout' ? 'text-gray-400' : 'text-gray-800'}`
              }`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={active}
                disabled={disabled}
                onChange={() => onPick(o.value)}
                className="sr-only"
                aria-label={swatches ? `${o.value}${st === 'soldout' ? ' (אזל)' : ''}` : undefined}
              />
              {swatches ? (
                <span
                  aria-hidden
                  className={`block h-7 w-7 rounded-full border border-black/10`}
                  style={{ backgroundColor: o.colorHex ?? '#e5e7eb' }}
                />
              ) : (
                <>
                  {o.value}
                  {st === 'soldout' && <span className="mr-1 text-xs">(אזל)</span>}
                </>
              )}
              {swatches && st === 'soldout' && (
                <span aria-hidden className="pointer-events-none absolute h-0.5 w-9 rotate-45 bg-gray-500/70" />
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
