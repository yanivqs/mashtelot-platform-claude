import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import { accountStatus, type AccountStatus } from '@/lib/nursery-billing';

/** מצב החשבון של משתלה בבקשה הנוכחית. אין רשומת חשבון — אין הגבלה. */
export const getAccountStatus = cache(async (nurseryId: string): Promise<AccountStatus> => {
  const account = await prisma.nurseryAccount.findUnique({ where: { nurseryId } });
  return accountStatus(account);
});

export async function isNurseryBlocked(nurseryId: string | null | undefined): Promise<boolean> {
  return nurseryId ? (await getAccountStatus(nurseryId)).state === 'BLOCKED' : false;
}

export const DEFAULT_PLATFORM_EMAIL = 'hello@mashtelot.net';

export const getPlatformContact = cache(async () => {
  const s = await prisma.platformSettings.findUnique({ where: { id: 'default' } });
  return { name: s?.contactName ?? null, phone: s?.contactPhone ?? null, email: s?.contactEmail || DEFAULT_PLATFORM_EMAIL };
});
