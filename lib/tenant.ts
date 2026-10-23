import { cache } from 'react';
import { prisma } from '@/lib/prisma';

/**
 * Resolve a tenant identifier (subdomain or custom domain) to a Nursery.
 * Wrapped in React `cache` so multiple calls in one request hit the DB once.
 */
export const getNurseryByTenant = cache(async (tenant: string) => {
  const value = decodeURIComponent(tenant).toLowerCase();
  return prisma.nursery.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [{ subdomain: value }, { customDomain: value }],
    },
  });
});

/** §2.03: משתלה מושעית — לדף "החנות סגורה זמנית" (טיוטה וארכיון — 404). */
export const getSuspendedNursery = cache(async (tenant: string) => {
  const value = decodeURIComponent(tenant).toLowerCase();
  return prisma.nursery.findFirst({
    where: { status: 'SUSPENDED', OR: [{ subdomain: value }, { customDomain: value }] },
    select: { name: true, phoneNumber: true, addressLine: true, city: true, logoUrl: true },
  });
});
