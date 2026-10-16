/**
 * רץ בכל worker לפני קובצי הבדיקה: מפנה את Prisma Client לבסיס הבדיקות המאומת.
 * חייב לרוץ לפני כל ייבוא של `@/lib/prisma` (setupFiles של Vitest מבטיח זאת).
 */
import { resolveTestDatabase, prismaEnvFor } from './env';

Object.assign(process.env, prismaEnvFor(resolveTestDatabase()));
