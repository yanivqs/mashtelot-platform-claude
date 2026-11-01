'use client';

import { useActionState, useEffect, useRef, useState, useTransition, startTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowDown, ArrowUp, Copy, Monitor, Plus, Smartphone, Trash2 } from 'lucide-react';
import { ImageUpload } from '@/components/admin/image-upload';
import { RichTextEditor } from '@/components/admin/rich-text-editor';
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  MAX_BLOCKS,
  MAX_CARDS,
  MAX_FAQ,
  MAX_SLIDES,
  newBlock,
  type Block,
  type BlockOf,
  type BlockType,
} from '@/lib/page-blocks';
import {
  cancelScheduleAction,
  publishAction,
  restoreAction,
  saveDraftAction,
  searchProductsAction,
  setActiveAction,
  type BuilderState,
} from '@/app/admin/(dash)/page-builder/actions';

const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';
const initial: BuilderState = {};

export interface VersionRow {
  version: number;
  state: 'live' | 'scheduled' | 'past';
  publishAtLabel: string;
  createdByEmail: string | null;
}

type Patch<T extends Block> = (patch: Partial<T>) => void;

function Text({ label, value, onChange, max = 300, dir }: { label: string; value: string; onChange: (v: string) => void; max?: number; dir?: 'ltr' }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-gray-700">{label}</span>
      <input value={value} maxLength={max} dir={dir} onChange={(e) => onChange(e.target.value)} className={field} />
    </label>
  );
}

function CtaFields({ text, href, onText, onHref }: { text: string; href: string; onText: (v: string) => void; onHref: (v: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Text label="טקסט הכפתור" value={text} onChange={onText} max={60} />
      <Text label="קישור הכפתור (/catalog או https://…)" value={href} onChange={onHref} max={500} dir="ltr" />
    </div>
  );
}

function HeroFields({ b, set }: { b: BlockOf<'hero'>; set: Patch<BlockOf<'hero'>> }) {
  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">סוג</span>
        <select value={b.variant} onChange={(e) => set({ variant: e.target.value as BlockOf<'hero'>['variant'] })} className={field}>
          <option value="plain">רקע צבעוני</option>
          <option value="image">תמונה ברקע</option>
          <option value="carousel">קרוסלת תמונות</option>
          <option value="video">וידאו (YouTube)</option>
        </select>
      </label>
      <Text label="כותרת (ריק = שם המשתלה)" value={b.headline} onChange={(v) => set({ headline: v })} />
      <Text label="כותרת משנה" value={b.subheadline} onChange={(v) => set({ subheadline: v })} />
      {b.variant === 'image' && <ImageUpload key={`${b.id}-img`} label="תמונת רקע" folder="misc" hint="מידה מומלצת: 1920×800 פיקסלים (לרוחב). בנייד נחתכים הצדדים, אז כדאי שהעיקר יהיה במרכז התמונה." defaultValue={b.imageUrl} onChange={(url) => set({ imageUrl: url })} />}
      {b.variant === 'video' && <Text label="קישור YouTube" value={b.videoUrl} onChange={(v) => set({ videoUrl: v })} max={500} dir="ltr" />}
      {b.variant === 'carousel' && (
        <div className="space-y-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
          {b.slides.map((s, i) => {
            const upd = (patch: Partial<typeof s>) => set({ slides: b.slides.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="space-y-2 rounded-lg bg-white p-3">
                <div className="flex items-center justify-between text-xs font-medium text-gray-600">
                  <span>שקופית {i + 1}</span>
                  <button type="button" onClick={() => set({ slides: b.slides.filter((_, j) => j !== i) })} className="text-rose-700 hover:underline">
                    הסרה
                  </button>
                </div>
                <ImageUpload key={`${b.id}-s${i}-${s.imageUrl ? 1 : 0}`} folder="misc" hint="מידה מומלצת: 1920×800 פיקסלים (לרוחב). בנייד נחתכים הצדדים, אז כדאי שהעיקר יהיה במרכז התמונה." defaultValue={s.imageUrl} onChange={(url) => upd({ imageUrl: url })} />
                <Text label="כותרת" value={s.headline} onChange={(v) => upd({ headline: v })} />
                <Text label="כותרת משנה" value={s.subheadline} onChange={(v) => upd({ subheadline: v })} />
                <CtaFields text={s.ctaText} href={s.ctaHref} onText={(v) => upd({ ctaText: v })} onHref={(v) => upd({ ctaHref: v })} />
              </div>
            );
          })}
          {b.slides.length < MAX_SLIDES && (
            <button
              type="button"
              onClick={() => set({ slides: [...b.slides, { imageUrl: '', headline: '', subheadline: '', ctaText: '', ctaHref: '' }] })}
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              + הוספת שקופית
            </button>
          )}
        </div>
      )}
      <CtaFields text={b.ctaText} href={b.ctaHref} onText={(v) => set({ ctaText: v })} onHref={(v) => set({ ctaHref: v })} />
    </div>
  );
}

function ProductPicker({ target, b, set, titles }: { target: string; b: BlockOf<'products'>; set: Patch<BlockOf<'products'>>; titles: Record<string, string> }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Array<{ id: string; title: string }>>([]);
  const [known, setKnown] = useState<Record<string, string>>(titles);
  useEffect(() => {
    const t = window.setTimeout(() => {
      searchProductsAction(target, q).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, target]);
  const add = (p: { id: string; title: string }) => {
    setKnown((k) => ({ ...k, [p.id]: p.title }));
    if (!b.productIds.includes(p.id)) set({ productIds: [...b.productIds, p.id] });
  };
  return (
    <div className="space-y-2 rounded-lg border border-gray-100 bg-gray-50 p-3">
      <ol className="space-y-1 text-sm">
        {b.productIds.map((id, i) => (
          <li key={id} className="flex items-center gap-2 rounded bg-white px-2 py-1">
            <span className="flex-1 truncate">{known[id] ?? 'מוצר'}</span>
            <button type="button" aria-label="למעלה" disabled={i === 0} onClick={() => set({ productIds: swap(b.productIds, i, i - 1) })} className="disabled:opacity-30">
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button type="button" aria-label="הסרה" onClick={() => set({ productIds: b.productIds.filter((x) => x !== id) })} className="text-rose-700">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ol>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מוצר להוספה" aria-label="חיפוש מוצר להוספה" className={field} />
      <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
        {results
          .filter((r) => !b.productIds.includes(r.id))
          .map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => add(r)} className="w-full rounded px-2 py-1 text-right hover:bg-white">
                + {r.title}
              </button>
            </li>
          ))}
      </ul>
    </div>
  );
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

function BlockFields({
  b,
  set,
  target,
  categories,
  productTitles,
}: {
  b: Block;
  set: (patch: Partial<Block>) => void;
  target: string;
  categories: Array<{ id: string; name: string; depth: number }>;
  productTitles: Record<string, string>;
}) {
  switch (b.type) {
    case 'hero':
      return <HeroFields b={b} set={set as Patch<typeof b>} />;
    case 'text':
      return (
        <div className="space-y-3">
          <RichTextEditor key={b.id} defaultValue={b.html} onChange={(html) => set({ html } as Partial<typeof b>)} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={b.align === 'center'} onChange={(e) => set({ align: e.target.checked ? 'center' : 'right' } as Partial<typeof b>)} />
            יישור למרכז
          </label>
        </div>
      );
    case 'imageText':
      return (
        <div className="space-y-3">
          <ImageUpload key={`${b.id}-img`} folder="misc" hint="מידה מומלצת: 1200×900 פיקסלים (יחס 4:3)." defaultValue={b.imageUrl} onChange={(url) => set({ imageUrl: url } as Partial<typeof b>)} />
          <Text label="כותרת" value={b.title} onChange={(v) => set({ title: v } as Partial<typeof b>)} />
          <RichTextEditor key={b.id} defaultValue={b.html} onChange={(html) => set({ html } as Partial<typeof b>)} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">מיקום התמונה (במחשב)</span>
            <select value={b.imageSide} onChange={(e) => set({ imageSide: e.target.value as 'right' | 'left' } as Partial<typeof b>)} className={field}>
              <option value="right">ימין</option>
              <option value="left">שמאל</option>
            </select>
          </label>
          <CtaFields text={b.ctaText} href={b.ctaHref} onText={(v) => set({ ctaText: v } as Partial<typeof b>)} onHref={(v) => set({ ctaHref: v } as Partial<typeof b>)} />
        </div>
      );
    case 'products':
      return (
        <div className="space-y-3">
          <Text label="כותרת" value={b.title} onChange={(v) => set({ title: v } as Partial<typeof b>)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">אילו מוצרים</span>
              <select
                value={b.source}
                onChange={(e) => {
                  const source = e.target.value as typeof b.source;
                  set({ source, ...(source === 'mixed' ? { showCategory: true } : {}) } as Partial<typeof b>);
                }}
                className={field}
              >
                <option value="newest">החדשים ביותר</option>
                <option value="mixed">מגוון מקטגוריות שונות</option>
                <option value="sale">במבצע</option>
                <option value="category">מקטגוריה</option>
                <option value="manual">בחירה ידנית</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">כמה להציג</span>
              <input type="number" min={1} max={24} value={b.limit} onChange={(e) => set({ limit: Number(e.target.value) || 1 } as Partial<typeof b>)} className={field} />
            </label>
          </div>
          {b.source === 'category' && (
            <select value={b.categoryId} onChange={(e) => set({ categoryId: e.target.value } as Partial<typeof b>)} aria-label="קטגוריה" className={field}>
              <option value="">בחרו קטגוריה</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {'— '.repeat(c.depth)}
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {b.source === 'manual' && <ProductPicker target={target} b={b} set={set as Patch<typeof b>} titles={productTitles} />}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={b.showCategory} onChange={(e) => set({ showCategory: e.target.checked } as Partial<typeof b>)} />
            להציג את שם הקטגוריה בכרטיס המוצר
          </label>
        </div>
      );
    case 'contentCards':
      return (
        <div className="space-y-3">
          <Text label="כותרת" value={b.title} onChange={(v) => set({ title: v } as Partial<typeof b>)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">אילו דפים</span>
              <select value={b.source} onChange={(e) => set({ source: e.target.value as 'manual' | 'blog' } as Partial<typeof b>)} className={field}>
                <option value="blog">הפוסטים האחרונים בבלוג (אוטומטי)</option>
                <option value="manual">כרטיסים ידניים — קישור לכל דף באתר</option>
              </select>
            </label>
            {b.source === 'blog' && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">כמה להציג</span>
                <input type="number" min={1} max={MAX_CARDS} value={b.limit} onChange={(e) => set({ limit: Number(e.target.value) || 1 } as Partial<typeof b>)} className={field} />
              </label>
            )}
          </div>
          {b.source === 'blog' && <p className="text-xs text-gray-500">תמונת השער, הכותרת והתקציר של כל פוסט (דורש מודול בלוג פעיל).</p>}
          {b.source === 'manual' && (
            <>
              {b.cards.map((c, i) => {
                const upd = (patch: Partial<typeof c>) => set({ cards: b.cards.map((x, j) => (j === i ? { ...x, ...patch } : x)) } as Partial<typeof b>);
                return (
                  <div key={i} className="space-y-2 rounded-lg bg-gray-50 p-3">
                    <ImageUpload key={`${b.id}-card-${i}`} folder="misc" hint="מידה מומלצת: 1200×750 פיקסלים (יחס 16:10)." defaultValue={c.imageUrl} onChange={(url) => upd({ imageUrl: url })} />
                    <Text label={`כותרת כרטיס ${i + 1} *`} value={c.title} onChange={(v) => upd({ title: v })} max={120} />
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">תיאור</span>
                      <textarea rows={2} maxLength={400} value={c.text} onChange={(e) => upd({ text: e.target.value })} className={field} />
                    </label>
                    <Text label="קישור (/נתיב-בעמוד או https://…)" value={c.href} onChange={(v) => upd({ href: v })} max={500} dir="ltr" />
                    <div className="flex gap-3 text-xs">
                      {i > 0 && (
                        <button type="button" onClick={() => set({ cards: swap(b.cards, i, i - 1) } as Partial<typeof b>)} className="text-gray-600 hover:underline">
                          הזזה למעלה
                        </button>
                      )}
                      <button type="button" onClick={() => set({ cards: b.cards.filter((_, j) => j !== i) } as Partial<typeof b>)} className="text-rose-700 hover:underline">
                        הסרת הכרטיס
                      </button>
                    </div>
                  </div>
                );
              })}
              {b.cards.length < MAX_CARDS && (
                <button
                  type="button"
                  onClick={() => set({ cards: [...b.cards, { imageUrl: '', title: '', text: '', href: '' }] } as Partial<typeof b>)}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  + הוספת כרטיס
                </button>
              )}
            </>
          )}
        </div>
      );
    case 'categories':
      return (
        <div className="space-y-3">
          <Text label="כותרת" value={b.title} onChange={(v) => set({ title: v } as Partial<typeof b>)} />
          <p className="text-xs text-gray-500">בלי סימון — הקטגוריות הראשיות. מוצגות רק קטגוריות שיש בהן מוצרים פעילים, לפי הסדר שנקבע במסך "הקטגוריות שלי".</p>
          <div className="grid max-h-48 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={b.categoryIds.includes(c.id)}
                  onChange={(e) =>
                    set({ categoryIds: e.target.checked ? [...b.categoryIds, c.id] : b.categoryIds.filter((x) => x !== c.id) } as Partial<typeof b>)
                  }
                />
                {'— '.repeat(c.depth)}
                {c.name}
              </label>
            ))}
          </div>
        </div>
      );
    case 'cta':
      return (
        <div className="space-y-3">
          <Text label="כותרת *" value={b.title} onChange={(v) => set({ title: v } as Partial<typeof b>)} />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">טקסט</span>
            <textarea rows={2} maxLength={600} value={b.text} onChange={(e) => set({ text: e.target.value } as Partial<typeof b>)} className={field} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">רקע</span>
            <select value={b.tone} onChange={(e) => set({ tone: e.target.value as 'brand' | 'light' } as Partial<typeof b>)} className={field}>
              <option value="brand">צבע המותג</option>
              <option value="light">בהיר</option>
            </select>
          </label>
          <CtaFields text={b.ctaText} href={b.ctaHref} onText={(v) => set({ ctaText: v } as Partial<typeof b>)} onHref={(v) => set({ ctaHref: v } as Partial<typeof b>)} />
        </div>
      );
    case 'faq':
      return (
        <div className="space-y-3">
          <Text label="כותרת" value={b.title} onChange={(v) => set({ title: v } as Partial<typeof b>)} />
          {b.items.map((it, i) => {
            const upd = (patch: Partial<typeof it>) => set({ items: b.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) } as Partial<typeof b>);
            return (
              <div key={i} className="space-y-2 rounded-lg bg-gray-50 p-3">
                <Text label={`שאלה ${i + 1}`} value={it.q} onChange={(v) => upd({ q: v })} />
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-gray-700">תשובה</span>
                  <textarea rows={2} maxLength={2000} value={it.a} onChange={(e) => upd({ a: e.target.value })} className={field} />
                </label>
                <button type="button" onClick={() => set({ items: b.items.filter((_, j) => j !== i) } as Partial<typeof b>)} className="text-xs text-rose-700 hover:underline">
                  הסרת השאלה
                </button>
              </div>
            );
          })}
          {b.items.length < MAX_FAQ && (
            <button type="button" onClick={() => set({ items: [...b.items, { q: '', a: '' }] } as Partial<typeof b>)} className="text-sm font-medium text-brand-700 hover:underline">
              + הוספת שאלה
            </button>
          )}
        </div>
      );
    case 'contact':
      return (
        <div className="space-y-2 text-sm">
          <Text label="כותרת" value={b.title} onChange={(v) => set({ title: v } as Partial<typeof b>)} />
          <p className="text-xs text-gray-500">הפרטים נלקחים מהגדרות המשתלה.</p>
          {(
            [
              ['showHours', 'שעות פתיחה'],
              ['showPhone', 'טלפון ומייל'],
              ['showAddress', 'כתובת'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2 text-gray-700">
              <input type="checkbox" checked={b[k]} onChange={(e) => set({ [k]: e.target.checked } as Partial<typeof b>)} />
              {label}
            </label>
          ))}
        </div>
      );
    case 'spacer':
      return (
        <select value={b.size} onChange={(e) => set({ size: e.target.value as 'sm' | 'md' | 'lg' } as Partial<typeof b>)} aria-label="גודל המרווח" className={field}>
          <option value="sm">קטן</option>
          <option value="md">בינוני</option>
          <option value="lg">גדול</option>
        </select>
      );
  }
}

function Submit({ label, cls }: { label: string; cls: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={`rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 ${cls}`}>
      {pending ? '...' : label}
    </button>
  );
}

function Note({ state }: { state: BuilderState }) {
  if (state.error) return <p className="text-sm text-red-600">{state.error}</p>;
  if (state.message) return <p className="text-sm text-green-700">{state.message}</p>;
  return null;
}

/** שורה בהיסטוריה. ההודעות מוצגות ברמת הרשימה — שורה של תזמון שבוטל נעלמת אחרי הרענון. */
function VersionRowForms({
  target,
  v,
  onDone,
}: {
  target: string;
  v: VersionRow;
  onDone: (state: BuilderState) => void;
}) {
  const [pending, start] = useTransition();
  const call = (action: typeof restoreAction) =>
    start(async () => {
      const fd = new FormData();
      fd.set('target', target);
      fd.set('version', String(v.version));
      onDone(await action(initial, fd));
    });
  return (
    <li className="flex flex-wrap items-center gap-2 py-2 text-sm" data-testid="layout-version">
      <span className="font-medium">גרסה {v.version}</span>
      {v.state === 'live' && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">חיה</span>}
      {v.state === 'scheduled' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-800">מתוזמנת</span>}
      <span className="text-xs text-gray-500">
        {v.publishAtLabel}
        {v.createdByEmail ? ` · ${v.createdByEmail}` : ''}
      </span>
      <button type="button" disabled={pending} onClick={() => call(restoreAction)} className="ms-auto text-xs text-brand-700 hover:underline disabled:opacity-50">
        שחזור לטיוטה
      </button>
      {v.state === 'scheduled' && (
        <button type="button" disabled={pending} onClick={() => call(cancelScheduleAction)} className="text-xs text-rose-700 hover:underline disabled:opacity-50">
          ביטול התזמון
        </button>
      )}
    </li>
  );
}

/**
 * R03 עורך בלוקים: טיוטה נשמרת אוטומטית, התצוגה המקדימה מתרעננת אחרי כל שמירה,
 * פרסום עכשיו או בתזמון, היסטוריית גרסאות ושחזור.
 */
export function PageBuilderEditor({
  target,
  initialBlocks,
  versions,
  isActive,
  categories,
  productTitles,
  previewUrl,
  storeUrl,
}: {
  target: string;
  initialBlocks: Block[];
  versions: VersionRow[];
  isActive: boolean;
  categories: Array<{ id: string; name: string; depth: number }>;
  productTitles: Record<string, string>;
  previewUrl: string;
  storeUrl: string | null;
}) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [open, setOpen] = useState<string | null>(initialBlocks[0]?.id ?? null);
  const [addType, setAddType] = useState<BlockType>('text');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saveState, save, saving] = useActionState(saveDraftAction, initial);
  const [pubState, publish] = useActionState(publishAction, initial);
  const [actState, toggleActive] = useActionState(setActiveAction, initial);
  const [when, setWhen] = useState<'now' | 'schedule'>('now');
  const [historyNote, setHistoryNote] = useState<BuilderState>(initial);
  const first = useRef(true);

  // שמירה אוטומטית של הטיוטה (שנייה אחרי השינוי האחרון)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      const fd = new FormData();
      fd.set('target', target);
      fd.set('blocks', JSON.stringify(blocks));
      startTransition(() => save(fd));
    }, 1000);
    return () => window.clearTimeout(t);
  }, [blocks, target, save]);

  const update = (id: string, patch: Partial<Block>) => setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  const move = (i: number, d: -1 | 1) => setBlocks((prev) => swap(prev, i, i + d));
  const status = saving ? 'שומר...' : saveState.error ? null : saveState.ok ? 'הטיוטה נשמרה' : 'אין שינויים שלא נשמרו';

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500" data-testid="draft-status">
            {status}
          </span>
          {saveState.error && <span className="text-red-600">{saveState.error}</span>}
        </div>

        <ol className="space-y-3">
          {blocks.map((b, i) => (
            <li key={b.id} className="rounded-xl border border-gray-200 bg-white shadow-sm" data-testid="builder-block">
              <div className="flex items-center gap-2 px-4 py-3">
                <button type="button" onClick={() => setOpen(open === b.id ? null : b.id)} className="flex-1 text-right text-sm font-medium">
                  {i + 1}. {BLOCK_LABELS[b.type]}
                  {(b.hideOnMobile || b.hideOnDesktop) && (
                    <span className="mr-2 text-xs font-normal text-gray-500">{b.hideOnMobile ? '(מוסתר במובייל)' : '(מוסתר במחשב)'}</span>
                  )}
                </button>
                <button type="button" aria-label="הזזה למעלה" disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" aria-label="הזזה למטה" disabled={i === blocks.length - 1} onClick={() => move(i, 1)} className="rounded p-1 hover:bg-gray-100 disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="שכפול"
                  disabled={blocks.length >= MAX_BLOCKS}
                  onClick={() => setBlocks((prev) => [...prev.slice(0, i + 1), { ...structuredClone(b), id: newBlock(b.type).id }, ...prev.slice(i + 1)])}
                  className="rounded p-1 hover:bg-gray-100 disabled:opacity-30"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="מחיקת הבלוק"
                  onClick={() => confirm('למחוק את הבלוק?') && setBlocks((prev) => prev.filter((x) => x.id !== b.id))}
                  className="rounded p-1 text-rose-700 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {open === b.id && (
                <div className="space-y-4 border-t border-gray-100 px-4 py-4">
                  <BlockFields b={b} set={(patch) => update(b.id, patch)} target={target} categories={categories} productTitles={productTitles} />
                  <div className="flex flex-wrap gap-4 border-t border-gray-100 pt-3 text-xs text-gray-600">
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={b.hideOnMobile} onChange={(e) => update(b.id, { hideOnMobile: e.target.checked })} />
                      הסתרה במובייל
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={b.hideOnDesktop} onChange={(e) => update(b.id, { hideOnDesktop: e.target.checked })} />
                      הסתרה במחשב
                    </label>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>

        {blocks.length < MAX_BLOCKS && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-gray-300 p-3">
            <select value={addType} onChange={(e) => setAddType(e.target.value as BlockType)} aria-label="סוג בלוק להוספה" className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
              {BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BLOCK_LABELS[t]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const nb = newBlock(addType);
                setBlocks((prev) => [...prev, nb]);
                setOpen(nb.id);
              }}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              הוספת בלוק
            </button>
          </div>
        )}

        <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold">פרסום</h2>
          <form action={publish} className="space-y-3">
            <input type="hidden" name="target" value={target} />
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="when" value="now" checked={when === 'now'} onChange={() => setWhen('now')} />
                עכשיו
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="when" value="schedule" checked={when === 'schedule'} onChange={() => setWhen('schedule')} />
                בתאריך
              </label>
              {when === 'schedule' && <input type="datetime-local" name="publishAt" aria-label="מועד הפרסום" className="rounded-lg border border-gray-200 px-2 py-1 text-sm" />}
            </div>
            <p className="text-xs text-gray-500">
              הפרסום משתמש בטיוטה השמורה ויוצר גרסה נעולה. השינוי מופיע בחנות תוך כמה דקות.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Submit label={when === 'schedule' ? 'תזמון פרסום' : 'פרסום'} cls="bg-gray-900 text-white hover:bg-gray-800" />
              <Note state={pubState} />
            </div>
          </form>
          {versions.length > 0 && (
            <form action={toggleActive} className="flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3 text-sm">
              <input type="hidden" name="target" value={target} />
              <input type="hidden" name="active" value={isActive ? '0' : '1'} />
              <span className="text-gray-600">{isActive ? 'החנות מציגה את הדף מהבלוקים.' : 'החנות מציגה את התצוגה הרגילה.'}</span>
              <Submit label={isActive ? 'חזרה לתצוגה הרגילה' : 'הצגת הבלוקים שוב'} cls="border border-gray-300 text-gray-800 hover:bg-gray-50" />
              <Note state={actState} />
            </form>
          )}
        </section>

        {versions.length > 0 && (
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="font-semibold">היסטוריית גרסאות</h2>
            <Note state={historyNote} />
            <ul className="divide-y divide-gray-100">
              {versions.map((v) => (
                <VersionRowForms
                  key={v.version}
                  target={target}
                  v={v}
                  onDone={(r) => {
                    setHistoryNote(r);
                    if (r.ok && r.blocks) {
                      setBlocks(r.blocks);
                      setOpen(r.blocks[0]?.id ?? null);
                    }
                  }}
                />
              ))}
            </ul>
          </section>
        )}
      </div>

      <div className="space-y-2 xl:sticky xl:top-4 xl:self-start">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">תצוגה מקדימה (טיוטה)</span>
          <button type="button" onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'} className={`rounded p-1.5 ${device === 'desktop' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} aria-label="מחשב">
            <Monitor className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'} className={`rounded p-1.5 ${device === 'mobile' ? 'bg-gray-200' : 'hover:bg-gray-100'}`} aria-label="מובייל">
            <Smartphone className="h-4 w-4" />
          </button>
          <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="ms-auto text-xs text-brand-700 hover:underline">
            פתיחה בחלון
          </a>
          {storeUrl && (
            <a href={storeUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-700 hover:underline">
              לחנות
            </a>
          )}
        </div>
        <div className="flex justify-center overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
          <iframe
            key={saveState.savedAt ?? 0}
            src={previewUrl}
            title="תצוגה מקדימה"
            className="h-[75vh] bg-white"
            style={{ width: device === 'mobile' ? 390 : '100%' }}
          />
        </div>
      </div>
    </div>
  );
}
