'use client';

import { useActionState, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { PrintFileUpload } from '@/components/print/file-upload';
import { TemplateFields } from '@/components/print/template-fields';
import type { RawValues, TemplateField } from '@/lib/print-template';
import { addImportedOrderAction, createImportedJobAction, deleteImportedJobAction, startImportedUpload, updateImportedJobAction, type ImportState } from './actions';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const today = () => new Date().toISOString().slice(0, 10);

export interface TemplateOption {
  id: string;
  title: string;
  fields: TemplateField[];
}

export function NewImportedJobForm({ nurseries, templates, defaultNurseryId }: { nurseries: Array<{ id: string; name: string }>; templates: TemplateOption[]; defaultNurseryId: string }) {
  const router = useRouter();
  const blank = { name: '', description: '', templateId: '', date: today(), quantity: '', price: '' };
  const [nurseryId, setNurseryId] = useState(defaultNurseryId);
  const [form, setForm] = useState(blank);
  const [values, setValues] = useState<RawValues>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const template = templates.find((t) => t.id === form.templateId);
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form
      className="grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setFieldErrors({});
        start(async () => {
          const r = await createImportedJobAction({ nurseryId, ...form, values });
          if (r.ok) {
            setCreated(form.name);
            setForm({ ...blank, date: form.date });
            setValues({});
            router.push(`/admin/print-jobs?nursery=${nurseryId}`);
            router.refresh();
          } else {
            setFieldErrors(r.fieldErrors ?? {});
            setError(r.error ?? (r.fieldErrors ? 'יש לתקן את השדות המסומנים' : 'שגיאה'));
          }
        });
      }}
    >
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">משתלה</span>
        <select value={nurseryId} onChange={(e) => setNurseryId(e.target.value)} className={`${field} bg-white`}>
          {nurseries.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">שם העבודה</span>
        <input value={form.name} onChange={set('name')} maxLength={80} required className={field} />
      </label>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">תיאור העבודה</span>
        <textarea value={form.description} onChange={set('description')} rows={2} maxLength={2000} className={field} />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">תאריך הזמנה</span>
        <input type="date" value={form.date} max={today()} onChange={set('date')} required className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">כמות</span>
          <input type="number" min="1" step="1" value={form.quantity} onChange={set('quantity')} required className={field} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-gray-700">מחיר ₪ (לא חובה)</span>
          <input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} className={field} />
        </label>
      </div>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-gray-700">מוצר מהקטלוג</span>
        <select
          value={form.templateId}
          onChange={(e) => {
            setForm((f) => ({ ...f, templateId: e.target.value }));
            setValues({});
          }}
          className={`${field} bg-white`}
        >
          <option value="">ללא: הזמנה חוזרת תעבור להצעת מחיר</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-gray-600">עם מוצר מהקטלוג, הזמנה חוזרת מקבלת מחיר מיידי לפי המחירון.</span>
      </label>
      {template && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 sm:col-span-2">
          <TemplateFields fields={template.fields} values={values} errors={fieldErrors} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button disabled={pending} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
          {pending ? 'שומר...' : 'הוספת העבודה'}
        </button>
        {created && !error && <span className="text-sm text-green-700">&quot;{created}&quot; נוספה ✓ עכשיו אפשר להעלות לה קובץ ברשימה למטה.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}

function Feedback({ state, ok }: { state: ImportState; ok: string }) {
  return (
    <>
      {state.ok && <span className="text-xs text-green-700">{ok}</span>}
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </>
  );
}

/** ניהול עבודה קיימת: קובץ, פרטים, הזמנה קודמת נוספת, מחיקה. */
export function ImportedJobTools({ id, name, description }: { id: string; name: string; description: string }) {
  const router = useRouter();
  const [orderState, orderAction] = useActionState(addImportedOrderAction, {} as ImportState);
  const keepOrder = useKeepFormValues(orderState);
  const [editState, editAction] = useActionState(updateImportedJobAction, {} as ImportState);
  const keepEdit = useKeepFormValues(editState);
  const [delState, delAction] = useActionState(deleteImportedJobAction, {} as ImportState);
  return (
    <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
      <PrintFileUpload label="העלאת קובץ העבודה" withThumbnail start={() => startImportedUpload(id)} onDone={() => router.refresh()} />
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-gray-700">עריכת פרטים</summary>
        <form ref={keepEdit} action={editAction} className="mt-2 space-y-2">
          <input type="hidden" name="id" value={id} />
          <input name="name" defaultValue={name} aria-label={`שם העבודה: ${name}`} maxLength={80} className={field} />
          <textarea name="description" defaultValue={description} aria-label={`תיאור העבודה: ${name}`} rows={2} maxLength={2000} className={field} />
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white">שמירה</button>
            <Feedback state={editState} ok="נשמר ✓" />
          </div>
        </form>
      </details>
      <details className="text-sm">
        <summary className="cursor-pointer font-medium text-gray-700">הוספת הזמנה קודמת</summary>
        <form ref={keepOrder} action={orderAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={id} />
          <label className="text-xs">
            <span className="mb-0.5 block text-gray-600">תאריך</span>
            <input name="date" type="date" max={today()} required aria-label={`תאריך הזמנה: ${name}`} className={field} />
          </label>
          <label className="w-24 text-xs">
            <span className="mb-0.5 block text-gray-600">כמות</span>
            <input name="quantity" type="number" min="1" step="1" required aria-label={`כמות: ${name}`} className={field} />
          </label>
          <label className="w-28 text-xs">
            <span className="mb-0.5 block text-gray-600">מחיר ₪</span>
            <input name="price" type="number" min="0" step="0.01" aria-label={`מחיר: ${name}`} className={field} />
          </label>
          <button className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white">הוספה</button>
          <Feedback state={orderState} ok="נוספה ✓" />
        </form>
      </details>
      <form
        action={delAction}
        onSubmit={(e) => {
          if (!window.confirm(`למחוק את העבודה "${name}"?`)) e.preventDefault();
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="id" value={id} />
        <button className="text-sm text-red-700 underline">מחיקת העבודה</button>
        <Feedback state={delState} ok="נמחקה ✓" />
      </form>
    </div>
  );
}
