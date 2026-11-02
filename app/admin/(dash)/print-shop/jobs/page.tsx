import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { itemDisplay } from '@/lib/print-templates-admin';
import { prisma } from '@/lib/prisma';
import { requireNurseryPage } from '@/lib/nursery-scope';
import { isQuoteExpired } from '@/lib/print-jobs';
import { specStillValid } from '@/lib/print-saved';
import { artworkInclude, artworkVersionsVM } from '@/lib/print-artwork-view';
import { parseFields, parsePricing, type CleanValues } from '@/lib/print-template';
import { PRODUCTION_LABELS, type ProductionStatus } from '@/lib/print-release';
import { JobsList, type JobVM } from './jobs-list';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  QUOTE_REQUESTED: 'ממתינה להצעת מחיר',
  NEW: 'התקבלה',
  IN_PRODUCTION: 'בהפקה',
  SHIPPED: 'נשלחה',
  DELIVERED: 'נמסרה',
  CANCELLED: 'בוטלה',
};

/** מצב הייצור של הזמנה מתבנית שכבר אינה ממתינה להצעה */
function productionLabel(o: { status: string; productionStatus: string }, fromTemplate: boolean): string | null {
  if (!fromTemplate || o.status === 'QUOTE_REQUESTED' || o.status === 'CANCELLED') return null;
  return `ייצור: ${PRODUCTION_LABELS[o.productionStatus as ProductionStatus]}`;
}

type Stored = { raw?: CleanValues; display?: Array<{ label: string; value: string }> };

/** העבודות שלי: כל עבודה שהמשתלה הזמינה, עם תמונת הקובץ, ההזמנה האחרונה והזמנה חוזרת. */
export default async function PrintJobsPage() {
  const { nurseryId } = await requireNurseryPage({ all: ['print_shop'] });

  const [jobs, items] = await Promise.all([
    prisma.printSavedProduct.findMany({
      where: { nurseryId, isArchived: false },
      include: {
        template: { include: { versions: { where: { status: 'PUBLISHED' } } } },
        activeRevision: true,
        revisions: { orderBy: { revision: 'desc' }, take: 1 },
        artworks: { include: artworkInclude },
      },
    }),
    prisma.printOrderItem.findMany({
      where: { printOrder: { nurseryId } },
      include: {
        printOrder: true,
        printProduct: { select: { title: true, imageUrl: true } },
        savedRevision: { select: { savedProductId: true } },
      },
      orderBy: { printOrder: { createdAt: 'desc' } },
    }),
  ]);

  const byJob = new Map<string, typeof items>();
  for (const it of items) {
    const key = it.savedRevision?.savedProductId ?? it.savedProductId;
    if (key) byJob.set(key, [...(byJob.get(key) ?? []), it]);
  }

  // בלי לטעון את תוכן התמונות: רק אילו קבצים יש להם תמונה
  const fileIds = jobs.flatMap((j) => j.artworks[0]?.versions.map((v) => v.fileId) ?? []);
  const withThumb = new Set((await prisma.printFileThumbnail.findMany({ where: { fileId: { in: fileIds } }, select: { fileId: true } })).map((t) => t.fileId));

  const vm: Array<JobVM & { sortAt: number }> = await Promise.all(
    jobs.map(async (j) => {
      const orders = byJob.get(j.id) ?? [];
      const last = orders[0];
      const lastOrder = last?.printOrder;
      const versions = j.artworks[0]?.versions ?? [];
      const latest = [...versions].sort((a, b) => b.version - a.version)[0];
      const revision = j.revisions[0];
      const stored = (j.activeRevision?.values ?? revision?.values ?? null) as Stored | null;
      const pub = j.template?.isActive ? j.template.versions[0] : undefined;
      // עבודה קודמת בלי מוצר מהקטלוג: הזמנה חוזרת עוברת להצעת מחיר
      const freeReorder = !j.template;
      const fields = pub ? parseFields(pub.fields) : null;
      const pricing = pub ? parsePricing(pub.pricing) : null;
      const raw = fields?.ok && j.activeRevision ? specStillValid(fields.value, j.activeRevision.values as Stored) : null;
      const expired = lastOrder ? isQuoteExpired(lastOrder) : false;

      let blocked: string | null = null;
      if (freeReorder) blocked = null;
      else if (!pub) blocked = 'המוצר אינו זמין כרגע';
      else if (!j.activeRevision) blocked = revision?.status === 'REJECTED' ? 'המפרט נדחה בבית הדפוס' : 'המפרט ממתין לאישור בית הדפוס';
      else if (!raw) blocked = 'המוצר השתנה מאז ההזמנה האחרונה. בדקו את הפרטים בהזמנה דומה';

      return {
        id: j.id,
        name: j.name,
        productTitle: j.template?.title ?? j.name,
        productHref: j.template ? `/admin/print-shop/${j.template.slug ?? j.template.id}` : '',
        imported: Boolean(j.importedAt),
        freeReorder,
        canOrderSimilar: Boolean(pub),
        image: latest && withThumb.has(latest.fileId) ? `/api/print-files/${latest.fileId}/thumbnail` : latest ? null : (j.template?.imageUrl ?? null),
        fileName: latest?.file.originalName ?? null,
        fileType: latest ? latest.file.mimeType.split('/').pop()!.toUpperCase() : null,
        description: [...(j.description ? [j.description] : []), ...(stored?.display ?? []).map((d) => `${d.label}: ${d.value}`)],
        lastOrderAt: lastOrder?.createdAt.toISOString() ?? null,
        lastQuantity: last?.quantity ?? null,
        lastTotal: lastOrder && Number(lastOrder.totalAmount) > 0 ? Number(lastOrder.totalAmount) : null,
        orderCount: orders.length,
        status: lastOrder ? (expired && lastOrder.quoteStatus === 'SENT' ? 'ההצעה פגה' : lastOrder.quoteStatus === 'SENT' ? 'הצעה ממתינה לתשובתך' : STATUS_LABEL[lastOrder.status] ?? lastOrder.status) : 'טרם הוזמנה',
        production: lastOrder ? productionLabel(lastOrder, true) : null,
        reasons: lastOrder?.status === 'QUOTE_REQUESTED' ? lastOrder.reviewReasons : [],
        needsDesign: lastOrder?.needsDesign === true && versions.length === 0,
        rejectionNote: revision?.status === 'REJECTED' ? revision.reviewNote : null,
        quote:
          lastOrder?.status === 'QUOTE_REQUESTED' && lastOrder.quoteStatus === 'SENT'
            ? { orderId: lastOrder.id, total: Number(lastOrder.totalAmount), validUntil: lastOrder.quoteValidUntil?.toISOString() ?? null, expired }
            : null,
        blocked,
        reorder: !blocked && fields?.ok && pricing?.ok && raw ? { fields: fields.value, pricing: pricing.value, raw, unitLabel: j.template?.unitLabel ?? null } : null,
        artwork: await artworkVersionsVM(versions),
        sortAt: lastOrder?.createdAt.getTime() ?? j.createdAt.getTime(),
      };
    }),
  );
  vm.sort((a, b) => b.sortAt - a.sortAt);

  // הזמנות שלא שייכות לעבודה (מהטופס הישן): לקריאה בלבד
  const older = items
    .filter((it) => !it.savedRevisionId && !it.savedProductId)
    .map((it) => {
      const d = itemDisplay(it);
      return {
        id: it.id,
        name: d.title,
        description: d.details,
        image: it.printProduct?.imageUrl ?? null,
        at: it.printOrder.createdAt.toISOString(),
        quantity: it.quantity,
        total: Number(it.printOrder.totalAmount),
        status: STATUS_LABEL[it.printOrder.status] ?? it.printOrder.status,
        production: productionLabel(it.printOrder, Boolean(it.templateVersionId)),
      };
    });

  return (
    <div className="max-w-4xl space-y-6">
      <Link href="/admin/print-shop" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowRight className="h-4 w-4" />
        לכל מוצרי הדפוס
      </Link>
      <div>
        <h1 className="text-2xl font-bold">העבודות שלי</h1>
        <p className="mt-1 text-sm text-gray-600">כל מה שהזמנתם מבית הדפוס. הזמנה חוזרת בלחיצה, עם אותו מפרט ואותו קובץ.</p>
      </div>
      <JobsList jobs={vm} older={older} />
    </div>
  );
}
