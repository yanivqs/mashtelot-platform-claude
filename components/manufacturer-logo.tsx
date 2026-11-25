/**
 * לוגו של ספק / יצרן בתצוגה אחידה: ריבוע 1:1 על רקע לבן, הלוגו ממורכז ונכנס כולו (object-contain).
 * כך לוגואים במידות ובפרופורציות שונות נראים אחידים בכל מקום — בחנות ובממשק הניהול.
 * בלי לוגו — האות הראשונה של השם באותו ריבוע.
 */
export function ManufacturerLogo({
  name,
  logoUrl,
  className = 'h-12 w-12',
}: {
  name: string;
  logoUrl: string | null | undefined;
  /** גודל הריבוע (רוחב וגובה שווים), למשל "h-8 w-8" */
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100 bg-white ${className}`}
      style={{ aspectRatio: '1 / 1' }}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" loading="lazy" className="h-full w-full object-contain p-[6%]" />
      ) : (
        <span aria-hidden className="font-bold text-gray-400">
          {name.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
