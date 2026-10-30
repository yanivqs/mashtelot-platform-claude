'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Trash2 } from 'lucide-react';
import { deleteOrderAction, saveOrderNote, type OrderActionState } from './actions';

const initial: OrderActionState = {};

function Submit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`${className} disabled:opacity-60`}>
      {pending ? '...' : children}
    </button>
  );
}

/** הערה פנימית להזמנה — נראית רק בניהול. */
export function OrderNote({ id, note }: { id: string; note: string | null }) {
  const [state, action] = useActionState(saveOrderNote, initial);
  const [open, setOpen] = useState(Boolean(note));
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-brand-700 hover:underline">
        + הוספת הערה
      </button>
    );
  }
  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="id" value={id} />
      <label className="block text-xs font-semibold text-gray-600" htmlFor={`note-${id}`}>
        הערה פנימית (לא נשלחת ללקוח)
      </label>
      <textarea
        id={`note-${id}`}
        name="note"
        rows={2}
        maxLength={2000}
        defaultValue={note ?? ''}
        className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm outline-none focus:border-amber-400"
      />
      <div className="flex items-center gap-3">
        <Submit className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white">שמירת הערה</Submit>
        {state.ok && <span className="text-xs text-green-700">נשמר</span>}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

/** מחיקה לצמיתות, עם אישור כפול. */
export function DeleteOrderButton({ id, customerName }: { id: string; customerName: string }) {
  const [state, action] = useActionState(deleteOrderAction, initial);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-red-600"
      >
        <Trash2 className="h-3.5 w-3.5" />
        מחיקת הזמנה
      </button>
    );
  }
  return (
    <form action={action} className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="confirm" value="DELETE" />
      <p className="font-medium text-red-800">למחוק לצמיתות את ההזמנה של {customerName}?</p>
      <p className="mt-1 text-xs text-red-700">
        הזמנה פתוחה תבוטל קודם (המלאי והקופון ישוחררו). נקודות מועדון שנצברו בה יקוזזו מהלקוח ונקודות שמומשו יוחזרו. אי אפשר לשחזר.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <Submit className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white">כן, למחוק</Submit>
        <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-white">
          ביטול
        </button>
      </div>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
