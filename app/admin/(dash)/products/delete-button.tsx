'use client';

import { Trash2 } from 'lucide-react';
import { deleteProduct } from './actions';

/** מחיקה עם אישור. מוצר שהוזמן נעלם מהמלאי ומהחנות, וההזמנות נשמרות. */
export function DeleteProductButton({ id, title, withLabel = false }: { id: string; title: string; withLabel?: boolean }) {
  return (
    <form
      action={deleteProduct}
      onSubmit={(e) => {
        if (!window.confirm(`למחוק את "${title}"?\n\nהמוצר יוסר מהמלאי ומהחנות. אם כבר הוזמן, ההזמנות הקודמות יישמרו.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button aria-label={`מחיקת ${title}`} title="מחיקה" className={withLabel ? 'inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-800' : 'rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-700'}>
        <Trash2 className="h-4 w-4" />
        {withLabel && 'מחיקת המוצר'}
      </button>
    </form>
  );
}
