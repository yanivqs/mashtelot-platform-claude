'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileDown } from 'lucide-react';
import { SignPreview, SignStyles } from '@/components/plant-sign/sign-preview';
import type { SignData } from '@/lib/plant-sign/types';

const PREVIEWS = 4;

/** בית הדפוס: שלטי הצמחים בהזמנה (מה-Snapshot), והפקת PDF לדפוס שנשמר כקובץ הייצור */
export function PlantSignsPanel({
  orderId,
  signs,
  released,
  hasFile,
}: {
  orderId: string;
  signs: Array<{ id: string; quantity: number; data: SignData }>;
  released: boolean;
  hasFile: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [all, setAll] = useState(false);
  const total = signs.reduce((s, x) => s + x.quantity, 0);
  const shown = all ? signs : signs.slice(0, PREVIEWS);

  function generate() {
    setMsg(null);
    start(async () => {
      try {
        const r = await fetch(`/api/print/plant-signs/${orderId}`, { method: 'POST' });
        const text = await r.text();
        let j: { ok?: boolean; error?: string; pages?: number; warnings?: string[] };
        try {
          j = JSON.parse(text);
        } catch {
          // תשובה שאינה JSON: בדרך כלל חריגת זמן או זיכרון של השרת
          setMsg({ ok: false, text: `הפקת ה-PDF נכשלה (שגיאת שרת ${r.status}${r.status === 504 ? ' — חריגת זמן' : ''})` });
          return;
        }
        if (!r.ok || !j.ok) {
          setMsg({ ok: false, text: j.error ?? 'הפקת ה-PDF נכשלה' });
          return;
        }
        const warn = j.warnings?.length ? ` · שימו לב: ${j.warnings.join(' · ')}` : '';
        setMsg({ ok: !j.warnings?.length, text: `נוצר PDF עם ${j.pages} שלטים — להורדה בקובץ הייצור למטה${warn}` });
        router.refresh();
      } catch {
        setMsg({ ok: false, text: 'הפקת ה-PDF נכשלה — נסו שוב' });
      }
    });
  }

  return (
    <section className="rounded-lg border border-brand-100 bg-brand-50/40 p-3" aria-label="שלטי צמחים" data-testid="plant-signs-panel">
      <SignStyles />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-gray-900">
          שלטי צמחים · {signs.length} צמחים · {total} שלטים
        </h3>
        {!released && (
          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60"
            data-testid="plant-signs-pdf"
          >
            <FileDown className="h-4 w-4" aria-hidden />
            {pending ? 'מפיק PDF…' : hasFile ? 'הפקת PDF מחדש' : 'הפקת PDF לדפוס'}
          </button>
        )}
      </div>
      {msg && (
        <p className={`mt-2 text-sm ${msg.ok ? 'text-brand-800' : 'text-amber-800'}`} role="status">
          {msg.text}
        </p>
      )}
      <ul className="mt-2 text-sm text-gray-700">
        {signs.map((s) => (
          <li key={s.id}>
            {s.data.hebrewName} × {s.quantity}
          </li>
        ))}
      </ul>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {shown.map((s) => (
          <SignPreview key={s.id} data={s.data} uid={`o${s.id.slice(0, 8)}`} watermark={false} />
        ))}
      </div>
      {signs.length > PREVIEWS && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-sm text-brand-800 underline">
          {all ? 'פחות' : `כל ${signs.length} השלטים`}
        </button>
      )}
    </section>
  );
}
