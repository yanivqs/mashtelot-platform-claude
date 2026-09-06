/**
 * Seed admin/owner accounts for the management portal (/admin).
 * Run:  node seed-admin.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const SUPER_ADMIN_EMAIL = 'yanivqs@gmail.com';
const SUPER_ADMIN_PASSWORD = 'admin1234';
const OWNER_EMAIL = 'owner@demo-nursery.co.il';
const OWNER_PASSWORD = 'owner1234';

async function main() {
  const superHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: { passwordHash: superHash, role: 'SUPER_ADMIN' },
    create: { email: SUPER_ADMIN_EMAIL, passwordHash: superHash, role: 'SUPER_ADMIN' },
  });
  console.log(`SUPER_ADMIN: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);

  const nursery = await prisma.nursery.findUnique({ where: { subdomain: 'demo-nursery' } });
  if (nursery) {
    const ownerHash = await bcrypt.hash(OWNER_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: OWNER_EMAIL },
      update: { passwordHash: ownerHash, role: 'NURSERY_OWNER', nurseryId: nursery.id },
      create: {
        email: OWNER_EMAIL,
        passwordHash: ownerHash,
        role: 'NURSERY_OWNER',
        nurseryId: nursery.id,
      },
    });
    console.log(`NURSERY_OWNER: ${OWNER_EMAIL} / ${OWNER_PASSWORD}  (${nursery.name})`);
  } else {
    console.log('משתלת demo-nursery לא נמצאה - הרץ קודם node seed.js');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
