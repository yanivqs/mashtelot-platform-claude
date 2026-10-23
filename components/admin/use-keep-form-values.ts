'use client';

import { useEffect, useState } from 'react';

/**
 * UX-01: React 19 מאפס טופס `<form action>` אחרי כל Server Action — גם כשהשרת החזיר שגיאה,
 * ואז המשתמש מאבד את מה שהקליד. ה-hook שומר את ערכי השדות ברגע השליחה, ומחזיר אותם אחרי
 * תשובה עם שגיאה (`error`, או `ok: false`) — אחרי שהאיפוס כבר קרה. סיסמאות, קבצים ושדות מוסתרים — לא משוחזרים.
 *
 * שימוש: `const keep = useKeepFormValues(state);` ואז `<form ref={keep} action={action}>`.
 */

// צילום הערכים לפי אלמנט הטופס — מחוץ ל-React, כדי שלא יהיו refs שנקראים בזמן רינדור
const snapshots = new WeakMap<HTMLFormElement, Map<string, string[]>>();

// מאזין submit נייטיבי על הטופס — רץ לפני ש-React מפעיל את ה-action ומאפס
function capture(e: SubmitEvent) {
  const form = e.currentTarget as HTMLFormElement;
  const m = new Map<string, string[]>();
  for (const [k, v] of new FormData(form).entries()) if (typeof v === 'string') m.set(k, [...(m.get(k) ?? []), v]);
  snapshots.set(form, m);
}

function restore(form: HTMLFormElement, snap: Map<string, string[]>) {
  for (const el of Array.from(form.elements)) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) || !el.name) continue;
    if (el instanceof HTMLInputElement && ['password', 'file', 'hidden', 'submit', 'button'].includes(el.type)) continue;
    const values = snap.get(el.name) ?? [];
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      el.checked = values.includes(el.value);
    } else if (el instanceof HTMLSelectElement && el.multiple) {
      for (const o of Array.from(el.options)) o.selected = values.includes(o.value);
    } else if (values.length) {
      el.value = values[0]!;
    }
  }
}

export function useKeepFormValues(state: { error?: string | null; ok?: boolean } | undefined) {
  // setState כ-callback ref — מותר להעביר בזמן רינדור
  const [form, attach] = useState<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!form) return;
    form.addEventListener('submit', capture);
    return () => form.removeEventListener('submit', capture);
  }, [form]);

  useEffect(() => {
    const snap = form && snapshots.get(form);
    const failed = Boolean(state?.error) || state?.ok === false;
    if (failed && form && snap) restore(form, snap);
  }, [state, form]);

  return attach;
}
