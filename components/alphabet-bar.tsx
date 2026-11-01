import Link from 'next/link';
import { HEBREW_LETTERS, OTHER_LETTER } from '@/lib/alphabet';
import { ScrollRow } from '@/components/storefront/scroll-row';

/**
 * סרגל סינון לפי אות ראשונה (א-ת). מוצגות רק אותיות שיש להן תוצאות (ואות שנבחרה בקישור, כדי שאפשר יהיה לבטל אותה).
 * בנייד: שורה אחת בגלילה אופקית. רכיב שרת — `hrefFor` נבנה בצד השרת.
 */
export function AlphabetBar({
  available,
  active,
  hrefFor,
}: {
  /** אותיות שיש להן תוצאות; undefined = כולן זמינות */
  available?: Set<string>;
  active: string | null;
  hrefFor: (letter: string | null) => string;
}) {
  const letters = [...HEBREW_LETTERS, OTHER_LETTER].filter((l) => !available || available.has(l) || l === active);
  if (letters.length === 0) return null;

  const base = 'flex h-8 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 text-sm font-medium';

  return (
    <nav aria-label="סינון לפי אות">
      <ScrollRow className="!gap-1">
        <Link
          href={hrefFor(null)}
          rel="nofollow"
          className={`${base} px-2.5 ${
            active ? 'text-gray-600 hover:bg-gray-100' : 'bg-[var(--brand,#16a34a)] text-white'
          }`}
        >
          הכל
        </Link>
        {letters.map((letter) =>
          letter === active ? (
            <span key={letter} aria-current="true" className={`${base} bg-[var(--brand,#16a34a)] text-white`}>
              {letter}
            </span>
          ) : (
            <Link
              key={letter}
              href={hrefFor(letter)}
              rel="nofollow"
              className={`${base} text-gray-700 hover:bg-gray-100`}
            >
              {letter}
            </Link>
          ),
        )}
      </ScrollRow>
    </nav>
  );
}
