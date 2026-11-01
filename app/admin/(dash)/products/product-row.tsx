import Link from 'next/link';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import type { Plant } from '@prisma/client';
import { formatPrice } from '@/lib/utils';
import { SEO_LEVEL_META, type SeoScore } from '@/lib/seo-score';
import type { EditorVariant } from './variants-editor';

export interface RowProduct {
  id: string;
  title: string;
  latinName: string | null;
  image: string | null;
  kind: 'צמח' | 'ציוד' | 'מוצר מותאם';
  price: string;
  compareAtPrice: string | null;
  stockQuantity: number;
  /** יחידות שמורות להזמנות פתוחות */
  reservedQuantity: number;
  isActive: boolean;
  customTitle: string | null;
  customDescription: string | null;
  customImageUrl: string | null;
  seoMetaTitle: string | null;
  seoMetaDescription: string | null;
  /** כתובת שמורה (ריק = אוטומטית) */
  slug: string | null;
  /** הכתובת האוטומטית (שם + 8 תווי מזהה) — לתצוגה כשאין slug */
  autoSlug: string;
  /** שויך מהקטלוג ועדיין בלי תמונה משלו — מוסתר מהחנות */
  imageRequired: boolean;
  /** מוצר מהקטלוג בלי תיאור משלו */
  needsDescription: boolean;
  categoryIds: string[];
  plant: Plant | null;
  seo: SeoScore;
  /** שם האפשרות לבחירת וריאנט (למשל "גודל עציץ") */
  optionLabel: string | null;
  /** שם הציר השני (למשל "צבע") */
  option2Label: string | null;
  /** כל הווריאנטים (כולל מושבתים), ברירת המחדל ראשונה */
  variants: EditorVariant[];
}

export interface CategoryOption {
  id: string;
  name: string;
  depth: number;
}

/** שורה ברשימת המלאי — לחיצה פותחת את דף העריכה של המוצר. */
export function ProductRow({ product, viewUrl }: { product: RowProduct; viewUrl: string }) {
  const href = `/admin/products/${product.id}`;
  const multi = product.variants.length > 1;
  const hidden = !product.isActive || product.imageRequired;

  return (
    <div className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60">
      <div className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4">
        <Link href={href} tabIndex={-1} aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-brand-50 text-lg sm:h-11 sm:w-11">
          {product.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image} alt="" className="h-full w-full object-cover" />
          ) : (
            <span aria-hidden>🪴</span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-sm font-medium text-gray-900 hover:text-brand-700 hover:underline">
            {product.customTitle || product.title}
          </Link>
          <p className="truncate text-xs text-gray-400">
            {product.kind}
            {product.latinName ? ` · ${product.latinName}` : ''}
          </p>
          {(product.imageRequired || product.needsDescription) && (
            <p className="mt-1 flex flex-wrap gap-1">
              {product.imageRequired && (
                <span className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-medium text-red-800">מוסתר — חסרה תמונה</span>
              )}
              {product.needsDescription && (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">חסר תיאור</span>
              )}
            </p>
          )}
          {/* נייד: מחיר, מלאי וסטטוס בשורה מתחת לשם */}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-gray-600 sm:hidden">
            <span className="font-medium text-gray-900">{formatPrice(product.price)}</span>
            <span>· {product.stockQuantity} יח׳</span>
            <span className={hidden ? 'text-gray-400' : 'text-green-700'}>· {hidden ? 'מוסתר' : 'פעיל'}</span>
          </p>
        </div>
        <div className="hidden w-24 text-sm text-gray-700 sm:block">
          {formatPrice(product.price)}
          {multi && <span className="block text-xs text-gray-400">{product.variants.length} וריאנטים</span>}
        </div>
        <div className="hidden w-20 text-sm text-gray-700 sm:block">
          {product.stockQuantity} יח׳
          {product.reservedQuantity > 0 && <span className="text-sky-700"> · {product.reservedQuantity} שמורות</span>}
        </div>
        <div className="hidden w-16 sm:block">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              !hidden ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {!hidden ? 'פעיל' : 'מוסתר'}
          </span>
        </div>
        <span
          className="hidden w-12 items-center gap-1 text-xs sm:flex"
          title={`מדד SEO: ${product.seo.score}/100 (${SEO_LEVEL_META[product.seo.level].label})`}
        >
          <span className={`h-2 w-2 rounded-full ${SEO_LEVEL_META[product.seo.level].dot}`} />
          <span className={SEO_LEVEL_META[product.seo.level].text}>SEO</span>
        </span>
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener"
          aria-label={hidden ? 'תצוגה מקדימה' : 'צפייה באתר'}
          title={hidden ? 'תצוגה מקדימה (המוצר מוסתר)' : 'צפייה באתר'}
          className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        <Link href={href} aria-label="עריכה" className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
          <ChevronLeft className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
