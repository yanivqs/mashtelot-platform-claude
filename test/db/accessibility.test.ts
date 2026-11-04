/**
 * נגישות: פניות, בידוד בין משתלות, מועד 60 הימים, מחיקה בבקשת פרטיות, ובדיקת התוכן.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/prisma';
import { deleteCustomerData, exportCustomerData } from '@/lib/customer-privacy';
import { createAccessibilityReport, updateReportStatus } from '@/lib/accessibility';
import { runAccessibilityAudit } from '@/lib/accessibility-audit';
import { createTenantFixtures, destroyTenantFixtures, type TenantFixtures } from './fixtures';

let f: TenantFixtures;

beforeAll(async () => {
  f = await createTenantFixtures(prisma);
});

afterAll(async () => {
  await prisma.accessibilityReport.deleteMany({ where: { nurseryId: { in: [f.A.nurseryId, f.B.nurseryId] } } });
  await destroyTenantFixtures(prisma, f);
  await prisma.$disconnect();
});

const input = (contactEmail: string) => ({ description: 'הכפתור לא נגיש', pageUrl: '/cart', contactName: 'דנה', contactEmail, contactPhone: '050-1234567' });

describe('accessibility reports', () => {
  it('a new report is open with a deadline 60 days after the notice', async () => {
    const now = new Date('2026-11-03T10:00:00Z');
    const r = await createAccessibilityReport(prisma, f.A.nurseryId, input('new@example.com'), now);
    expect(r.status).toBe('OPEN');
    expect(r.dueAt.toISOString()).toBe('2027-01-02T10:00:00.000Z');
  });

  it('nursery isolation: B cannot update a report of A', async () => {
    const r = await createAccessibilityReport(prisma, f.A.nurseryId, input('iso@example.com'));
    expect(await updateReportStatus(prisma, f.B.nurseryId, r.id, 'RESOLVED', 'ניסיון')).toBe(false);
    expect((await prisma.accessibilityReport.findUnique({ where: { id: r.id } }))?.status).toBe('OPEN');
  });

  it('resolving stores the time, and reopening clears it', async () => {
    const r = await createAccessibilityReport(prisma, f.A.nurseryId, input('flow@example.com'));
    expect(await updateReportStatus(prisma, f.A.nurseryId, r.id, 'RESOLVED', ' תוקן ')).toBe(true);
    const done = await prisma.accessibilityReport.findUnique({ where: { id: r.id } });
    expect(done?.resolvedAt).not.toBeNull();
    expect(done?.handlingNote).toBe('תוקן');
    await updateReportStatus(prisma, f.A.nurseryId, r.id, 'IN_PROGRESS', '');
    const again = await prisma.accessibilityReport.findUnique({ where: { id: r.id } });
    expect(again?.resolvedAt).toBeNull();
    expect(again?.handlingNote).toBeNull();
  });

  it('a privacy request exports the report and removes the contact details, keeping the record of the issue', async () => {
    const r = await createAccessibilityReport(prisma, f.A.nurseryId, input('erase@example.com'));
    const exported = await exportCustomerData(prisma, f.A.nurseryId, 'erase@example.com');
    expect(exported?.accessibilityReports).toHaveLength(1);
    expect((await deleteCustomerData(prisma, f.A.nurseryId, 'erase@example.com')).ok).toBe(true);
    const after = await prisma.accessibilityReport.findUnique({ where: { id: r.id } });
    expect(after).toMatchObject({ contactName: null, contactEmail: null, contactPhone: null, description: 'הכפתור לא נגיש' });
  });
});

describe('content audit', () => {
  const ids = async (nurseryId: string) => (await runAccessibilityAudit(prisma, nurseryId)).map((x) => x.id);

  it('finds problems in the pages of this nursery only', async () => {
    await prisma.staticPage.update({ where: { id: f.A.pageId }, data: { contentHtml: '<img src="a.jpg"><a href="/x.pdf">מחירון</a>' } });
    expect(await ids(f.A.nurseryId)).toEqual(expect.arrayContaining(['content-alt', 'content-documents']));
    expect(await ids(f.B.nurseryId)).not.toContain('content-alt');
  });

  it('reports overdue requests, and stops once they are resolved', async () => {
    const r = await createAccessibilityReport(prisma, f.B.nurseryId, input('late@example.com'), new Date(Date.now() - 61 * 86400000));
    expect(await ids(f.B.nurseryId)).toContain('reports-overdue');
    await updateReportStatus(prisma, f.B.nurseryId, r.id, 'RESOLVED', '');
    expect(await ids(f.B.nurseryId)).not.toContain('reports-overdue');
  });

  it('a filled statement removes its reminders', async () => {
    await prisma.nursery.update({
      where: { id: f.B.nurseryId },
      data: { accessibilityInfo: { coordinatorName: 'דנה', physicalArrangements: 'חניה בכניסה', auditedAt: '2026-10-01' } },
    });
    const found = await ids(f.B.nurseryId);
    for (const id of ['statement-coordinator', 'statement-physical', 'statement-audit']) expect(found).not.toContain(id);
  });
});
