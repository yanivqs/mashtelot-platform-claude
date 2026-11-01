'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, Search, Trash2, Upload, X } from 'lucide-react';
import { shrinkImageIfNeeded } from '@/lib/shrink-image';

export interface FolderTile {
  id: string;
  url: string;
  fileName: string;
  usedCount: number;
  /** רק בתצוגת בעל המשתלה */
  usedIn?: Array<{ id: string; title: string }>;
}

export interface AssignableProduct {
  id: string;
  title: string;
  hasImage: boolean;
  imageRequired: boolean;
}

/** העלאת תמונות מרובות, אחת-אחת: קובץ שנכשל לא עוצר את השאר, ומדווח בשמו. */
export function FolderUploader({ upload }: { upload: (formData: FormData) => Promise<{ url?: string; error?: string }> }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [failures, setFailures] = useState<Array<{ name: string; error: string }>>([]);
  const [dragging, setDragging] = useState(false);

  async function uploadAll(files: File[]) {
    if (files.length === 0 || progress) return;
    setFailures([]);
    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length });
      try {
        const fd = new FormData();
        fd.set('file', await shrinkImageIfNeeded(file));
        const res = await upload(fd);
        if (res.error) setFailures((f) => [...f, { name: file.name, error: res.error! }]);
      } catch {
        setFailures((f) => [...f, { name: file.name, error: 'העלאת הקובץ נכשלה' }]);
      }
    }
    setProgress(null);
    router.refresh();
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void uploadAll(Array.from(e.dataTransfer.files));
        }}
        className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${
          dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white'
        }`}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={Boolean(progress)}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {progress ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {progress ? `מעלה ${progress.current} מתוך ${progress.total}` : 'העלאת תמונות'}
        </button>
        <p className="text-xs text-gray-500">
          אפשר לבחור כמה תמונות יחד, או לגרור אותן לכאן. JPG, PNG, WEBP, GIF, AVIF. תמונות גדולות מוקטנות אוטומטית.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          aria-label="בחירת תמונות להעלאה"
          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
          className="hidden"
          onChange={(e) => {
            void uploadAll(Array.from(e.target.files ?? []));
            e.target.value = '';
          }}
        />
      </div>
      {failures.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded-lg bg-red-50 p-3 text-xs text-red-700">
          {failures.map((f, i) => (
            <li key={`${f.name}-${i}`}>
              {f.name}: {f.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** בחירת מוצר לשיוך: חיפוש ברשימה, קודם מוצרים שממתינים לתמונה. */
function AssignPanel({
  products,
  onPick,
  onClose,
  pending,
}: {
  products: AssignableProduct[];
  onPick: (productId: string) => void;
  onClose: () => void;
  pending: boolean;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const term = q.trim();
    return (term ? products.filter((p) => p.title.includes(term)) : products).slice(0, 50);
  }, [q, products]);

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2">
      <div className="mb-1.5 flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            autoFocus
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש מוצר..."
            aria-label="חיפוש מוצר לשיוך"
            className="w-full rounded-md border border-gray-200 py-1 pl-2 pr-7 text-xs outline-none focus:border-brand-500"
          />
        </div>
        <button type="button" onClick={onClose} aria-label="סגירה" className="rounded p-1 text-gray-500 hover:bg-gray-200">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <ul className="max-h-44 overflow-y-auto text-xs">
        {shown.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={pending}
              onClick={() => onPick(p.id)}
              className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-right hover:bg-white disabled:opacity-60"
            >
              <span className="truncate">{p.title}</span>
              {p.imageRequired ? (
                <span className="shrink-0 text-red-700">ממתין לתמונה</span>
              ) : (
                p.hasImage && <span className="shrink-0 text-gray-400">תוחלף תמונה</span>
              )}
            </button>
          </li>
        ))}
        {shown.length === 0 && <li className="px-2 py-1.5 text-gray-500">לא נמצאו מוצרים</li>}
      </ul>
    </div>
  );
}

function Tile({
  image,
  products,
  remove,
  assign,
}: {
  image: FolderTile;
  products?: AssignableProduct[];
  remove: (id: string) => Promise<{ error?: string }>;
  assign?: (imageId: string, productId: string) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<{ error?: string }>, after?: () => void) => {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        setError(res.error);
        return;
      }
      after?.();
      router.refresh();
    });
  };

  return (
    <li className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="aspect-square bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={image.fileName} loading="lazy" className="h-full w-full object-cover" />
      </div>
      <div className="space-y-1.5 p-2 text-xs">
        <p className="truncate text-gray-700" title={image.fileName} dir="ltr">
          {image.fileName}
        </p>
        {image.usedCount === 0 ? (
          <p className="text-amber-700">לא משויכת</p>
        ) : image.usedIn ? (
          <p className="text-gray-500">
            משויכת ל:{' '}
            {image.usedIn.map((p, i) => (
              <span key={p.id}>
                {i > 0 && ', '}
                <Link href={`/admin/products/${p.id}`} className="text-brand-700 hover:underline">
                  {p.title}
                </Link>
              </span>
            ))}
          </p>
        ) : (
          <p className="text-gray-500">מוצרים משויכים: {image.usedCount}</p>
        )}
        <div className="flex items-center justify-between gap-2">
          {assign && products ? (
            <button
              type="button"
              onClick={() => setAssigning((v) => !v)}
              aria-label={`שיוך ${image.fileName} למוצר`}
              className="rounded-md border border-gray-200 px-2 py-1 font-medium text-gray-700 hover:bg-gray-50"
            >
              שיוך למוצר
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            disabled={pending}
            aria-label={`מחיקת ${image.fileName}`}
            onClick={() => {
              if (window.confirm('למחוק את התמונה מהתיקייה?')) run(() => remove(image.id));
            }}
            className="rounded p-1 text-red-600 hover:bg-red-50 disabled:opacity-60"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
        {assigning && assign && products && (
          <AssignPanel
            products={products}
            pending={pending}
            onClose={() => setAssigning(false)}
            onPick={(productId) => run(() => assign(image.id, productId), () => setAssigning(false))}
          />
        )}
        {error && <p className="text-red-600">{error}</p>}
      </div>
    </li>
  );
}

export function FolderGrid({
  images,
  products,
  remove,
  assign,
}: {
  images: FolderTile[];
  products?: AssignableProduct[];
  remove: (id: string) => Promise<{ error?: string }>;
  assign?: (imageId: string, productId: string) => Promise<{ error?: string }>;
}) {
  if (images.length === 0) {
    return <p className="rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500">אין תמונות להצגה.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {images.map((image) => (
        <Tile key={image.id} image={image} products={products} remove={remove} assign={assign} />
      ))}
    </ul>
  );
}
