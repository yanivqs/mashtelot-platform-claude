import Link from 'next/link';
import { HEBREW_LETTERS, OTHER_LETTER } from '@/lib/alphabet';

/**
 * סרגל סינון לפי אות ראשונה (א-ת). אותיות ללא תוצאות מוצגות מעומעמות ולא לחיצות.
 * רכיב שרת — `hrefFor` נבנה בצד השרת.
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
  const letters: string[] = [...HEBREW_LETTERS];
  if (!available || available.has(OTHER_LETTER)) letters.push(OTHER_LETTER);

  const base = 'flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-sm font-medium';

  return (
    <nav aria-label="סינון לפי אות" className="flex flex-wrap items-center gap-1">
      <Link
        href={hrefFor(null)}
        rel="nofollow"
        className={`${base} px-2.5 ${
          active ? 'text-gray-600 hover:bg-gray-100' : 'bg-[var(--brand,#16a34a)] text-white'
        }`}
      >
        הכל
      </Link>
      {letters.map((letter) => {
        const enabled = !available || available.has(letter);
        if (letter === active) {
          return (
            <span key={letter} aria-current="true" className={`${base} bg-[var(--brand,#16a34a)] text-white`}>
              {letter}
            </span>
          );
        }
        if (!enabled) {
          return (
            <span key={letter} aria-disabled="true" className={`${base} text-gray-300`}>
              {letter}
            </span>
          );
        }
        return (
          <Link
            key={letter}
            href={hrefFor(letter)}
            rel="nofollow"
            className={`${base} text-gray-700 hover:bg-gray-100`}
          >
            {letter}
          </Link>
        );
      })}
    </nav>
  );
}
