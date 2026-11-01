import { toggleProductActive } from '@/app/admin/(dash)/products/categories/[id]/actions';

/** כפתור סטטוס שמשנה מיד: פעיל ⇄ מוסתר. מוצר שממתין לתמונה מוסתר בכל מקרה, אז אין מה להחליף בו. */
export function StatusToggle({
  productId,
  title,
  isActive,
  imageRequired,
}: {
  productId: string;
  title: string;
  isActive: boolean;
  imageRequired: boolean;
}) {
  if (imageRequired) {
    return (
      <span title="יש להעלות תמונה כדי להציג את המוצר" className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
        מוסתר
      </span>
    );
  }
  return (
    <form action={toggleProductActive}>
      <input type="hidden" name="productId" value={productId} />
      <button
        aria-label={isActive ? `הסתרת ${title}` : `הצגת ${title}`}
        title={isActive ? 'לחצו כדי להסתיר מהחנות' : 'לחצו כדי להציג בחנות'}
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
          isActive ? 'bg-green-100 text-green-800 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {isActive ? 'פעיל' : 'מוסתר'}
      </button>
    </form>
  );
}
