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
      isActive: true,
      OR: [{ subdomain: value }, { customDomain: value }],
    },
  });
});
