/**
 * יצירת חשבונות ניהול לסביבת פיתוח/בדיקות (C-P0-03).
 *
 * אין סיסמאות בקוד. הסיסמאות מגיעות ממשתני סביבה בלבד:
 *   SEED_SUPER_ADMIN_EMAIL, SEED_SUPER_ADMIN_PASSWORD        (חובה)
 *   SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD                    (אופציונלי — בעלים למשתלת demo-nursery)
 *
 * בטיחות:
 * - רץ רק מול יעד מקומי או SEED_ALLOWED_REFS (scripts/seed-guard.js) — לעולם לא Production.
 * - משתמש קיים: הסיסמה שלו לא נדרסת, אלא אם הועבר --reset-password.
 * - סיסמאות לא מודפסות.
 *
 * הרצה:  SEED_SUPER_ADMIN_EMAIL=... SEED_SUPER_ADMIN_PASSWORD=... node seed-admin.js [--reset-password]
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { assertSeedTargetAllowed } = require('./scripts/seed-guard');

const MIN_LENGTH = 12;
const resetPassword = process.argv.includes('--reset-password');

function requirePassword(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} לא מוגדר`);
  if (value.length < MIN_LENGTH) throw new Error(`${name} חייב להיות באורך ${MIN_LENGTH} תווים לפחות`);
  return value;
}

async function upsertAccount(prisma, { email, password, role, nurseryId }) {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && !resetPassword) {
    await prisma.user.update({ where: { email }, data: { role, nurseryId } });
    console.log(`${role}: ${email} — קיים, הסיסמה לא שונתה (להחלפה: --reset-password)`);
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role, nurseryId },
    create: { email, passwordHash, role, nurseryId },
  });
  console.log(`${role}: ${email} — ${existing ? 'הסיסמה הוחלפה' : 'נוצר'}`);
}

async function main() {
  const target = assertSeedTargetAllowed();
  console.log(`seed-admin → ${target}`);

  const superEmail = process.env.SEED_SUPER_ADMIN_EMAIL;
  if (!superEmail) throw new Error('SEED_SUPER_ADMIN_EMAIL לא מוגדר');
  const superPassword = requirePassword('SEED_SUPER_ADMIN_PASSWORD');

  const prisma = new PrismaClient();
  try {
    await upsertAccount(prisma, {
      email: superEmail.trim().toLowerCase(),
      password: superPassword,
      role: 'SUPER_ADMIN',
      nurseryId: null,
    });

    const ownerEmail = process.env.SEED_OWNER_EMAIL;
    if (ownerEmail) {
      const nursery = await prisma.nursery.findUnique({ where: { subdomain: 'demo-nursery' } });
      if (!nursery) {
        console.log('משתלת demo-nursery לא נמצאה - הרץ קודם node seed.js');
      } else {
        await upsertAccount(prisma, {
          email: ownerEmail.trim().toLowerCase(),
          password: requirePassword('SEED_OWNER_PASSWORD'),
          role: 'NURSERY_OWNER',
          nurseryId: nursery.id,
        });
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
