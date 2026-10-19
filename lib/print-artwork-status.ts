/** תוויות סטטוס של גרסת גרפיקה (PT-05) — מודול משותף לשרת ולדפדפן (לא קובץ 'use client'). */
export type ArtworkStatus = 'UPLOADED' | 'PROOF_SENT' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';

export const ARTWORK_STATUS: Record<ArtworkStatus, { label: string; cls: string }> = {
  UPLOADED: { label: 'ממתין להגהה מבית הדפוס', cls: 'bg-gray-100 text-gray-700' },
  PROOF_SENT: { label: 'הגהה ממתינה לאישורכם', cls: 'bg-amber-50 text-amber-800' },
  APPROVED: { label: 'מאושר לדפוס', cls: 'bg-green-50 text-green-700' },
  REJECTED: { label: 'נדחה', cls: 'bg-rose-50 text-rose-700' },
  SUPERSEDED: { label: 'הוחלף בגרסה חדשה', cls: 'bg-gray-50 text-gray-400' },
};
