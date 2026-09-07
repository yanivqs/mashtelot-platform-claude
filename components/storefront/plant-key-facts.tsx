import type { Plant } from '@prisma/client';
import { plantKeyFacts } from '@/lib/plant-display';

/** שורת אייקונים קומפקטית לכרטיס המוצר — אייקון + ערך קצר, בלי תוויות. */
export function PlantFactsInline({
  plant,
  limit = 3,
}: {
  plant: Plant | null | undefined;
  limit?: number;
}) {
  const facts = plantKeyFacts(plant, limit);
  if (facts.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-gray-500">
      {facts.map(({ key, value, Icon, label }) => (
        <li key={key} className="flex items-center gap-1" title={`${label}: ${value}`}>
          <Icon className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-hidden />
          <span className="truncate max-w-[9rem]">{value}</span>
        </li>
      ))}
    </ul>
  );
}

/** רשת כרטיסיות "מידע עיקרי" לעמוד המוצר. */
export function PlantFactsGrid({
  plant,
  limit = 4,
}: {
  plant: Plant | null | undefined;
  limit?: number;
}) {
  const facts = plantKeyFacts(plant, limit);
  if (facts.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {facts.map(({ key, label, value, Icon }) => (
        <div
          key={key}
          className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm"
        >
          <Icon className="mx-auto h-5 w-5 text-brand-600" aria-hidden />
          <dt className="mt-1.5 text-xs font-medium text-gray-400">{label}</dt>
          <dd className="mt-0.5 text-sm font-semibold text-gray-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
