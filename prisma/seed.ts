import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

const prisma = new PrismaClient();

interface PlantCSVRow {
  plant_id: string;
  hebrew_name: string;
  latin_name: string;
  nickname: string;
  family: string;
  description: string;
  notes: string;
  origin: string;
  native: string;
  plant_type: string;
  light: string;
  water: string;
  flowering: string;
  flowering_season: string;
  flower_color: string;
  foliage: string;
  evergreen: string;
  height: string;
  spacing: string;
  growth_rate: string;
  climate_zones: string;
  resistance: string;
  coastal: string;
  care: string;
  uniqueness: string;
  image_url: string;
}

async function main() {
  console.log('🌱 מתחיל ייבוא צמחים מקובץ CSV...');

  const csvFilePath = path.join(process.cwd(), 'plants_export.csv');

  if (!fs.existsSync(csvFilePath)) {
    console.error('❌ הקובץ plants_export.csv לא נמצא בשרש הפרויקט!');
    process.exit(1);
  }

  const plantsToInsert: any[] = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv())
      .on('data', (row: PlantCSVRow) => {
        plantsToInsert.push({
          plantId: row.plant_id ? parseInt(row.plant_id, 10) : null,
          hebrewName: row.hebrew_name || 'צמח ללא שם',
          latinName: row.latin_name || null,
          nickname: row.nickname || null,
          family: row.family || null,
          description: row.description || null,
          notes: row.notes || null,
          origin: row.origin || null,
          native: row.native || null,
          plantType: row.plant_type || null,
          light: row.light || null,
          water: row.water || null,
          flowering: row.flowering || null,
          floweringSeason: row.flowering_season || null,
          flowerColor: row.flower_color || null,
          foliage: row.foliage || null,
          evergreen: row.evergreen || null,
          height: row.height || null,
          spacing: row.spacing || null,
          growthRate: row.growth_rate || null,
          climateZones: row.climate_zones || null,
          resistance: row.resistance || null,
          coastal: row.coastal || null,
          care: row.care || null,
          uniqueness: row.uniqueness || null,
          imageUrl: row.image_url || null,
        });
      })
      .on('end', async () => {
        try {
          console.log(`📦 נמצאו ${plantsToInsert.length} צמחים בקובץ. מזין ל-Database...`);

          // מחיקת נתונים קודמים במידה וקיימים כדי למנוע כפילויות
          await prisma.plant.deleteMany({});

          // הזרקה במנות (Batches) של 100 צמחים לביצועים מהירים
          const batchSize = 100;
          for (let i = 0; i < plantsToInsert.length; i += batchSize) {
            const batch = plantsToInsert.slice(i, i + batchSize);
            await prisma.plant.createMany({
              data: batch,
              skipDuplicates: true,
            });
            console.log(`✅ הוזנו ${Math.min(i + batchSize, plantsToInsert.length)} מתוך ${plantsToInsert.length} צמחים`);
          }

          console.log('🎉 ייבוא הצמחים הושלם בהצלחה!');
          resolve(true);
        } catch (error) {
          console.error('❌ שגיאה בזמן הזרקת הנתונים:', error);
          reject(error);
        }
      })
      .on('error', (error) => {
        console.error('❌ שגיאה בקריאת קובץ ה-CSV:', error);
        reject(error);
      });
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });