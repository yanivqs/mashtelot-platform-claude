import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { parsePlantCsvRow, upsertPlantRows, type PlantImportRow } from '../lib/plant-import';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 מתחיל ייבוא צמחים מקובץ CSV...');

  const csvFilePath = path.join(process.cwd(), 'plants_export.csv');
  if (!fs.existsSync(csvFilePath)) {
    console.error('❌ הקובץ plants_export.csv לא נמצא בשרש הפרויקט!');
    process.exit(1);
  }

  const text = fs.readFileSync(csvFilePath, 'utf-8');
  const records: Record<string, string>[] = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  // עדכון-או-הוספה לפי plant_id (ולא מחיקה מלאה) — כך שעדכון קטלוג לא פוגע
  // במוצרים שכבר משויכים למשתלות דרך nursery_products. אותה לוגיקה בדיוק
  // כמו מסך הייבוא באדמין (lib/plant-import.ts).
  const rows: PlantImportRow[] = [];
  let skipped = 0;
  for (const record of records) {
    const result = parsePlantCsvRow(record);
    if ('error' in result) skipped++;
    else rows.push(result.row);
  }

  console.log(
    `📦 נמצאו ${records.length} שורות בקובץ (${rows.length} תקינות, ${skipped} דולגו). מעדכן/מוסיף ב-Database...`,
  );

  const existing = await prisma.plant.findMany({
    where: { plantId: { in: rows.map((r) => r.plantId) } },
    select: { plantId: true },
  });
  const existingSet = new Set(existing.map((p) => p.plantId));
  const createCount = rows.filter((r) => !existingSet.has(r.plantId)).length;

  await upsertPlantRows(prisma, rows);

  console.log(
    `🎉 ייבוא הצמחים הושלם: ${createCount} נוספו, ${rows.length - createCount} עודכנו, ${skipped} דולגו (plant_id/hebrew_name חסרים).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
