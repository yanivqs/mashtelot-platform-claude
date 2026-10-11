'use client';

import { useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import { printLinePrice, type PriceTier } from '@/lib/print-pricing';
import { ImageUpload } from '@/components/admin/image-upload';
import { createPrintOrder } from './actions';

export interface PrintProductVM {
  id: string;
  title: string;
  category: string | null;
  description: string | null;
  specs: string | null;
  imageUrl: string | null;
  basePrice: string;
  unitLabel: string | null;
  minQuantity: number;
  leadTimeDays: number | null;
  priceTiers: PriceTier[];
  requiresArtwork: boolean;
  allowOptions: boolean;
}

export interface PrintOptionVM {
  id: string;
  optionName: string;
  extraPrice: string;
}

interface RowState {
  qty: string;
  text: string;
  optionIds: string[];
}

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const empty: RowState = { qty: '', text: '', optionIds: [] };

export function PrintOrderForm({
  products,
  options,
}: {
  products: PrintProductVM[];
  options: PrintOptionVM[];
}) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [notes, setNotes] = useState('');
  const [artworkUrl, setArtworkUrl] = useState('');
  const [resetCount, setResetCount] = useState(0);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const update = (id: string, patch: Partial<RowState>) =>
    setRows((r) => ({ ...r, [id]: { ...(r[id] ?? empty), ...patch } }));

  const lines = useMemo(
    () =>
      products.map((p) => {
        const row = rows[p.id] ?? empty;
        const qty = parseInt(row.qty, 10);
        const selected = options
          .filter((o) => row.optionIds.includes(o.id))
          .map((o) => ({ name: o.optionName, extraPrice: Number(o.extraPrice) }));
        const valid = Number.isFinite(qty) && qty > 0;
        const price = valid
          ? printLinePrice(Number(p.basePrice), p.priceTiers, qty, selected)
          : null;
        return { product: p, row, qty: valid ? qty : 0, price };
      }),
    [products, rows, options],
  );

  const total = lines.reduce((sum, l) => sum + (l.price?.total ?? 0), 0);
  const needsArtwork = lines.some((l) => l.qty > 0 && l.product.requiresArtwork);

  const groups = useMemo(() => {
    const map = new Map<string, typeof lines>();
    for (const l of lines) {
      const key = l.product.category || 'מוצרי דפוס';
      map.set(key, [...(map.get(key) ?? []), l]);
    }
    return [...map];
  }, [lines]);

  async function submit() {
    setMsg(null);
    setPending(true);
    const items = lines
      .filter((l) => l.qty > 0)
      .map((l) => ({
        productId: l.product.id,
        quantity: l.qty,
        customText: l.row.text,
        optionIds: l.row.optionIds,
      }));

    const res = await createPrintOrder({ items, notes, artworkUrl });
    setPending(false);
    if (res.ok) {
      setRows({});
      setNotes('');
      setArtworkUrl('');
      setResetCount((c) => c + 1);
      setMsg({ ok: true, text: 'ההזמנה נשלחה לבית הדפוס של הפלטפורמה.' });
    } else {
      setMsg({ ok: false, text: res.error ?? 'שגיאה' });
    }
  }

  return (
    <div className="space-y-6">
      {groups.map(([category, groupLines]) => (
        <section key={category}>
          <h2 className="mb-2 text-sm font-bold text-gray-500">{category}</h2>
          <div className="space-y-3">
            {groupLines.map(({ product: p, row, qty, price }) => {
              const unit = p.unitLabel || 'יח׳';
              const belowMin = qty > 0 && qty < p.minQuantity;
              return (
                <div key={p.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex gap-4">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{p.title}</p>
                          {p.description && <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>}
                        </div>
                        <input
                          type="number"
                          min="0"
                          placeholder={`כמות (מינ׳ ${p.minQuantity})`}
                          value={row.qty}
                          onChange={(e) => update(p.id, { qty: e.target.value })}
                          className={`w-36 rounded-lg border px-3 py-2 text-sm outline-none focus:border-brand-500 ${
                            belowMin ? 'border-red-300' : 'border-gray-200'
                          }`}
                        />
                      </div>

                      <p className="mt-1 text-sm text-gray-700">
                        {formatPrice(p.basePrice)} ל{unit} · מינ׳ {p.minQuantity.toLocaleString('he-IL')}
                        {p.leadTimeDays !== null && (
                          <span className="text-gray-400"> · אספקה תוך {p.leadTimeDays} ימים</span>
                        )}
                      </p>
                      {p.priceTiers.length > 0 && (
                        <p className="mt-1 flex flex-wrap gap-1.5 text-xs">
                          {p.priceTiers.map((t) => (
                            <span key={t.minQty} className="rounded-full bg-green-50 px-2 py-0.5 text-green-800">
                              מ-{t.minQty.toLocaleString('he-IL')}: {formatPrice(t.unitPrice)}
                            </span>
                          ))}
                        </p>
                      )}
                      {p.specs && (
                        <details className="mt-1 text-xs text-gray-500">
                          <summary className="cursor-pointer">מפרט טכני</summary>
                          <p className="mt-1 whitespace-pre-line">{p.specs}</p>
                        </details>
                      )}
                      {p.requiresArtwork && (
                        <p className="mt-1 text-xs font-medium text-amber-700">דורש קובץ גרפי (לוגו / עיצוב)</p>
                      )}
                    </div>
                  </div>

                  {p.allowOptions && options.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-50 pt-3 text-sm">
                      {options.map((o) => (
                        <label key={o.id} className="flex items-center gap-1.5 text-gray-700">
                          <input
                            type="checkbox"
                            checked={row.optionIds.includes(o.id)}
                            onChange={(e) =>
                              update(p.id, {
                                optionIds: e.target.checked
                                  ? [...row.optionIds, o.id]
                                  : row.optionIds.filter((x) => x !== o.id),
                              })
                            }
                          />
                          {o.optionName}
                          <span className="text-xs text-gray-400">+{formatPrice(o.extraPrice)}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <input
                    placeholder="טקסט להדפסה / הערה לפריט (אופציונלי)"
                    value={row.text}
                    onChange={(e) => update(p.id, { text: e.target.value })}
                    className={`${field} mt-3`}
                  />

                  {price && (
                    <p className={`mt-2 text-sm ${belowMin ? 'text-red-600' : 'text-gray-700'}`}>
                      {belowMin
                        ? `כמות מינימלית: ${p.minQuantity}`
                        : `${qty.toLocaleString('he-IL')} × ${formatPrice(price.unitPrice)} = ${formatPrice(price.total)}`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <div className="text-sm">
        <ImageUpload
          key={resetCount}
          label={needsArtwork ? 'קובץ גרפי / לוגו להדפסה *' : 'קובץ גרפי / לוגו להדפסה'}
          folder="artwork"
          defaultValue={artworkUrl}
          onChange={setArtworkUrl}
        />
      </div>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">הערות להזמנה</span>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={field} />
      </label>

      <div className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
        <span className="font-medium text-gray-700">סה"כ משוער</span>
        <span className="text-xl font-bold text-gray-900">{formatPrice(total)}</span>
      </div>

      {msg && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {msg.text}
        </p>
      )}

      <button
        onClick={submit}
        disabled={pending || total <= 0 || (needsArtwork && !artworkUrl)}
        className="w-full rounded-lg bg-brand-600 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'שולח...' : 'שליחת הזמנת דפוס'}
      </button>
    </div>
  );
}
