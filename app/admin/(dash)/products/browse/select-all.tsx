'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

/** "סמן הכול" + מונה + כפתור הוספה לטופס המשיכה המרובה של מוצרי ציוד. */
export function SelectAllSupplies({ formId, label }: { formId: string; label: string }) {
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const form = document.getElementById(formId) as HTMLFormElement | null;
    if (!form) return;
    const boxes = () => [...form.querySelectorAll<HTMLInputElement>('input[name="supplyIds"]')];
    const update = () => {
      setTotal(boxes().length);
      setCount(boxes().filter((b) => b.checked).length);
    };
    update();
    form.addEventListener('change', update);
    return () => form.removeEventListener('change', update);
  }, [formId]);

  const toggle = (on: boolean) => {
    const form = document.getElementById(formId);
    form?.querySelectorAll<HTMLInputElement>('input[name="supplyIds"]').forEach((b) => (b.checked = on));
    setCount(on ? total : 0);
  };

  const all = total > 0 && count === total;
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={all} onChange={(e) => toggle(e.target.checked)} className="h-4 w-4" />
        {label}
      </label>
      <span className="text-sm text-gray-500" aria-live="polite">
        נבחרו {count}
      </span>
      <AddButton count={count} />
    </>
  );
}

function AddButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={count === 0 || pending}
      className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
    >
      {pending ? 'מוסיף...' : `הוסף ${count} מוצרים לחנות`}
    </button>
  );
}
