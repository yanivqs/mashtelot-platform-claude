'use client';

import { useMemo, useState } from 'react';
import { formatPrice } from '@/lib/utils';
import { createPrintOrder } from './actions';

export interface PrintProductVM {
  id: string;
  title: string;
  description: string | null;
  basePrice: string;
  minQuantity: number;
}

const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

export function PrintOrderForm({
  products,
  options,
}: {
  products: PrintProductVM[];
  options: Array<{ optionName: string; extraPrice: string }>;
}) {
  const [rows, setRows] = useState<Record<string, { qty: string; text: string }>>({});
  const [notes, setNotes] = useState('');
  const [artworkUrl, setArtworkUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const total = useMemo(() => {
    return products.reduce((sum, p) => {
      const qty = parseInt(rows[p.id]?.qty ?? '', 10);
      return sum + (Number.isFinite(qty) && qty > 0 ? qty * Number(p.basePrice) : 0);
    }, 0);
  }, [rows, products]);

  async function submit() {
    setMsg(null);
    setPending(true);
    const items = products
      .map((p) => ({
        productId: p.id,
        quantity: parseInt(rows[p.id]?.qty ?? '', 10) || 0,
        customText: rows[p.id]?.text,
      }))
      .filter((i) => i.quantity > 0);

    const res = await createPrintOrder({ items, notes, artworkUrl });
    setPending(false);
    if (res.ok) {
      setRows({});
      setNotes('');
      setArtworkUrl('');
      setMsg({ ok: true, text: 'ההזמנה נשלחה לבית הדפוס של הפלטפורמה.' });
    } else {
      setMsg({ ok: false, text: res.error ?? 'שגיאה' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium text-gray-900">{p.title}</p>
                {p.description && <p className="mt-0.5 text-sm text-gray-500">{p.description}</p>}
                <p className="mt-1 text-sm text-gray-700">
                  {formatPrice(p.basePrice)} ליחידה · מינ׳ {p.minQuantity}
                </p>
              </div>
              <input
                type="number"
                min="0"
                step={p.minQuantity}
                placeholder="כמות"
                value={rows[p.id]?.qty ?? ''}
                onChange={(e) =>
                  setRows((r) => ({ ...r, [p.id]: { qty: e.target.value, text: r[p.id]?.text ?? '' } }))
                }
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </div>
            <input
              placeholder="טקסט / הערה לפריט (אופציונלי)"
              value={rows[p.id]?.text ?? ''}
              onChange={(e) =>
                setRows((r) => ({ ...r, [p.id]: { qty: r[p.id]?.qty ?? '', text: e.target.value } }))
              }
              className={`${field} mt-2`}
            />
          </div>
        ))}
      </div>

      {options.length > 0 && (
        <p className="text-xs text-gray-400">
          אפשרויות גימור זמינות (ציין בהערות): {options.map((o) => `${o.optionName} (+${formatPrice(o.extraPrice)})`).join(' · ')}
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">קישור לקובץ גרפי / לוגו</span>
        <input value={artworkUrl} onChange={(e) => setArtworkUrl(e.target.value)} className={field} />
      </label>
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
        disabled={pending || total <= 0}
        className="w-full rounded-lg bg-brand-600 py-3 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? 'שולח...' : 'שליחת הזמנת דפוס'}
      </button>
    </div>
  );
}
