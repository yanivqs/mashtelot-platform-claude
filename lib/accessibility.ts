/**
 * נגישות של משתלה: פרטי ההצהרה ופניות על בעיות נגישות.
 * לפי תקנה 35א(ד), סטייה נחשבת להפרה רק אם לא תוקנה בתוך 60 ימים מההודעה, ולכן לכל פנייה נשמר מועד יעד.
 * מקבל את ה-DB כפרמטר (בר-בדיקה).
 */
import type { AccessibilityReportStatus, PrismaClient } from '@prisma/client';

export const REPORT_DUE_DAYS = 60;
export const REPORTS_PER_PAGE = 30;

export const REPORT_STATUS_LABELS: Record<AccessibilityReportStatus, string> = {
  OPEN: 'חדשה',
  IN_PROGRESS: 'בטיפול',
  RESOLVED: 'טופלה',
};

export interface NurseryAccessibilityInfo {
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
  /** הסדרי הנגישות במקום הפיזי */
  physicalArrangements: string;
  /** דרכי שירות חלופיות, למשל הזמנה טלפונית */
  alternatives: string;
  /** קוראי מסך ודפדפנים שנבדקו בפועל. מוצג בהצהרה רק אם מולא */
  testedWith: string;
  /** בדיקה ידנית בידי מומחה: מי ומתי. מוצג בהצהרה רק אם מולא */
  auditedBy: string;
  auditedAt: string;
  buttonSide: 'left' | 'right';
  updatedAt: string | null;
}

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export function parseAccessibilityInfo(raw: unknown): NurseryAccessibilityInfo {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const auditedAt = text(o.auditedAt, 10);
  const updatedAt = text(o.updatedAt, 30);
  return {
    coordinatorName: text(o.coordinatorName, 120),
    coordinatorPhone: text(o.coordinatorPhone, 30),
    coordinatorEmail: text(o.coordinatorEmail, 200),
    physicalArrangements: text(o.physicalArrangements, 2000),
    alternatives: text(o.alternatives, 1000),
    testedWith: text(o.testedWith, 300),
    auditedBy: text(o.auditedBy, 200),
    auditedAt: /^\d{4}-\d{2}-\d{2}$/.test(auditedAt) ? auditedAt : '',
    buttonSide: o.buttonSide === 'right' ? 'right' : 'left',
    updatedAt: updatedAt && !Number.isNaN(Date.parse(updatedAt)) ? updatedAt : null,
  };
}

export function reportDueDate(from: Date): Date {
  return new Date(from.getTime() + REPORT_DUE_DAYS * 24 * 60 * 60 * 1000);
}

/** ימים עד המועד: 0 ביום עצמו, ומספר שלילי אחריו. */
export function reportDaysLeft(dueAt: Date, now: Date = new Date()): number {
  return Math.ceil((dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

export interface ReportInput {
  description: string;
  pageUrl: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+\-\s()]{7,20}$/;

/** חייבים תיאור ודרך ליצור קשר, אחרת אי אפשר לחזור לפונה. */
export function validateReport(raw: Partial<Record<keyof ReportInput, unknown>>): { ok: true; input: ReportInput } | { ok: false; error: string } {
  const input: ReportInput = {
    description: text(raw.description, 3000),
    pageUrl: text(raw.pageUrl, 500),
    contactName: text(raw.contactName, 120),
    contactEmail: text(raw.contactEmail, 200).toLowerCase(),
    contactPhone: text(raw.contactPhone, 30),
  };
  if (input.description.length < 5) return { ok: false, error: 'נא לתאר את הבעיה' };
  if (!input.contactEmail && !input.contactPhone) return { ok: false, error: 'נא להשאיר אימייל או טלפון, כדי שנוכל לחזור אליכם' };
  if (input.contactEmail && !EMAIL.test(input.contactEmail)) return { ok: false, error: 'כתובת האימייל לא תקינה' };
  if (input.contactPhone && !PHONE.test(input.contactPhone)) return { ok: false, error: 'מספר הטלפון לא תקין' };
  return { ok: true, input };
}

export async function createAccessibilityReport(db: PrismaClient, nurseryId: string, input: ReportInput, now: Date = new Date()) {
  return db.accessibilityReport.create({
    data: {
      nurseryId,
      description: input.description,
      pageUrl: input.pageUrl || null,
      contactName: input.contactName || null,
      contactEmail: input.contactEmail || null,
      contactPhone: input.contactPhone || null,
      createdAt: now,
      dueAt: reportDueDate(now),
    },
  });
}

/** שינוי סטטוס בתוך המשתלה בלבד. סגירה שומרת את מועד הטיפול, ופתיחה מחדש מוחקת אותו. */
export async function updateReportStatus(db: PrismaClient, nurseryId: string, id: string, status: AccessibilityReportStatus, handlingNote: string): Promise<boolean> {
  const r = await db.accessibilityReport.updateMany({
    where: { id, nurseryId },
    data: { status, handlingNote: handlingNote.trim().slice(0, 2000) || null, resolvedAt: status === 'RESOLVED' ? new Date() : null },
  });
  return r.count > 0;
}
