'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { displayValue, type FieldDiff } from '@/lib/catalog-sync';
import { applySyncAction, type SyncFormState } from './actions';

const initial: SyncFormState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      {pending ? 'מעדכן...' : 'אישור'}
    </button>
  );
}

function Value({ field, value }: { field: string; value: unknown }) {
  const text = displayValue(field, value);
  if (field === 'imageUrl' && text !== '—') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={text} alt="" className="h-16 w-16 rounded-lg object-cover" />;
  }
  return <span className="whitespace-pre-line">{text}</span>;
}

/** השוואה לכל שדה + בחירה מה לעדכן. שדה שלא סומן נשמר מקומית ולא יוצע עוד. */
export function SyncForm({
  productId,
  toRevisionId,
  diffs,
}: {
  productId: string;
  toRevisionId: string;
  diffs: FieldDiff[];
}) {
  const [state, action] = useActionState(applySyncAction, initial);
  if (state.ok) return <p className="text-sm text-green-700">{state.message}</p>;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="toRevisionId" value={toRevisionId} />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-right text-xs text-gray-500">
            <tr>
              <th className="w-24 py-1 font-medium">לעדכן?</th>
              <th className="py-1 font-medium">שדה</th>
              <th className="py-1 font-medium">אצלכם היום</th>
              <th className="py-1 font-medium">בקטלוג המרכזי</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 align-top">
            {diffs.map((d) => (
              <tr key={d.field}>
                <td className="py-2">
                  <input type="hidden" name="offered" value={d.field} />
                  <input
                    type="checkbox"
                    name="accept"
                    value={d.field}
                    defaultChecked
                    aria-label={`לעדכן ${d.label}`}
                    className="h-4 w-4"
                  />
                </td>
                <td className="py-2 font-medium text-gray-700">{d.label}</td>
                <td className="max-w-xs py-2 text-gray-500 line-through decoration-gray-300">
                  <Value field={d.field} value={d.from} />
                </td>
                <td className="max-w-xs py-2 text-gray-900">
                  <Value field={d.field} value={d.to} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        שדה שלא תסמנו יישאר כמו שהוא אצלכם, ולא יוצע לעדכון בעתיד (אפשר להחזיר אותו לסנכרון בתחתית הדף).
      </p>
      <div className="flex items-center gap-3">
        <Submit />
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
