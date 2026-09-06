/**
 * Demo tenant seed: ensures a demo nursery exists and links a sample of the
 * master plant catalog to it as priced, in-stock NurseryProducts.
 *
 * Run:  node seed.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SUBDOMAIN = 'demo-nursery';
const SAMPLE_SIZE = 60;

async function main() {
  const nursery = await prisma.nursery.upsert({
    where: { subdomain: SUBDOMAIN },
    update: {},
    create: {
      name: 'משתלת הדגמה ראשית',
      subdomain: SUBDOMAIN,
      ownerEmail: 'demo@mashtelot.net',
      primaryColor: '#16a34a',
      phoneNumber: '03-1234567',
      whatsappNumber: '+972501234567',
    },
  });
  console.log(`משתלה: ${nursery.name} (${nursery.id})`);

  const plants = await prisma.plant.findMany({
    where: { imageUrl: { not: null } },
    take: SAMPLE_SIZE,
    orderBy: { hebrewName: 'asc' },
  });
  console.log(`נמצאו ${plants.length} צמחים לשיוך.`);

  const existing = await prisma.nurseryProduct.findMany({
    where: { nurseryId: nursery.id },
    select: { plantId: true },
  });
  const taken = new Set(existing.map((p) => p.plantId));

  const data = plants
    .filter((p) => !taken.has(p.id))
    .map((p) => ({
      nurseryId: nursery.id,
      plantId: p.id,
      price: Math.floor(Math.random() * 16) * 5 + 25, // 25..100 ש"ח
      stockQuantity: Math.floor(Math.random() * 40) + 1,
      isActive: true,
    }));

  if (data.length === 0) {
    console.log('כל הצמחים כבר משויכים.');
    return;
  }

  const res = await prisma.nurseryProduct.createMany({ data, skipDuplicates: true });
  console.log(`✅ נוספו ${res.count} מוצרים למשתלת הדגמה.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
