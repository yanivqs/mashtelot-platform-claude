import Link from 'next/link';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { Search } from 'lucide-react';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseLetter } from '@/lib/alphabet';
import { formatPrice } from '@/lib/utils';
import {
  plantLetterWhere,
  plantLetters,
  supplyLetterWhere,
  supplyLetters,
} from '@/lib/letter-filter';
import { AlphabetBar } from '@/components/alphabet-bar';
import { Pagination } from '@/components/pagination';
import { addCatalogItem, addSuppliesBulk } from './actions';
import { SelectAllSupplies } from './select-all';
import { ManufacturerLogo } from '@/components/manufacturer-logo';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;
/** בסינון לפי יצרן — כל מוצרי היצרן בעמוד אחד, כדי ש"סמן הכול" יסמן את כולם */
const MANUFACTURER_PAGE_SIZE = 500;

interface Props {
  searchParams: Promise<{
    q?: string;
    tab?: string;
    category?: string;
    page?: string;
    letter?: string;
    manufacturer?: string;
    added?: string;
    skipped?: string;
    barcodes?: string;
  }>;
}

export default async function BrowseCatalogPage(props: Props) {
  const searchParams = await props.searchParams;
  const { nurseryId } = await requireNurseryPage({ any: ['plant_catalog', 'supplies'] });


  const tab = searchParams.tab === 'supplies' ? 'supplies' : 'plants';
  const q = searchParams.q?.trim() || '';
  const categoryId = searchParams.category?.trim() || '';
  const manufacturerId = tab === 'supplies' ? searchParams.manufacturer?.trim() || '' : '';
  const letter = parseLetter(searchParams.letter);
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const letters = tab === 'plants' ? await plantLetters() : await supplyLetters();
  const categories = tab === 'plants' ? await prisma.plantCategory.findMany({ orderBy: { sortOrder: 'asc' } }) : [];
  const manufacturers =
    tab === 'supplies'
      ? await prisma.manufacturer.findMany({
          where: { isActive: true, supplies: { some: {} } },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, logoUrl: true, _count: { select: { supplies: true } } },
        })
      : [];
  const selectedManufacturer = manufacturers.find((m) => m.id === manufacturerId) ?? null;

  const owned = await prisma.nurseryProduct.findMany({
    where: { nurseryId },
    select: { plantId: true, supplyId: true },
  });
  const ownedPlants = new Set(owned.map((o) => o.plantId).filter(Boolean));
  const ownedSupplies = new Set(owned.map((o) => o.supplyId).filter(Boolean));

  const rows: Array<{
    id: string;
    kind: 'plant' | 'supply';
    title: string;
    sub: string | null;
    image: string | null;
    owned: boolean;
    price?: string | null;
  }> = [];
  let total = 0;
  const pageSize = selectedManufacturer ? MANUFACTURER_PAGE_SIZE : PAGE_SIZE;

  if (tab === 'plants') {
    const where = {
      // צמחים פרטיים של משתלות (owner_nursery_id) אינם חלק מהקטלוג הראשי
      ownerNurseryId: null,
      ...(q
        ? {
            OR: [
              { hebrewName: { contains: q, mode: 'insensitive' as const } },
              { latinName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
      ...(categoryId ? { categories: { some: { categoryId } } } : {}),
      ...plantLetterWhere(letter),
    };
    const [plants, count] = await Promise.all([
      prisma.plant.findMany({
        where,
        orderBy: { hebrewName: 'asc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.plant.count({ where }),
    ]);
    total = count;
    for (const p of plants) {
      rows.push({
        id: p.id,
        kind: 'plant',
        title: p.hebrewName,
        sub: p.latinName,
        image: p.imageUrl,
        owned: ownedPlants.has(p.id),
      });
    }
  } else {
    const where: Prisma.MasterSupplyWhereInput = {
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { manufacturerCode: { contains: q, mode: 'insensitive' } },
              { barcode: { contains: q } },
            ],
          }
        : {}),
      ...(selectedManufacturer ? { manufacturerId: selectedManufacturer.id } : {}),
      ...supplyLetterWhere(letter),
    };
    const [supplies, count] = await Promise.all([
      prisma.masterSupply.findMany({
        where,
        orderBy: { title: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { manufacturer: { select: { name: true, isActive: true } } },
      }),
      prisma.masterSupply.count({ where }),
    ]);
    total = count;
    for (const s of supplies) {
      rows.push({
        id: s.id,
        kind: 'supply',
        title: s.title,
        sub: [s.manufacturer?.isActive ? s.manufacturer.name : s.brand, s.manufacturerCode].filter(Boolean).join(' · ') || null,
        image: s.imageUrl,
        owned: ownedSupplies.has(s.id),
        price: s.suggestedPrice ? s.suggestedPrice.toString() : null,
      });
    }
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const tabHref = (t: string) => `/admin/products/browse?tab=${t}`;
  const pageHref = (p: number, nextLetter: string | null = letter) => {
    const sp = new URLSearchParams();
    sp.set('tab', tab);
    if (q) sp.set('q', q);
    if (categoryId) sp.set('category', categoryId);
    if (manufacturerId) sp.set('manufacturer', manufacturerId);
    if (nextLetter) sp.set('letter', nextLetter);
    if (p > 1) sp.set('page', String(p));
    return `/admin/products/browse?${sp.toString()}`;
  };
  const added = Number(searchParams.added ?? NaN);
  const selectable = rows.filter((r) => r.kind === 'supply' && !r.owned).length;

  const grid = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm"
        >
          {row.kind === 'supply' && !row.owned && (
            <input
              type="checkbox"
              name="supplyIds"
              value={row.id}
              aria-label={`בחירת ${row.title}`}
              className="h-4 w-4 shrink-0"
            />
          )}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-lg">
            {row.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden>🪴</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-gray-900">{row.title}</p>
            {row.sub && <p className="truncate text-xs text-gray-500">{row.sub}</p>}
            {row.kind === 'supply' && row.price && <p className="text-xs text-gray-500">מחיר מומלץ {formatPrice(row.price)}</p>}
          </div>
          {row.owned ? (
            <span className="shrink-0 text-xs font-medium text-green-700">בחנות ✓</span>
          ) : row.kind === 'plant' ? (
            <form action={addCatalogItem} className="flex shrink-0 items-center gap-1.5">
              <input type="hidden" name="kind" value={row.kind} />
              <input type="hidden" name="refId" value={row.id} />
              <input
                name="price"
                type="number"
                min="0"
                step="0.5"
                placeholder="₪"
                aria-label={`מחיר ל${row.title}`}
                className="w-16 rounded-md border border-gray-200 px-2 py-1 text-sm outline-none focus:border-brand-500"
              />
              <button className="rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-800">
                הוסף
              </button>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">שיוך מוצרים</h1>
      <p className="mb-6 text-sm text-gray-500">
        {tab === 'plants'
          ? 'בחר פריטים מהקטלוג הבוטני המרכזי והוסף אותם לחנות שלך עם מחיר.'
          : 'בחר ספק או יצרן, סמן מוצרים והוסף אותם לחנות. המחיר ההתחלתי הוא המחיר המומלץ, ואפשר לשנות אותו אחר כך.'}
      </p>

      <div className="mb-4 flex gap-2">
        <Link
          href={tabHref('plants')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'plants' ? 'bg-brand-700 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          צמחים
        </Link>
        <Link
          href={tabHref('supplies')}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            tab === 'supplies' ? 'bg-brand-700 text-white' : 'bg-white text-gray-700 border border-gray-200'
          }`}
        >
          ציוד וחומרים
        </Link>
      </div>

      {Number.isFinite(added) && (
        <p role="status" className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800" data-testid="bulk-added">
          נוספו {added} מוצרים לחנות.
          {Number(searchParams.skipped) > 0 && ` ${searchParams.skipped} כבר היו בחנות.`}
          {Number(searchParams.barcodes) > 0 && ` ב-${searchParams.barcodes} מוצרים הברקוד כבר קיים במוצר אחר שלכם, ולכן לא הועתק.`}{' '}
          מוצר מוצג בחנות אחרי שמעלים לו תמונה משלכם{added > 0 ? ' — ' : '.'}
          {added > 0 && (
            <Link href="/admin/products" className="font-medium underline">
              למלאי
            </Link>
          )}
        </p>
      )}

      {tab === 'supplies' && manufacturers.length > 0 && (
        <nav aria-label="ספקים ויצרנים" className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/admin/products/browse?tab=supplies"
            aria-current={!selectedManufacturer ? 'page' : undefined}
            className={`rounded-lg border px-3 py-2 text-sm ${!selectedManufacturer ? 'border-brand-600 bg-brand-50 font-medium' : 'border-gray-200 bg-white'}`}
          >
            כל הספקים והיצרנים
          </Link>
          {manufacturers.map((m) => (
            <Link
              key={m.id}
              href={`/admin/products/browse?tab=supplies&manufacturer=${m.id}`}
              aria-current={selectedManufacturer?.id === m.id ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                selectedManufacturer?.id === m.id ? 'border-brand-600 bg-brand-50 font-medium' : 'border-gray-200 bg-white'
              }`}
            >
              {m.logoUrl && <ManufacturerLogo name={m.name} logoUrl={m.logoUrl} className="h-6 w-6 rounded" />}
              {m.name}
              <span className="text-xs text-gray-500">({m._count.supplies})</span>
            </Link>
          ))}
        </nav>
      )}

      <form method="get" className="mb-4 flex gap-3">
        <input type="hidden" name="tab" value={tab} />
        {letter && <input type="hidden" name="letter" value={letter} />}
        {manufacturerId && <input type="hidden" name="manufacturer" value={manufacturerId} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            aria-label="חיפוש בקטלוג"
            placeholder={tab === 'supplies' ? 'שם, קוד יצרן או ברקוד...' : 'חיפוש בקטלוג...'}
            className="w-full rounded-lg border border-gray-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        {tab === 'plants' && categories.length > 0 && (
          <select
            name="category"
            defaultValue={categoryId}
            aria-label="קטגוריה"
            className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-500"
          >
            <option value="">כל הקטגוריות</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <button className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white">חיפוש</button>
      </form>

      <div className="mb-6">
        <AlphabetBar available={letters} active={letter} hrefFor={(l) => pageHref(1, l)} />
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          לא נמצאו פריטים.
        </p>
      )}

      {tab === 'supplies' && rows.length > 0 ? (
        <form action={addSuppliesBulk} id="supplies-bulk">
          <input type="hidden" name="back" value={pageHref(page)} />
          {selectable > 0 && (
            <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white/95 p-3 shadow-sm">
              <SelectAllSupplies formId="supplies-bulk" label={selectedManufacturer ? `סמן את כל מוצרי ${selectedManufacturer.name}` : 'סמן הכול בעמוד'} />
            </div>
          )}
          {grid}
        </form>
      ) : (
        grid
      )}

      <Pagination page={page} pageCount={pageCount} hrefFor={(p) => pageHref(p)} />
    </div>
  );
}
