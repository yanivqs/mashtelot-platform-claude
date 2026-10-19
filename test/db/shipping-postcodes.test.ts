/**
 * §11.01: אזורי משלוח לפי עיר ומיקוד — בחירת האזור מה-DB, בידוד בין משתלות, CHECK על ההתחלה.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// lib/shipping מסומן server-only; בבדיקה רצים ישירות מול ה-DB
vi.mock('server-only', () => ({}));
import { prisma } from '@/lib/prisma';
import { resolveShippingZone } from '@/lib/shipping';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
  await prisma.shippingZone.create({
    data: { nurseryId: f.A.nurseryId, name: 'מרכז', shippingPrice: '30.00', cities: { create: [{ cityName: 'רמת גן', normalizedCityName: 'רמת גן' }] }, postcodes: { create: [{ prefix: '52' }] } },
  });
  await prisma.shippingZone.create({ data: { nurseryId: f.A.nurseryId, name: 'רמת גן צפון', shippingPrice: '20.00', postcodes: { create: [{ prefix: '5250' }] } } });
  await prisma.shippingZone.create({ data: { nurseryId: f.B.nurseryId, name: 'של B', shippingPrice: '5.00', postcodes: { create: [{ prefix: '5' }] } } });
});

afterAll(async () => {
  await prisma.shippingZone.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

describe('§11.01 shipping zones by postcode', () => {
  it('postcode beats city, longest prefix wins, falls back to city; other nurseries are ignored', async () => {
    expect((await resolveShippingZone(f.A.nurseryId, 'חיפה', '5210000', prisma))?.name).toBe('מרכז');
    expect((await resolveShippingZone(f.A.nurseryId, 'רמת גן', '5250001', prisma))?.shippingPrice).toBe(20);
    expect((await resolveShippingZone(f.A.nurseryId, 'רמת גן', null, prisma))?.name).toBe('מרכז');
    expect(await resolveShippingZone(f.A.nurseryId, 'חיפה', '3100000', prisma)).toBeNull();
  });

  it('disabled zones do not match', async () => {
    await prisma.shippingZone.updateMany({ where: { nurseryId: f.A.nurseryId, name: 'רמת גן צפון' }, data: { isEnabled: false } });
    expect((await resolveShippingZone(f.A.nurseryId, 'רמת גן', '5250001', prisma))?.name).toBe('מרכז');
  });

  it('DB rejects a non-numeric or too long prefix', async () => {
    const z = await prisma.shippingZone.findFirstOrThrow({ where: { nurseryId: f.A.nurseryId, name: 'מרכז' } });
    await expect(prisma.shippingZonePostcode.create({ data: { shippingZoneId: z.id, prefix: '12345678' } })).rejects.toThrow();
    await expect(prisma.shippingZonePostcode.create({ data: { shippingZoneId: z.id, prefix: 'abc' } })).rejects.toThrow();
  });
});
