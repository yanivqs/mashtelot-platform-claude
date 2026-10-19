import { localizeItem } from '@/lib/catalog-sync';

/**
 * §6: מחליף את נתוני הפריט המרכזי במוצר (plant / supply) בגרסה הנעוצה + שדות מקומיים.
 * השאילתה צריכה לכלול `catalogRevisionInclude` (ו-`catalogOverrides`, שדה רגיל במוצר).
 */
export const catalogRevisionInclude = { catalogRevision: { select: { data: true } } } as const;

type Localizable = {
  plant?: object | null;
  supply?: object | null;
  catalogRevision?: { data: unknown } | null;
  catalogOverrides?: unknown;
};

export function localizeProduct<P extends Localizable>(p: P): P {
  const data = p.catalogRevision?.data;
  if (!data) return p;
  return {
    ...p,
    ...(p.plant ? { plant: localizeItem(p.plant as Record<string, unknown>, 'plant', data, p.catalogOverrides) } : {}),
    ...(p.supply ? { supply: localizeItem(p.supply as Record<string, unknown>, 'supply', data, p.catalogOverrides) } : {}),
  };
}
