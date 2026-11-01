import Link from 'next/link';
import { Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseLetter } from '@/lib/alphabet';
import { plantLetterWhere, plantLetters } from '@/lib/letter-filter';
import { AlphabetBar } from '@/components/alphabet-bar';
import { Pagination } from '@/components/pagination';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 30;

export default async function AdminCatalogPage(
  props: {
    searchParams: Promise<{ q?: string; page?: string; letter?: string; img?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  await requireUser(['SUPER_ADMIN']);

  const q = searchParams.q?.trim() || '';
  const letter = parseLetter(searchParams.letter);
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  // תמונות שהועתקו מאתרים חיצוניים וממתינות להחלפה
  const imgUpdate = searchParams.img === 'update';
  const where = {
    ...(imgUpdate ? { imageNeedsUpdate: true } : {}),
    ...(q
      ? {
          OR: [
            { hebrewName: { contains: q, mode: 'insensitive' as const } },
            { latinName: { contains: q, mode: 'insensitive' as const } },
            { family: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...plantLetterWhere(letter),
  };

  const [plants, total, letters, needsImage] = await Promise.all([
    prisma.plant.findMany({
      where,
      orderBy: { hebrewName: 'asc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.plant.count({ where }),
    plantLetters(),
    prisma.plant.count({ where: { imageNeedsUpdate: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pageHref = (p: number, nextLetter: string | null = letter) => {
    const sp = new URLSearchParams();
    if (q) sp.set('q', q);
    if (imgUpdate) sp.set('img', 'update');
    if (nextLetter) sp.set('letter', nextLetter);
    if (p > 1) sp.set('page', String(p));
    const s = sp.toString();
    return s ? `/admin/catalog?${s}` : '/admin/catalog';
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">קטלוג בוטני מרכזי</h1>
        <div className="flex gap-2">
          <Link
            href="/admin/catalog/categories"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ניהול קטגוריות
          </Link>
          <Link
            href="/admin/catalog/import"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ייבוא CSV
          </Link>
        </div>
      </div>
      <p className="mb-6 text-sm text-gray-500">
        {total.toLocaleString('he-IL')} צמחים
        {needsImage > 0 && (
          <>
            {' · '}
            <Link href={imgUpdate ? '/admin/catalog' : '/admin/catalog?img=update'} className="text-amber-700 hover:underline">
              {imgUpdate ? 'הצגת כל הצמחים' : `${needsImage.toLocaleString('he-IL')} תמונות לעדכון`}
            </Link>
          </>
        )}
      </p>

      <form method="get" className="mb-4 flex max-w-lg gap-3">
        {letter && <input type="hidden" name="letter" value={letter} />}
        {imgUpdate && <input type="hidden" name="img" value="update" />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="חיפוש לפי שם / משפחה..."
            className="w-full rounded-lg border border-gray-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-brand-500"
          />
        </div>
        <button className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white">חיפוש</button>
      </form>

      <div className="mb-6">
        <AlphabetBar available={letters} active={letter} hrefFor={(l) => pageHref(1, l)} />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
        {plants.length === 0 && (
          <p className="p-8 text-center text-sm text-gray-500">לא נמצאו צמחים.</p>
        )}
        {plants.map((p) => (
          <Link
            key={p.id}
            href={`/admin/catalog/${p.id}`}
            className="flex items-center gap-4 border-b border-gray-50 px-4 py-3 last:border-0 hover:bg-gray-50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50">
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <span aria-hidden>🪴</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">{p.hebrewName}</p>
              <p className="truncate text-xs text-gray-400">
                {[p.latinName, p.family].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            {p.imageNeedsUpdate && (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">תמונה לעדכון</span>
            )}
            {p.plantType && <span className="hidden text-xs text-gray-400 sm:inline">{p.plantType}</span>}
          </Link>
        ))}
      </div>

      <Pagination page={page} pageCount={pageCount} hrefFor={(p) => pageHref(p)} />
    </div>
  );
}
