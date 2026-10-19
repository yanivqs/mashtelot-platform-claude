/**
 * לוגיקת ייבוא/עדכון צמחים מ-CSV, משותפת בין `prisma/seed.ts` (CLI, לסביבה
 * חדשה/ריקה) לבין מסך הייבוא באדמין (app/admin/(dash)/catalog/import) — כדי
 * שהם לא יתפצלו זה מזה עם הזמן. ללא Prisma import ישיר: מקבלת מופע client
 * כפרמטר, כדי שתעבוד גם בתוך `$transaction` וגם עם ה-client הרגיל.
 */
import { Prisma, type PrismaClient } from '@prisma/client';

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

/** שדה ב-PlantImportRow → עמודה ב-plants (מלבד plant_id). */
const IMPORT_COLUMNS: Array<[keyof PlantImportRow, string]> = [
  ['hebrewName', 'hebrew_name'], ['latinName', 'latin_name'], ['nickname', 'nickname'], ['family', 'family'],
  ['description', 'description'], ['notes', 'notes'], ['origin', 'origin'], ['native', 'native'],
  ['plantType', 'plant_type'], ['light', 'light'], ['water', 'water'], ['flowering', 'flowering'],
  ['floweringSeason', 'flowering_season'], ['flowerColor', 'flower_color'], ['foliage', 'foliage'],
  ['evergreen', 'evergreen'], ['height', 'height'], ['spacing', 'spacing'], ['growthRate', 'growth_rate'],
  ['climateZones', 'climate_zones'], ['resistance', 'resistance'], ['coastal', 'coastal'], ['care', 'care'],
  ['uniqueness', 'uniqueness'], ['imageUrl', 'image_url'],
];

/**
 * מעדכן-או-מוסיף שורות במנות: כל מנה = פקודת INSERT … ON CONFLICT אחת (ולא שאילתה לשורה),
 * בטרנזקציה שמסמנת את מקור השינוי — כך שהגרסאות שה-trigger יוצר לכל שורה (§6,
 * plants_record_revision) מתועדות כ-'csv' עם המבצע. שורה ללא שינוי תוכן — ללא גרסה חדשה.
 */
export async function upsertPlantRows(
  db: PrismaClient,
  rows: PlantImportRow[],
  opts: { chunkSize?: number; source?: string; actorEmail?: string | null } = {},
): Promise<void> {
  const chunkSize = opts.chunkSize ?? 100;
  const cols = Prisma.raw(['"plant_id"', ...IMPORT_COLUMNS.map(([, c]) => `"${c}"`)].join(', '));
  const updates = Prisma.raw(
    [...IMPORT_COLUMNS.map(([, c]) => `"${c}" = EXCLUDED."${c}"`), '"updated_at" = CURRENT_TIMESTAMP'].join(', '),
  );
  for (let i = 0; i < rows.length; i += chunkSize) {
    // כפילות של plant_id באותה מנה תפיל את ON CONFLICT — האחרונה גוברת (כמו upsert רציף)
    const byId = new Map(rows.slice(i, i + chunkSize).map((r) => [r.plantId, r]));
    const values = Prisma.join(
      [...byId.values()].map(
        (r) => Prisma.sql`(gen_random_uuid()::text, ${r.plantId}, ${Prisma.join(IMPORT_COLUMNS.map(([k]) => r[k]))}, CURRENT_TIMESTAMP)`,
      ),
    );
    await db.$transaction([
      db.$executeRaw`SELECT set_config('app.catalog_source', ${opts.source ?? 'csv'}, true), set_config('app.catalog_actor', ${opts.actorEmail ?? ''}, true)`,
      db.$executeRaw`
        INSERT INTO "plants" ("id", ${cols}, "updated_at") VALUES ${values}
        ON CONFLICT ("plant_id") DO UPDATE SET ${updates}`,
    ]);
  }
}
