/**
 * מנוע הסינון הטהור של קטלוג החנות (ללא Prisma/Next — ניתן לבדיקה).
 * `lib/catalog.ts` בונה אינדקס של כל המוצרים הפעילים של המשתלה ומעביר אותו לכאן.
 *
 * ספירות הפאסטים והאותיות מחושבות "בלי עצמן": אפשרויות פאסט מחושבות על התוצאות
 * עם כל שאר המסננים פרט לאותו פאסט, כך שלעולם לא מוצגת אפשרות שתוביל לאפס תוצאות.
 */
import { firstLetter } from '@/lib/alphabet';
import {
  PLANT_FACETS,
  facetOptions,
  plantMatchesFacet,
  type FacetDef,
  type FacetOption,
  type PlantFacetFields,
} from '@/lib/plant-facets';
import { buildSearchDoc, compileQuery, scoreDoc, type CompiledQuery, type SearchDoc, type SynonymIndex } from '@/lib/search';

export interface CatalogIndexEntry {
  id: string;
  createdAt: number;
  title: string;
  /** המחיר המוצג ("החל מ-" — הנמוך מבין הווריאנטים הפעילים) — למיון לפי מחיר */
  price: number;
  /** מסמך חיפוש: שם, שם עברי מקורי, שם לטיני, כינוי (R04-03, lib/search.ts) */
  search: SearchDoc;
  letter: string | null;
  plant: PlantFacetFields | null;
  /** מזהה קטגוריה → סדר המוצר בתוכה (כפי שקבע בעל המשתלה) */
  categorySort: Record<string, number>;
}

/** מיון שהלקוח בוחר (R04-07: מחיר, שם ותאריך בלבד). "מומלץ" = הסדר הרגיל (רלוונטיות/קטגוריה/חדשים). */
export const CATALOG_SORTS = [
  { key: 'recommended', label: 'מומלץ' },
  { key: 'price_asc', label: 'מחיר: מהנמוך לגבוה' },
  { key: 'price_desc', label: 'מחיר: מהגבוה לנמוך' },
  { key: 'name', label: 'שם (א–ת)' },
  { key: 'newest', label: 'חדשים' },
] as const;

export type CatalogSort = (typeof CATALOG_SORTS)[number]['key'];

/** ערך מה-URL; לא מוכר → "מומלץ". */
export function parseSort(raw: string | undefined | null): CatalogSort {
  return CATALOG_SORTS.some((s) => s.key === raw) ? (raw as CatalogSort) : 'recommended';
}

export interface CatalogFilterState {
  sort?: CatalogSort;
  q?: string;
  letter?: string | null;
  /** הקטגוריה הנבחרת וכל צאצאיה (null = ללא סינון קטגוריה) */
  categoryIds?: string[] | null;
  /** מפתח פאסט → מפתח אפשרות נבחרת */
  facets?: Record<string, string>;
  /** מילון נרדפות גלובלי (search_synonyms) */
  synonyms?: SynonymIndex;
}

interface Skip {
  letter?: boolean;
  facet?: string;
}

function matches(
  entry: CatalogIndexEntry,
  state: CatalogFilterState,
  query: CompiledQuery | null,
  scores: Map<string, number>,
  skip: Skip = {},
): boolean {
  if (query) {
    let s = scores.get(entry.id);
    if (s === undefined) {
      s = scoreDoc(query, entry.search);
      scores.set(entry.id, s);
    }
    if (s === 0) return false;
  }
  if (!skip.letter && state.letter && entry.letter !== state.letter) return false;
  if (state.categoryIds && !state.categoryIds.some((id) => id in entry.categorySort)) return false;
  for (const [key, option] of Object.entries(state.facets ?? {})) {
    if (key === skip.facet) continue;
    const def = PLANT_FACETS.find((f) => f.key === key);
    if (def && !plantMatchesFacet(entry.plant, def, option)) return false;
  }
  return true;
}

function sortEntries(
  entries: CatalogIndexEntry[],
  state: CatalogFilterState,
  query: CompiledQuery | null,
  scores: Map<string, number>,
): CatalogIndexEntry[] {
  const out = [...entries];
  const byName = (a: CatalogIndexEntry, b: CatalogIndexEntry) => a.title.localeCompare(b.title, 'he');
  // מיון שנבחר במפורש גובר על הסדר הרגיל (גם בחיפוש ובקטגוריה)
  switch (state.sort) {
    case 'price_asc':
      return out.sort((a, b) => a.price - b.price || byName(a, b));
    case 'price_desc':
      return out.sort((a, b) => b.price - a.price || byName(a, b));
    case 'name':
      return out.sort(byName);
    case 'newest':
      return out.sort((a, b) => b.createdAt - a.createdAt || byName(a, b));
  }
  if (query) {
    // בחיפוש: לפי רלוונטיות (מדויק > תחילת מילה > מכיל > שגיאת כתיב), ואז החדשים קודם
    return out.sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0) || b.createdAt - a.createdAt);
  }
  const cats = state.categoryIds;
  if (cats && cats.length) {
    // בקטגוריה: הסדר שקבע בעל המשתלה, ואז החדשים קודם
    const rank = (e: CatalogIndexEntry) =>
      Math.min(...cats.filter((id) => id in e.categorySort).map((id) => e.categorySort[id]));
    return out.sort((a, b) => rank(a) - rank(b) || b.createdAt - a.createdAt);
  }
  if (state.letter) {
    return out.sort((a, b) => a.title.localeCompare(b.title, 'he'));
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export interface FacetView {
  def: FacetDef;
  options: FacetOption[];
  selected: string | null;
}

export interface CatalogView {
  pageIds: string[];
  total: number;
  page: number;
  pageCount: number;
  /** אותיות שיש להן תוצאות בהינתן שאר המסננים */
  letters: Set<string>;
  /** פאסטים שיש להם לפחות אפשרות אחת (או שנבחרה בהם אפשרות) */
  facets: FacetView[];
}

export function buildCatalogView(
  entries: CatalogIndexEntry[],
  state: CatalogFilterState,
  page: number,
  pageSize: number,
): CatalogView {
  const query = compileQuery(state.q, state.synonyms);
  const scores = new Map<string, number>();
  const filtered = sortEntries(
    entries.filter((e) => matches(e, state, query, scores)),
    state,
    query,
    scores,
  );
  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);

  const letters = new Set<string>();
  for (const e of entries) {
    if (e.letter && matches(e, state, query, scores, { letter: true })) letters.add(e.letter);
  }

  const facets: FacetView[] = [];
  for (const def of PLANT_FACETS) {
    const pool = entries.filter((e) => e.plant && matches(e, state, query, scores, { facet: def.key }));
    const options = facetOptions(
      pool.map((e) => e.plant),
      def,
    );
    const selected = state.facets?.[def.key] ?? null;
    if (options.length > 0 || selected) facets.push({ def, options, selected });
  }

  return {
    pageIds: filtered.slice((safePage - 1) * pageSize, safePage * pageSize).map((e) => e.id),
    total,
    page: safePage,
    pageCount,
    letters,
    facets,
  };
}

/** בונה רשומת אינדקס ממוצר (שדות מינימליים). */
export function toIndexEntry(p: {
  id: string;
  createdAt: Date;
  title: string;
  price?: number;
  /** שמות נוספים לחיפוש (שם עברי מקורי, לטיני, כינוי) */
  altNames?: Array<string | null | undefined>;
  plant: PlantFacetFields | null;
  categorySort: Record<string, number>;
}): CatalogIndexEntry {
  return {
    id: p.id,
    createdAt: p.createdAt.getTime(),
    title: p.title,
    price: p.price ?? 0,
    search: buildSearchDoc([p.title, ...(p.altNames ?? [])]),
    letter: firstLetter(p.title),
    plant: p.plant,
    categorySort: p.categorySort,
  };
}
