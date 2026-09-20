'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search } from 'lucide-react';

interface CategoryOption {
  id: string;
  name: string;
}

export function CatalogFilters({
  plantTypes,
  categories = [],
}: {
  plantTypes: string[];
  categories?: CategoryOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get('q') ?? '');

  function apply(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) sp.set(key, value);
      else sp.delete(key);
    }
    sp.delete('page');
    startTransition(() => router.push(`${pathname}?${sp.toString()}`));
  }

  return (
    <form
      className="mb-8 flex flex-col gap-3 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        apply({ q });
      }}
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש צמח או מוצר..."
          className="w-full rounded-lg border border-gray-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-brand-500"
        />
      </div>

      {categories.length > 0 && (
        <select
          value={params.get('category') ?? 'all'}
          onChange={(e) =>
            apply({ category: e.target.value === 'all' ? undefined : e.target.value })
          }
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="all">כל הקטגוריות</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      {plantTypes.length > 0 && (
        <select
          value={params.get('type') ?? 'all'}
          onChange={(e) => apply({ type: e.target.value === 'all' ? undefined : e.target.value })}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="all">כל הסוגים</option>
          {plantTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        חיפוש
      </button>
    </form>
  );
}
