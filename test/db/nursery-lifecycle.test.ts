/**
 * §2.03: סטטוס מחזור החיים מול ה-DB — סנכרון דו-כיווני עם is_active (קוד חדש וישן).
 */
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';

const SUB = `life-${Date.now()}`;
const ids: string[] = [];

afterAll(async () => {
  await prisma.nursery.deleteMany({ where: { id: { in: ids } } });
  await prisma.$disconnect();
});

const create = async (data: Record<string, unknown>) => {
  const n = await prisma.nursery.create({ data: { name: 'x', subdomain: `${SUB}-${ids.length}`, ownerEmail: 'o@x', ...data } });
  ids.push(n.id);
  return n;
};

describe('§2.03 nursery status ⇔ is_active', () => {
  it('insert: default ACTIVE; is_active=false (old code) → SUSPENDED; explicit DRAFT → not active', async () => {
    expect(await create({})).toMatchObject({ status: 'ACTIVE', isActive: true });
    expect(await create({ isActive: false })).toMatchObject({ status: 'SUSPENDED', isActive: false });
    expect(await create({ status: 'DRAFT' })).toMatchObject({ status: 'DRAFT', isActive: false });
  });

  it('update: status drives is_active; old code toggling is_active drives status', async () => {
    const n = await create({ status: 'DRAFT' });
    expect(await prisma.nursery.update({ where: { id: n.id }, data: { status: 'ACTIVE' } })).toMatchObject({ isActive: true });
    expect(await prisma.nursery.update({ where: { id: n.id }, data: { isActive: false } })).toMatchObject({ status: 'SUSPENDED' });
    expect(await prisma.nursery.update({ where: { id: n.id }, data: { isActive: true } })).toMatchObject({ status: 'ACTIVE' });
    expect(await prisma.nursery.update({ where: { id: n.id }, data: { status: 'ARCHIVED' } })).toMatchObject({ isActive: false });
    // שינוי שדה אחר לא נוגע בסטטוס
    expect(await prisma.nursery.update({ where: { id: n.id }, data: { name: 'y' } })).toMatchObject({ status: 'ARCHIVED', isActive: false });
  });
});
