const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('מאתר את משתלת הדמו...');
  
  const nursery = await prisma.nursery.findUnique({
    where: { subdomain: 'demo-nursery' },
  });

  if (!nursery) {
    console.error('משתלת demo-nursery לא נמצאה!');
    return;
  }

  // שליפת הצמחים מקטלוג המאסטר
  const allPlants = await prisma.plant.findMany();
  console.log(`נמצאו ${allPlants.length} צמחים בקטלוג המאסטר.`);

  if (allPlants.length === 0) {
    console.log('אין צמחים בטבלת Plant. יש להזין צמחים לטבלת המאסטר תחילה.');
    return;
  }

  // מציאת הצמחים שכבר מקושרים למשתלה כדי למנוע כפילויות
  const existingProducts = await prisma.nurseryProduct.findMany({
    where: { nurseryId: nursery.id },
    select: { plantId: true },
  });
  
  const existingPlantIds = new Set(existingProducts.map(p => p.plantId));

  // סינון הצמחים שעוד לא שויכו למשתלה
  const plantsToLink = allPlants.filter(p => !existingPlantIds.has(p.plantId));

  console.log(`מעדכן ${plantsToLink.length} צמחים חדשים עבור המשתלה...`);

  // קישור הצמחים בצרורות (Batches) בטבלת NurseryProduct
  const newProductsData = plantsToLink.map((plant, index) => ({
    nurseryId: nursery.id,
    plantId: plant.plantId,
    price: Math.floor(Math.random() * 80) + 30, // מחיר אקראי בין 30 ל-110 ש"ח לדוגמה
    isActive: true,
  }));

  if (newProductsData.length > 0) {
    await prisma.nurseryProduct.createMany({
      data: newProductsData,
    });
    console.log(`✅ הצלחה! נוספו ${newProductsData.length} מוצרים למשתלת הדמו.`);
  } else {
    console.log('כל הצמחים כבר משויכים למשתלה זו.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });