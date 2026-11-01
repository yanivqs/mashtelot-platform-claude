'use client';

/** תיבת סימון ששומרת מיד בשינוי (שולחת את הטופס לפעולת השרת). השדות הנסתרים מגיעים כ-children. */
export function ToggleCheckbox({
  action,
  checked,
  label,
  ariaLabel,
  children,
}: {
  action: (formData: FormData) => Promise<void>;
  checked: boolean;
  label: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <form action={action}>
      {children}
      <label className="mt-0.5 flex cursor-pointer items-center gap-1 text-[11px] text-gray-500">
        <input
          // מפתח לפי הערך — מתאפס אחרי שמירה
          key={String(checked)}
          type="checkbox"
          defaultChecked={checked}
          aria-label={ariaLabel}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="h-3.5 w-3.5 rounded border-gray-300"
        />
        {label}
      </label>
    </form>
  );
}
