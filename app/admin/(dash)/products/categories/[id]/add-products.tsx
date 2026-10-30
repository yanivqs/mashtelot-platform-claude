'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { addProductToCategory } from './actions';

/** רשימת מוצרים שאינם בקטגוריה, עם חיפוש מהיר להוספה. */
export function AddProductsList({ categoryId, products }: { categoryId: string; products: Array<{ id: string; title: string; kind: string }> }) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const shown = term ? products.filter((p) => p.title.toLowerCase().includes(term)) : products;
  return (
    <div className="space-y-2">
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="חיפוש מוצר להוספה..."
          aria-label="חיפוש מוצר להוספה"
          className="w-full rounded-lg border border-gray-200 py-2 pl-3 pr-9 text-sm outline-none focus:border-brand-500"
        />
      </div>
      <p className="text-xs text-gray-500">{term ? `${shown.length} מתוך ${products.length}` : `${products.length} מוצרים זמינים`}</p>
      <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-gray-100 bg-white shadow-sm">
        {shown.length === 0 && <p className="p-6 text-center text-sm text-gray-500">לא נמצאו מוצרים.</p>}
        {shown.map((p) => (
          <form key={p.id} action={addProductToCategory} className="flex items-center justify-between gap-3 border-b border-gray-50 px-4 py-2 last:border-0">
            <input type="hidden" name="categoryId" value={categoryId} />
            <input type="hidden" name="productId" value={p.id} />
            <span className="min-w-0 truncate text-sm text-gray-800">
              {p.title} <span className="text-xs text-gray-400">· {p.kind}</span>
            </span>
            <button className="shrink-0 rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700">הוספה</button>
          </form>
        ))}
      </div>
    </div>
  );
}
