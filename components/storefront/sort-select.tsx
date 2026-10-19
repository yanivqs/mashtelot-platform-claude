'use client';

import { useRouter } from 'next/navigation';

/** בורר מיון בקטלוג (R04-07) — כל אפשרות היא קישור שנבנה בשרת עם שאר המסננים. */
export function SortSelect({ value, options }: { value: string; options: Array<{ key: string; label: string; href: string }> }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600">
      מיון
      <select
        value={value}
        aria-label="מיון"
        onChange={(e) => {
          const o = options.find((x) => x.key === e.target.value);
          if (o) router.push(o.href);
        }}
        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-800"
      >
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
