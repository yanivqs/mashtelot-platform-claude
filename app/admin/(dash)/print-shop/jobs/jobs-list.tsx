'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { FileText, Pencil, Printer, Search } from 'lucide-react';
import { ArtworkPanel, type ArtworkVersionVM } from '@/components/print/artwork-panel';
import { QuantityPicker } from '@/components/print/template-fields';
import { quotePrint, type CleanValues, type TemplateField, type TemplatePricing } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';
import { archiveSavedAction, decideQuoteAction, renameJobAction, reorderSavedAction } from '../actions';

export interface JobVM {
  id: string;
  name: string;
  productTitle: string;
  productHref: string;
  canOrderSimilar: boolean;
  image: string | null;
  fileName: string | null;
  fileType: string | null;
  description: string[];
  lastOrderAt: string | null;
  lastQuantity: number | null;
  lastTotal: number | null;
  orderCount: number;
  status: string;
  production: string | null;
  reasons: string[];
  needsDesign: boolean;
  rejectionNote: string | null;
  quote: null | { orderId: string; total: number; validUntil: string | null; expired: boolean };
  blocked: string | null;
  reorder: null | { fields: TemplateField[]; pricing: TemplatePricing; raw: CleanValues; unitLabel: string | null };
  artwork: ArtworkVersionVM[];
}

export interface OlderOrderVM {
  id: string;
  name: string;
  description: string[];
  image: string | null;
  at: string;
  quantity: number;
  total: number;
  status: string;
  production: string | null;
}

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short' });
const date = (iso: string) => dateFmt.format(new Date(iso));
const input = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Thumb({ src, fileType }: { src: string | null; fileType: string | null }) {
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 sm:h-24 sm:w-24">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain" />
      ) : fileType ? (
        <span className="flex flex-col items-center gap-1 text-xs font-medium text-gray-600">
          <FileText className="h-7 w-7" />
          {fileType}
        </span>
      ) : (
        <Printer className="h-7 w-7 text-gray-400" />
      )}
    </div>
  );
}

function Rename({ job }: { job: JobVM }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(job.name);
  const [pending, start] = useTransition();
  if (!editing) {
    return (
      <h2 className="flex items-start gap-1.5 font-bold">
        <span className="min-w-0 break-words">{job.name}</span>
        <button type="button" aria-label={`שינוי שם: ${job.name}`} onClick={() => setEditing(true)} className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100">
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </h2>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await renameJobAction({ savedProductId: job.id, name });
          setEditing(false);
        });
      }}
    >
      <input value={name} maxLength={80} autoFocus aria-label="שם העבודה" onChange={(e) => setName(e.target.value)} className={`${input} max-w-xs`} />
      <button disabled={pending} className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60">
        שמירה
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-600">
        ביטול
      </button>
    </form>
  );
}

function Reorder({ job, onClose }: { job: JobVM; onClose: () => void }) {
  const r = job.reorder!;
  const router = useRouter();
  const [qty, setQty] = useState(String(job.lastQuantity ?? r.pricing.quantityOptions[0] ?? r.pricing.minQuantity));
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const q = quotePrint(r.pricing, r.fields, r.raw, Number(qty));

  if (msg?.ok) {
    return (
      <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">
        {msg.text}{' '}
        <button type="button" onClick={onClose} className="font-medium underline">
          סגירה
        </button>
      </div>
    );
  }
  return (
    <form
      className="mt-3 space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await reorderSavedAction({ savedProductId: job.id, quantity: Number(qty), notes });
          if (res.ok) {
            setMsg({ ok: true, text: res.quoteOnly ? 'הבקשה נשלחה לבדיקת בית הדפוס ✓' : `ההזמנה התקבלה ✓ סה״כ ${formatPrice(res.total ?? 0)}.` });
            router.refresh();
          } else setMsg({ ok: false, text: res.error ?? 'שגיאה' });
        });
      }}
    >
      <QuantityPicker options={r.pricing.quantityOptions} allowCustom={r.pricing.allowCustomQuantity} min={r.pricing.minQuantity} unitLabel={r.unitLabel} quantity={qty} onChange={setQty} />
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">הערות לבית הדפוס</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={input} />
      </label>
      {q.ok && !q.quote.quoteOnly && (
        <p className="text-sm" data-testid="reorder-price">
          <span className="font-bold">מחיר מעודכן: {formatPrice(q.quote.total)}</span> <span className="text-gray-600">({formatPrice(q.quote.perUnit)} ליחידה)</span>
          {job.lastTotal !== null && <span className="block text-xs text-gray-600">בהזמנה האחרונה: {formatPrice(job.lastTotal)}{job.lastQuantity ? ` עבור ${job.lastQuantity.toLocaleString('he-IL')} יח׳` : ''}</span>}
        </p>
      )}
      {q.ok && q.quote.quoteOnly && <p className="text-sm text-amber-900">יעבור לבדיקת צוות: {q.quote.reasons.join(' · ')}</p>}
      {!q.ok && <p className="text-sm text-amber-900">{q.error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || !q.ok} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
          {pending ? 'שולח...' : q.ok && q.quote.quoteOnly ? 'שליחה לבדיקה' : 'שליחת הזמנה'}
        </button>
        <button type="button" onClick={onClose} className="text-sm text-gray-600">
          ביטול
        </button>
        {msg && <span className="text-sm text-red-600">{msg.text}</span>}
      </div>
    </form>
  );
}

function QuoteDecision({ quote }: { quote: NonNullable<JobVM['quote']> }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const decide = (approve: boolean) =>
    start(async () => {
      const r = await decideQuoteAction({ orderId: quote.orderId, approve });
      if (r.ok) router.refresh();
      else setError(r.error ?? 'שגיאה');
    });
  return (
    <div className="mt-3 rounded-lg bg-sky-50 p-3 text-sm" data-testid="quote-offer">
      <p className="font-bold">הצעת מחיר: {formatPrice(quote.total)}</p>
      {quote.validUntil && <p className="text-xs text-gray-700">{quote.expired ? 'התוקף פג ב-' : 'בתוקף עד '}{date(quote.validUntil)}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        {!quote.expired && (
          <button type="button" disabled={pending} onClick={() => decide(true)} className="rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
            אישור ההצעה
          </button>
        )}
        <button type="button" disabled={pending} onClick={() => decide(false)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 disabled:opacity-60">
          דחייה
        </button>
      </div>
      {quote.expired && <p className="mt-2 text-xs text-gray-700">להצעה חדשה פנו לבית הדפוס.</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function JobCard({ job }: { job: JobVM }) {
  const [reordering, setReordering] = useState(false);
  const [artworkOpen, setArtworkOpen] = useState(job.artwork[0]?.status === 'PROOF_SENT' || job.needsDesign);
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm" data-testid="job-card">
      <div className="flex gap-4">
        <Thumb src={job.image} fileType={job.fileType} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between">
            <div className="w-full min-w-0 sm:flex-1">
              <Rename job={job} />
            </div>
            <span className="flex shrink-0 flex-wrap gap-1.5">
              {job.production && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">{job.production}</span>}
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">{job.status}</span>
            </span>
          </div>
          {job.description.length > 0 && <p className="mt-1 text-sm text-gray-600">{job.description.join(' · ')}</p>}
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <div className="flex gap-1">
              <dt className="text-gray-600">הזמנה אחרונה:</dt>
              <dd className="font-medium">{job.lastOrderAt ? date(job.lastOrderAt) : 'טרם הוזמנה'}</dd>
            </div>
            {job.lastQuantity !== null && (
              <div className="flex gap-1">
                <dt className="text-gray-600">כמות:</dt>
                <dd className="font-medium">{job.lastQuantity.toLocaleString('he-IL')}</dd>
              </div>
            )}
            {job.lastTotal !== null && (
              <div className="flex gap-1">
                <dt className="text-gray-600">מחיר אחרון:</dt>
                <dd className="font-medium">{formatPrice(job.lastTotal)}</dd>
              </div>
            )}
            {job.orderCount > 1 && (
              <div className="flex gap-1">
                <dt className="text-gray-600">הוזמנה:</dt>
                <dd className="font-medium">{job.orderCount} פעמים</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {job.reasons.length > 0 && !job.quote && <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">בבדיקת צוות: {job.reasons.join(' · ')}</p>}
      {job.rejectionNote && <p className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-800">הערת בית הדפוס: {job.rejectionNote}</p>}
      {job.quote && <QuoteDecision quote={job.quote} />}

      {reordering && job.reorder && <Reorder job={job} onClose={() => setReordering(false)} />}

      {artworkOpen && (
        <div className="mt-3">
          {job.needsDesign && <p className="mb-2 text-xs text-gray-700">ביקשתם עיצוב: בית הדפוס יעלה כאן את ההגהה. יש לכם קובץ בכל זאת? אפשר להעלות אותו.</p>}
          <ArtworkPanel subject={{ savedProductId: job.id }} versions={job.artwork} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        {job.reorder ? (
          <button type="button" onClick={() => setReordering((o) => !o)} aria-expanded={reordering} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
            הזמן שוב
          </button>
        ) : (
          job.blocked && <span className="text-sm text-gray-700">{job.blocked}</span>
        )}
        {job.canOrderSimilar && (
          <Link href={`${job.productHref}?from=${job.id}`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
            הזמנה דומה
          </Link>
        )}
        <button type="button" onClick={() => setArtworkOpen((o) => !o)} aria-expanded={artworkOpen} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50">
          קובץ והגהות
        </button>
        <form action={archiveSavedAction} className="mr-auto">
          <input type="hidden" name="id" value={job.id} />
          <button className="text-sm text-gray-600 underline hover:text-gray-900">הסרה מהרשימה</button>
        </form>
      </div>
    </article>
  );
}

export function JobsList({ jobs, older }: { jobs: JobVM[]; older: OlderOrderVM[] }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const shown = q ? jobs.filter((j) => [j.name, j.productTitle, j.fileName ?? '', ...j.description].join(' ').toLowerCase().includes(q)) : jobs;

  if (jobs.length === 0 && older.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-600">עוד לא הזמנתם עבודות. אחרי ההזמנה הראשונה היא תופיע כאן, ואפשר יהיה להזמין אותה שוב בלחיצה.</p>
        <Link href="/admin/print-shop" className="mt-3 inline-block rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          לקטלוג מוצרי הדפוס
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.length > 3 && (
        <label className="relative block max-w-sm">
          <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-gray-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="חיפוש עבודה" aria-label="חיפוש עבודה" className={`${input} pr-9`} />
        </label>
      )}
      {shown.map((j) => (
        <JobCard key={j.id} job={j} />
      ))}
      {q && shown.length === 0 && <p className="text-sm text-gray-600">לא נמצאו עבודות.</p>}

      {older.length > 0 && (
        <section className="pt-4">
          <h2 className="mb-2 font-bold">הזמנות קודמות</h2>
          <div className="space-y-3">
            {older.map((o) => (
              <article key={o.id} className="flex gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm" data-testid="older-order">
                <Thumb src={o.image} fileType={null} />
                <div className="min-w-0 flex-1 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="font-bold">{o.name}</h3>
                    <span className="flex flex-wrap gap-1.5">
                      {o.production && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">{o.production}</span>}
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-800">{o.status}</span>
                    </span>
                  </div>
                  {o.description.length > 0 && <p className="mt-1 text-gray-600">{o.description.join(' · ')}</p>}
                  <p className="mt-2 text-gray-700">
                    {date(o.at)} · כמות {o.quantity.toLocaleString('he-IL')} · {formatPrice(o.total)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
