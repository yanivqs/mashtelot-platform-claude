import { parsePriceTiers } from '@/lib/print-pricing';

/** המרת מוצר דפוס ישן לטיוטת תבנית: מחיר ומדרגות כמו שהם, ותוספות הגימור הכלליות כשדה בחירה מרובה. */
export interface LegacyProduct {
  title: string;
  description: string | null;
  category: string | null;
  specs: string | null;
  imageUrl: string | null;
  unitLabel: string | null;
  leadTimeDays: number | null;
  basePrice: { toString(): string };
  minQuantity: number;
  priceTiers: unknown;
  requiresArtwork: boolean;
  allowOptions: boolean;
  sortOrder: number;
}

export interface LegacyOption {
  optionName: string;
  extraPrice: { toString(): string };
}

export function legacyToDraft(p: LegacyProduct, options: LegacyOption[]) {
  const fields: Array<Record<string, unknown>> = [];
  if (p.allowOptions && options.length > 0) {
    fields.push({
      key: 'field_1',
      label: 'גימור',
      type: 'multiselect',
      required: false,
      options: options.map((o, i) => ({ value: `opt_${i + 1}`, label: o.optionName, priceDelta: Number(o.extraPrice.toString()) })),
    });
  }
  // בטופס הישן אפשר היה לכתוב טקסט חופשי לפריט
  fields.push({ key: 'field_2', label: 'טקסט להדפסה', type: 'textarea', required: false, maxLength: 500 });

  return {
    meta: {
      title: p.title,
      description: [p.description, p.specs].filter(Boolean).join('\n') || null,
      category: p.category,
      imageUrl: p.imageUrl,
      unitLabel: p.unitLabel,
      leadTimeDays: p.leadTimeDays,
      requiresArtwork: p.requiresArtwork,
      sortOrder: p.sortOrder,
      isActive: false,
    },
    fields,
    pricing: {
      basePrice: Number(p.basePrice.toString()),
      tiers: parsePriceTiers(p.priceTiers),
      setupFee: 0,
      minQuantity: p.minQuantity,
      quoteOnly: false,
      quantityOptions: [],
      allowCustomQuantity: true,
    },
  };
}
