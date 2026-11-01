import Link from 'next/link';
import { Check, Search, SlidersHorizontal, X } from 'lucide-react';
import type { CategoryNode } from '@/lib/catalog';
import type { FacetView } from '@/lib/catalog-filter';
import { FACET_KEYS } from '@/lib/plant-facets';
import { ScrollRow } from '@/components/storefront/scroll-row';

/** הפרמטרים שנשמרים בין קישורי הסינון (page מתאפס בכל שינוי). */
export const FILTER_PARAM_KEYS = ['q', 'category', 'letter', 'sort', ...FACET_KEYS];

export type ParamChanges = Record<string, string | null>;
export type HrefBuilder = (changes: ParamChanges) => string;

/** בונה פונקציית קישור שמחילה שינויים על הפרמטרים הנוכחיים ומאפסת את הדפדוף. */
export function makeHrefBuilder(
  basePath: string,
  current: Record<string, string | undefined>,
): HrefBuilder {
  return (changes) => {
    const sp = new URLSearchParams();
    for (const key of FILTER_PARAM_KEYS) {
      const value = key in changes ? changes[key] : current[key];
      if (value) sp.set(key, value);
    }
    if (changes.page) sp.set('page', changes.page);
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
}

const chip = 'shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition';
const chipIdle = `${chip} border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50`;
const chipActive = `${chip} border-transparent bg-[var(--brand,#16a34a)] font-medium text-white`;

/** חיפוש חופשי — טופס GET ששומר את שאר המסננים. */
export function CatalogSearch({
  basePath,
  current,
}: {
  basePath: string;
  current: Record<string, string | undefined>;
}) {
  return (
    <form method="get" action={basePath} className="flex gap-2">
      {FILTER_PARAM_KEYS.filter((k) => k !== 'q' && k !== 'letter' && current[k]).map((k) => (
        <input key={k} type="hidden" name={k} value={current[k]} />
      ))}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          name="q"
          defaultValue={current.q ?? ''}
          placeholder="חיפוש צמח או מוצר..."
          className="w-full rounded-lg border border-gray-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[var(--brand,#16a34a)]"
        />
      </div>
      <button className="rounded-lg bg-[var(--brand,#16a34a)] px-5 py-2.5 text-sm font-medium text-white hover:brightness-95">
        חיפוש
      </button>
    </form>
  );
}

/**
 * שורות קטגוריות: שורה ראשית של קטגוריות-על, ומתחתיה תתי-הקטגוריות של הקטגוריה
 * שנבחרה בלבד (רמה אחר רמה). רק קטגוריות שיש בהן מוצרים פעילים מגיעות לכאן.
 * בנייד כל רמה היא שורה אחת בגלילה אופקית, כדי שהמוצרים לא יידחקו אל מתחת למסך.
 */
export function CategoryRows({
  nav,
  path,
  href,
}: {
  nav: CategoryNode[];
  path: CategoryNode[];
  href: HrefBuilder;
}) {
  if (nav.length === 0) return null;

  const rows: Array<{ nodes: CategoryNode[]; activeId?: string; parent?: CategoryNode }> = [
    { nodes: nav, activeId: path[0]?.id },
  ];
  path.forEach((node, depth) => {
    if (node.children.length) {
      rows.push({ nodes: node.children, activeId: path[depth + 1]?.id, parent: node });
    }
  });

  return (
    <div className="space-y-2.5">
      {rows.map((row, i) => (
        <ScrollRow key={i}>
          {i === 0 ? (
            <Link href={href({ category: null })} aria-current={path.length ? undefined : 'true'} className={path.length ? chipIdle : chipActive}>
              הכל
            </Link>
          ) : (
            <Link
              href={href({ category: row.parent!.slug })}
              aria-current={row.activeId ? undefined : 'true'}
              className={row.activeId ? chipIdle : chipActive}
            >
              הכל ב{row.parent!.name}
            </Link>
          )}
          {row.nodes.map((node) => (
            <Link
              key={node.id}
              href={href({ category: node.slug })}
              aria-current={node.id === row.activeId ? 'true' : undefined}
              className={node.id === row.activeId ? chipActive : chipIdle}
            >
              {node.name}
            </Link>
          ))}
        </ScrollRow>
      ))}
    </div>
  );
}

/** רשימות המאפיינים (פאסטים) עם ספירה — רק ערכים שקיימים במלאי המסונן. */
export function FacetList({ facets, href }: { facets: FacetView[]; href: HrefBuilder }) {
  if (facets.length === 0) {
    return <p className="text-sm text-gray-400">אין מאפיינים לסינון בתוצאות אלו.</p>;
  }
  return (
    <div className="space-y-6">
      {facets.map(({ def, options, selected }) => (
        <div key={def.key}>
          <h3 className="mb-2 text-sm font-bold text-gray-900">{def.label}</h3>
          <ul className="space-y-0.5">
            {options.map((o) => {
              const isSelected = o.key === selected;
              return (
                <li key={o.key}>
                  <Link
                    href={href({ [def.key]: isSelected ? null : o.key })}
                    rel="nofollow"
                    className={`flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm ${
                      isSelected
                        ? 'bg-gray-100 font-medium text-gray-900'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-transparent bg-[var(--brand,#16a34a)] text-white'
                            : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="truncate">{o.label}</span>
                    </span>
                    <span className="shrink-0 text-xs text-gray-400">{o.count}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** תגיות המסננים הפעילים, עם הסרה בודדת וניקוי כולל. */
export function ActiveFilters({
  facets,
  letter,
  q,
  categoryName,
  href,
  clearHref,
}: {
  facets: FacetView[];
  letter: string | null;
  q?: string;
  categoryName?: string;
  href: HrefBuilder;
  clearHref: string;
}) {
  const tags: Array<{ label: string; href: string }> = [];
  if (q) tags.push({ label: `חיפוש: ${q}`, href: href({ q: null }) });
  if (categoryName) tags.push({ label: categoryName, href: href({ category: null }) });
  if (letter) tags.push({ label: `אות ${letter}`, href: href({ letter: null }) });
  for (const f of facets) {
    if (!f.selected) continue;
    const opt = f.options.find((o) => o.key === f.selected);
    tags.push({ label: `${f.def.label}: ${opt?.label ?? f.selected}`, href: href({ [f.def.key]: null }) });
  }
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {tags.map((t) => (
        <Link
          key={t.label}
          href={t.href}
          className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200"
        >
          {t.label}
          <X className="h-3 w-3" />
        </Link>
      ))}
      <Link href={clearHref} className="text-xs font-medium text-gray-500 underline hover:text-gray-800">
        ניקוי הכל
      </Link>
    </div>
  );
}

/** מעטפת לנייד: הפאסטים בתוך <details> מתקפל. */
export function MobileFacets({ children, activeCount }: { children: React.ReactNode; activeCount: number }) {
  return (
    <details className="rounded-xl border border-gray-200 bg-white lg:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-800">
        <SlidersHorizontal className="h-4 w-4" />
        סינון לפי מאפיינים
        {activeCount > 0 && (
          <span className="rounded-full bg-[var(--brand,#16a34a)] px-2 text-xs text-white">{activeCount}</span>
        )}
      </summary>
      <div className="border-t border-gray-100 p-4">{children}</div>
    </details>
  );
}
