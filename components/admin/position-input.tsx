'use client';

import { useRef } from 'react';

/**
 * שדה מספר מיקום ברשימה מסודרת: Enter או יציאה מהשדה שולחים את הטופס (אם המספר השתנה).
 * השדות הנסתרים (מזהים) מגיעים כ-children. יש לתת key שכולל את המיקום, כדי שיתאפס אחרי שמירה.
 */
export function PositionInput({
  action,
  position,
  max,
  label,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  position: number;
  max: number;
  label: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const submitIfChanged = (input: HTMLInputElement) => {
    const value = parseInt(input.value, 10);
    if (!Number.isFinite(value) || value === position) {
      input.value = String(position);
      return;
    }
    formRef.current?.requestSubmit();
  };

  return (
    <form ref={formRef} action={action}>
      {children}
      <input
        type="number"
        name="position"
        min={1}
        max={max}
        defaultValue={position}
        aria-label={label}
        title="הקלידו מיקום ולחצו Enter"
        onBlur={(e) => submitIfChanged(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          submitIfChanged(e.currentTarget);
        }}
        className="w-14 rounded-md border border-gray-200 px-1.5 py-1 text-center text-sm outline-none focus:border-brand-500"
      />
    </form>
  );
}
