import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseFields, parsePricing, FIELD_TYPE_LABELS, SIZE_KEY, type ShowIf, type TemplateField } from '@/lib/print-template';
import { formatPrice } from '@/lib/utils';
import { DEFAULT_PRICING } from '@/lib/print-templates-admin';
import { parseProfile } from '@/lib/print-preflight';
import { newDraftAction } from '../actions';
import { DraftEditor, MetaForm, type PricingValues } from '../forms';

export const dynamic = 'force-dynamic';

const STATUS_LABEL = { DRAFT: 'טיוטה', PUBLISHED: 'מפורסמת', ARCHIVED: 'בארכיון' } as const;

function conditionText(fields: TemplateField[], s: ShowIf): string {
  const ref = fields.find((x) => x.key === s.field);
  if (!ref) return '';
  const value = ref.type === 'boolean' ? (s.equals === 'true' ? 'כן' : 'לא') : (ref.options?.find((o) => o.value === s.equals)?.label ?? s.equals);
  return `מוצג רק אם ${ref.label} = ${value}`;
}
const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: 'Asia/Jerusalem', dateStyle: 'short', timeStyle: 'short' });

export default async function PrintTemplatePage(props: { params: Promise<{ id: string }> }) {
  await requireUser(['SUPER_ADMIN']);
  const { id } = await props.params;
  const t = await prisma.printTemplate.findUnique({
    where: { id },
    include: { versions: { orderBy: { version: 'desc' }, include: { _count: { select: { orderItems: true } } } } },
  });
  if (!t) notFound();

  const draft = t.versions.find((v) => v.status === 'DRAFT');
  const published = t.versions.find((v) => v.status === 'PUBLISHED');
  const publishedFields = published ? parseFields(published.fields) : null;
  const publishedPricing = published ? parsePricing(published.pricing) : null;
  const profileParsed = published ? parseProfile(published.production) : null;
  const publishedProfile = profileParsed?.ok ? profileParsed.value : null;
  const metaForm = (
    <MetaForm
      meta={{
        id: t.id,
        title: t.title,
        slug: t.slug,
        galleryImages: t.galleryImages,
        sortOrder: t.sortOrder,
        description: t.description,
        category: t.category,
        imageUrl: t.imageUrl,
        unitLabel: t.unitLabel,
        leadTimeDays: t.leadTimeDays,
        requiresArtwork: t.requiresArtwork,
        isActive: t.isActive,
      }}
    />
  );

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link href="/admin/print-templates" className="text-sm text-gray-500 hover:underline">
          ← כל התבניות
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{t.title}</h1>
      </div>

      {draft ? (
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <DraftEditor
            templateId={t.id}
            version={draft.version}
            initialFields={Array.isArray(draft.fields) ? (draft.fields as unknown[]) : []}
            initialPricing={{ ...DEFAULT_PRICING, ...((draft.pricing ?? {}) as object) } as PricingValues}
            initialProduction={(draft.production as { widthMm?: number; heightMm?: number; bleedMm?: number; minDpi?: number } | null) ?? null}
            notes={draft.notes}
            general={metaForm}
          />
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="mb-3 font-bold">פרטי המוצר</h2>
            {metaForm}
          </section>
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-600">אין טיוטה. כדי לשנות שדות או מחירים, צרו גרסה חדשה מתוך האחרונה.</p>
            <form action={newDraftAction}>
              <input type="hidden" name="id" value={t.id} />
              <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                יצירת גרסה חדשה (טיוטה)
              </button>
            </form>
          </section>
        </>
      )}

      {published && publishedFields?.ok && publishedPricing?.ok && (
        <section className="rounded-xl border border-green-100 bg-white p-5 shadow-sm" data-testid="published-version">
          <h2 className="mb-2 font-bold">גרסה {published.version} — מפורסמת (נעולה)</h2>
          <p className="mb-3 text-xs text-gray-600">
            פורסמה {published.publishedAt ? dateFmt.format(published.publishedAt) : ''} ע״י {published.publishedBy ?? '—'}
            {published.notes ? ` · ${published.notes}` : ''}
          </p>

          <h3 className="mb-1 text-sm font-bold">שדות</h3>
          {publishedFields.value.length === 0 && <p className="text-sm text-gray-600">אין שדות.</p>}
          <ul className="space-y-2 text-sm">
            {publishedFields.value.map((f) => (
              <li key={f.key}>
                <span className="font-medium">{f.label}</span>{' '}
                <span className="text-gray-600">
                  ({FIELD_TYPE_LABELS[f.type]}
                  {f.required ? ', חובה' : ''}
                  {f.allowCustom ? ', אפשר התאמה אישית' : ''}
                  {f.key === SIZE_KEY ? ', שדה המידה' : ''}
                  {f.maxLength ? `, עד ${f.maxLength} תווים` : ''}
                  {f.min !== undefined ? `, מינימום ${f.min}` : ''}
                  {f.max !== undefined ? `, מקסימום ${f.max}` : ''}
                  {f.showIf ? `, ${conditionText(publishedFields.value, f.showIf)}` : ''})
                </span>
                {f.help && <span className="block text-xs text-gray-600">הסבר: {f.help}</span>}
                {f.options && f.options.length > 0 && (
                  <ul className="mt-1 list-inside list-disc text-xs text-gray-700">
                    {f.options.map((o) => (
                      <li key={o.value}>
                        {o.label}
                        {o.priceDelta ? ` · ${formatPrice(o.priceDelta)} ליחידה` : ''}
                        {o.fixedAdd ? ` · ${formatPrice(o.fixedAdd)} קבוע` : ''}
                        {o.percentAdd ? ` · ${o.percentAdd}%` : ''}
                        {o.minCharge ? ` · מינימום ${formatPrice(o.minCharge)}` : ''}
                        {o.minQuantity ? ` · מכמות ${o.minQuantity.toLocaleString('he-IL')}` : ''}
                        {o.requiresQuote ? ' · דורש הצעה' : ''}
                        {o.help ? ` · ${o.help}` : ''}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <h3 className="mb-1 mt-4 text-sm font-bold">כמויות ותמחור</h3>
          <dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
            <div>
              <dt className="inline text-gray-600">מחיר: </dt>
              <dd className="inline font-medium">{publishedPricing.value.quoteOnly ? 'תמיד דורש הצעת צוות' : 'מחיר מיידי'}</dd>
            </div>
            <div>
              <dt className="inline text-gray-600">עלות הקמה: </dt>
              <dd className="inline font-medium">{formatPrice(publishedPricing.value.setupFee)}</dd>
            </div>
            <div>
              <dt className="inline text-gray-600">כמות מינימום: </dt>
              <dd className="inline font-medium">{publishedPricing.value.minQuantity.toLocaleString('he-IL')}</dd>
            </div>
            <div>
              <dt className="inline text-gray-600">כמויות מוגדרות: </dt>
              <dd className="inline font-medium">{publishedPricing.value.quantityOptions.map((q) => q.toLocaleString('he-IL')).join(', ') || '—'}</dd>
            </div>
            <div>
              <dt className="inline text-gray-600">כמות חופשית: </dt>
              <dd className="inline font-medium">{publishedPricing.value.allowCustomQuantity ? 'מותרת' : 'לא מותרת'}</dd>
            </div>
            <div>
              <dt className="inline text-gray-600">מחיר ליחידה מתחת למדרגות: </dt>
              <dd className="inline font-medium">{publishedPricing.value.basePrice > 0 ? formatPrice(publishedPricing.value.basePrice) : '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="inline text-gray-600">מדרגות מחיר: </dt>
              <dd className="inline font-medium">{publishedPricing.value.tiers.map((t) => `מ-${t.minQty.toLocaleString('he-IL')}: ${formatPrice(t.unitPrice)}`).join(' · ') || '—'}</dd>
            </div>
          </dl>

          <h3 className="mb-1 mt-4 text-sm font-bold">בדיקת קובץ</h3>
          <p className="text-sm">
            {publishedProfile ? `ייצור ${publishedProfile.widthMm}×${publishedProfile.heightMm} מ"מ, גלישה ${publishedProfile.bleedMm}, ${publishedProfile.minDpi} DPI` : 'ללא פרופיל ייצור'}
          </p>
        </section>
      )}

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-bold">היסטוריית גרסאות</h2>
        <table className="w-full text-sm">
          <thead className="text-right text-xs text-gray-500">
            <tr>
              <th className="py-1 font-medium">גרסה</th>
              <th className="py-1 font-medium">סטטוס</th>
              <th className="py-1 font-medium">פורסמה</th>
              <th className="py-1 font-medium">פריטים בהזמנות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {t.versions.map((v) => (
              <tr key={v.id}>
                <td className="py-1.5">{v.version}</td>
                <td className="py-1.5">{STATUS_LABEL[v.status]}</td>
                <td className="py-1.5 text-gray-500">{v.publishedAt ? dateFmt.format(v.publishedAt) : '—'}</td>
                <td className="py-1.5">{v._count.orderItems}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
