const field = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

export interface ManufacturerOption {
  id: string;
  name: string;
}

/**
 * שדות יצרן למוצר של משתלה (בתוך grid של שתי עמודות): ספק/יצרן מהרשימה, קוד יצרן,
 * ובמוצר עם וריאנט יחיד — גם מק"ט וברקוד (נשמרים בווריאנט ברירת המחדל).
 */
export function ManufacturerFields({
  manufacturers,
  manufacturerId,
  manufacturerCode,
  sku,
  barcode,
  withCodes,
}: {
  manufacturers: ManufacturerOption[];
  manufacturerId?: string | null;
  manufacturerCode?: string | null;
  sku?: string | null;
  barcode?: string | null;
  /** מק"ט וברקוד (רק כשיש וריאנט יחיד) */
  withCodes: boolean;
}) {
  return (
    <>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">ספק / יצרן</span>
        <select name="manufacturerId" defaultValue={manufacturerId ?? ''} className={field}>
          <option value="">— ללא —</option>
          {manufacturers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-gray-700">קוד יצרן</span>
        <input name="manufacturerCode" dir="ltr" maxLength={60} defaultValue={manufacturerCode ?? ''} className={field} />
      </label>
      {withCodes && (
        <>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">מק&quot;ט (שלכם)</span>
            <input name="variantSku" dir="ltr" maxLength={60} defaultValue={sku ?? ''} className={field} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-gray-700">ברקוד</span>
            <input name="variantBarcode" dir="ltr" inputMode="numeric" maxLength={40} defaultValue={barcode ?? ''} className={field} />
          </label>
        </>
      )}
    </>
  );
}
