import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** מספרי העמודים להצגה: ראשון, אחרון וחלון סביב הנוכחי, עם "…" ביניהם. */
export function pageWindow(page: number, pageCount: number, radius = 2): Array<number | '…'> {
  const pages = new Set<number>([1, pageCount]);
  for (let p = page - radius; p <= page + radius; p++) {
    if (p >= 1 && p <= pageCount) pages.add(p);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…');
    out.push(p);
  });
  return out;
}

/** ניווט בין עמודים (רכיב שרת). */
export function Pagination({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;

  const cell = 'flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm';

  return (
    <nav aria-label="עמודים" className="mt-10 flex flex-wrap items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} rel="prev" className={`${cell} gap-1 border border-gray-200 text-gray-700 hover:bg-gray-50`}>
          <ChevronRight className="h-4 w-4" />
          הקודם
        </Link>
      ) : null}

      {pageWindow(page, pageCount).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-gray-600">
            …
          </span>
        ) : p === page ? (
          <span key={p} aria-current="page" className={`${cell} bg-[var(--brand,#16a34a)] font-medium text-white`}>
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} className={`${cell} border border-gray-200 text-gray-700 hover:bg-gray-50`}>
            {p}
          </Link>
        ),
      )}

      {page < pageCount ? (
        <Link href={hrefFor(page + 1)} rel="next" className={`${cell} gap-1 border border-gray-200 text-gray-700 hover:bg-gray-50`}>
          הבא
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : null}
    </nav>
  );
}
