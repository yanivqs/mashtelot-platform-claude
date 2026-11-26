import { lightScale, waterScale } from './scales';
import { signDescription, typePhrase, type SignPlantFields } from './text';
import type { SignData, SignSettings, SignSocial } from './types';

/**
 * מקור השלט: הנתונים הגולמיים של מוצר-צמח, המשתלה וה-QR (נבנה בשרת — data.ts).
 * signFromSource — טהור, רץ גם בדפדפן: העורך בונה את השלט מחדש בכל הקשה, בלי פנייה לשרת.
 */
export interface SignSource {
  productId: string;
  hebrewName: string;
  latinName: string | null;
  imageUrl: string | null;
  logoUrl: string | null;
  nurseryName: string;
  socials: SignSocial[];
  website: string | null;
  qrUrl: string;
  /** המוצר מוצג בחנות — אחרת ה-QR מוביל לדף שלא קיים */
  storeVisible?: boolean;
  plant: SignPlantFields & { light: string | null; water: string | null };
  /** התיאור שהמשתלה כתבה למוצר (HTML או טקסט) */
  productDescription: string | null;
  settings: SignSettings;
}

export function signFromSource(src: SignSource, settings: SignSettings = src.settings): SignData {
  return {
    hebrewName: src.hebrewName,
    latinName: src.latinName,
    description: signDescription({ saved: settings.description, productDescription: src.productDescription, plant: src.plant }),
    imageUrl: src.imageUrl,
    logoUrl: src.logoUrl,
    nurseryName: src.nurseryName,
    light: lightScale(src.plant.light, settings.light),
    water: waterScale(src.plant.water, settings.water),
    plantType: settings.plantType?.trim() || typePhrase(src.plant.plantType),
    notes: settings.notes?.trim() || null,
    socials: src.socials,
    website: src.website,
    qrUrl: src.qrUrl,
  };
}
