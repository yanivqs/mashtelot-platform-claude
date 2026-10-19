/**
 * שער השחרור לייצור (PT-06, נספח א.7 — "שער שחרור לייצור"): מפרט מאושר + גרסת Artwork מאושרת +
 * קובץ ייצור עם checksum + הרשאה. כל אישור קשור לגרסה ספציפית. טהור — הנתונים נאספים בשרת.
 */

export type ProductionStatus = 'PENDING' | 'RELEASED' | 'IN_PRODUCTION' | 'QC' | 'COMPLETED' | 'BLOCKED';

export const PRODUCTION_LABELS: Record<ProductionStatus, string> = {
  PENDING: 'ממתין לאישורים',
  RELEASED: 'שוחרר לייצור',
  IN_PRODUCTION: 'בייצור',
  QC: 'בקרת איכות',
  COMPLETED: 'הושלם',
  BLOCKED: 'חסום',
};

/** מעברים מותרים (השחרור עצמו — רק דרך השער). */
const NEXT: Record<ProductionStatus, ProductionStatus[]> = {
  PENDING: ['BLOCKED'],
  RELEASED: ['IN_PRODUCTION', 'BLOCKED'],
  IN_PRODUCTION: ['QC', 'BLOCKED'],
  QC: ['COMPLETED', 'IN_PRODUCTION', 'BLOCKED'],
  COMPLETED: [],
  /** חזרה מחסימה: למצב שלפני השחרור, או ל"שוחרר" אם כבר שוחרר (השחרור עצמו אינו חוזר) */
  BLOCKED: ['PENDING', 'RELEASED'],
};

export function canMove(from: ProductionStatus, to: ProductionStatus, released = false): boolean {
  if (from === 'BLOCKED') return to === (released ? 'RELEASED' : 'PENDING');
  return NEXT[from].includes(to);
}

export function nextStatuses(from: ProductionStatus, released = false): ProductionStatus[] {
  return NEXT[from].filter((to) => canMove(from, to, released));
}

export interface GateItem {
  title: string;
  /** פריט מתבנית (פריט ממוצר ישן — אין לו מפרט/גרפיקה במערכת) */
  fromTemplate: boolean;
  /** פריט ממוצר קבוע: סטטוס גרסת המפרט שממנה הוזמן */
  savedRevisionStatus: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED' | null;
  requiresArtwork: boolean;
  /** גרסת הגרפיקה המאושרת העדכנית (של המוצר הקבוע או של ההזמנה) */
  approvedArtwork: { versionId: string; version: number } | null;
}

export interface GateInput {
  items: GateItem[];
  /** אישור מפרט של הזמנה חד-פעמית בידי בית הדפוס */
  orderSpecApproved: boolean;
  productionFile: { id: string; sha256: string } | null;
  isPrintHouse: boolean;
  status: ProductionStatus;
}

export interface GateCheck {
  key: 'spec' | 'artwork' | 'file' | 'role' | 'status';
  label: string;
  ok: boolean;
  detail?: string;
}

export function evaluateGate(g: GateInput): { ok: boolean; checks: GateCheck[] } {
  const tpl = g.items.filter((i) => i.fromTemplate);
  // מוצר קבוע: המפרט אושר כשהוזמן (APPROVED, או SUPERSEDED — אושר והוחלף אחר כך; ההזמנה נשארת על הגרסה שלה)
  const specOk = tpl.every((i) =>
    i.savedRevisionStatus ? i.savedRevisionStatus === 'APPROVED' || i.savedRevisionStatus === 'SUPERSEDED' : g.orderSpecApproved,
  );
  const missingArt = tpl.filter((i) => i.requiresArtwork && !i.approvedArtwork).map((i) => i.title);
  const checks: GateCheck[] = [
    { key: 'status', label: 'ההזמנה ממתינה לשחרור', ok: g.status === 'PENDING', detail: g.status === 'PENDING' ? undefined : PRODUCTION_LABELS[g.status] },
    { key: 'spec', label: 'מפרט מאושר', ok: specOk, detail: specOk ? undefined : 'יש לאשר את מפרט ההזמנה' },
    { key: 'artwork', label: 'גרפיקה מאושרת', ok: missingArt.length === 0, detail: missingArt.length ? `חסר אישור: ${missingArt.join(', ')}` : undefined },
    { key: 'file', label: 'קובץ ייצור עם חתימה', ok: Boolean(g.productionFile?.sha256), detail: g.productionFile ? `SHA-256 ${g.productionFile.sha256.slice(0, 12)}…` : 'לא הועלה קובץ ייצור' },
    { key: 'role', label: 'הרשאת שחרור (בית הדפוס)', ok: g.isPrintHouse },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}
