/**
 * לוגיקת ייבוא/עדכון צמחים מ-CSV, משותפת בין `prisma/seed.ts` (CLI, לסביבה
 * חדשה/ריקה) לבין מסך הייבוא באדמין (app/admin/(dash)/catalog/import) — כדי
 * שהם לא יתפצלו זה מזה עם הזמן. ללא Prisma import ישיר: מקבלת מופע client
 * כפרמטר, כדי שתעבוד גם בתוך `$transaction` וגם עם ה-client הרגיל.
 */
import type { Prisma, PrismaClient } from '@prisma/client';

export interface PlantImportRow {
  plantId: number;
  hebrewName: string;
  latinName: string | null;
  nickname: string | null;
  family: string | null;
  description: string | null;
  notes: string | null;
  origin: string | null;
  native: string | null;
  plantType: string | null;
  light: string | null;
  water: string | null;
  flowering: string | null;
  floweringSeason: string | null;
  flowerColor: string | null;
  foliage: string | null;
  evergreen: string | null;
  height: string | null;
  spacing: string | null;
  growthRate: string | null;
  climateZones: string | null;
  resistance: string | null;
  coastal: string | null;
  care: string | null;
  uniqueness: string | null;
  imageUrl: string | null;
}

const s = (v: unknown): string | null => {
  const str = String(v ?? '').trim();
  return str || null;
};

/** מפענח ומאמת שורת CSV גולמית (מפתחות snake_case) לשורת ייבוא תקנית. */
export function parsePlantCsvRow(
  record: Record<string, string>,
): { row: PlantImportRow } | { error: string } {
  const plantIdRaw = String(record.plant_id ?? '').trim();
  const hebrewName = String(record.hebrew_name ?? '').trim();

  if (!plantIdRaw || !/^\d+$/.test(plantIdRaw)) {
    return { error: 'plant_id חסר או אינו מספר שלם' };
  }
  if (!hebrewName) {
    return { error: 'hebrew_name חסר' };
  }

  return {
    row: {
      plantId: parseInt(plantIdRaw, 10),
      hebrewName,
      latinName: s(record.latin_name),
      nickname: s(record.nickname),
      family: s(record.family),
      description: s(record.description),
      notes: s(record.notes),
      origin: s(record.origin),
      native: s(record.native),
      plantType: s(record.plant_type),
      light: s(record.light),
      water: s(record.water),
      flowering: s(record.flowering),
      floweringSeason: s(record.flowering_season),
      flowerColor: s(record.flower_color),
      foliage: s(record.foliage),
      evergreen: s(record.evergreen),
      height: s(record.height),
      spacing: s(record.spacing),
      growthRate: s(record.growth_rate),
      climateZones: s(record.climate_zones),
      resistance: s(record.resistance),
      coastal: s(record.coastal),
      care: s(record.care),
      uniqueness: s(record.uniqueness),
      imageUrl: s(record.image_url),
    },
  };
}

type Db = PrismaClient | Prisma.TransactionClient;

/** עדכון-או-הוספה של שורת צמח בודדת, לפי plant_id (המפתח הטבעי היחיד). */
export function upsertPlantRow(db: Db, row: PlantImportRow) {
  return db.plant.upsert({ where: { plantId: row.plantId }, create: row, update: row });
}

/**
 * מעדכן-או-מוסיף מספר שורות במקביל, במנות — כדי לא לפתוח אלפי round-trips
 * רציפים לפול ה-DB (upsert אין לו batch API ב-Prisma, בניגוד ל-createMany).
 */
export async function upsertPlantRows(
  db: Db,
  rows: PlantImportRow[],
  chunkSize = 50,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await Promise.all(chunk.map((row) => upsertPlantRow(db, row)));
  }
}
