import type { Plant } from '@prisma/client';
import { plantSpecRows } from '@/lib/plant-display';

/** טבלת המאפיינים הבוטניים המלאה (המידע ה"מורחב") לעמוד המוצר. */
export function SpecTable({ plant }: { plant: Plant | null | undefined }) {
  const rows = plantSpecRows(plant);
  if (rows.length === 0) return null;

  return (
    <dl className="grid grid-cols-1 gap-x-10 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex justify-between gap-4 border-b border-gray-100 py-2.5"
        >
          <dt className="shrink-0 text-sm font-medium text-gray-500">{label}</dt>
          <dd className="text-left text-sm text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
