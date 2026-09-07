import type { NurseryProduct, Plant, MasterSupply } from '@prisma/client';

export type SeoLevel = 'good' | 'fair' | 'poor';

export interface SeoIssue {
  field: 'customDescription' | 'customTitle' | 'seoMetaTitle' | 'seoMetaDescription' | 'image';
  severity: 'high' | 'medium' | 'low';
  message: string;
}

export interface SeoScore {
  score: number; // 0..100
  level: SeoLevel;
  issues: SeoIssue[];
}

type ProductForScore = Pick<
  NurseryProduct,
  'customTitle' | 'customDescription' | 'seoMetaTitle' | 'seoMetaDescription'
> & {
  plant?: Pick<Plant, 'description' | 'imageUrl'> | null;
  supply?: Pick<MasterSupply, 'description' | 'imageUrl'> | null;
};

const MIN_DESC = 120;

/**
 * מנקד את איכות ה-SEO של מוצר בחנות לפי שדות ההתאמה האישית.
 * המוקד: מניעת תוכן כפול — תיאור ייחודי למשתלה במקום התיאור הבוטני המשותף.
 */
export function scoreProductSeo(p: ProductForScore): SeoScore {
  const issues: SeoIssue[] = [];
  let score = 0;

  const sharedDesc = (p.plant?.description || p.supply?.description || '').trim();
  const customDesc = (p.customDescription || '').trim();
  const hasImage = Boolean(p.plant?.imageUrl || p.supply?.imageUrl);

  // תיאור ייחודי — המשקל הגבוה ביותר (40)
  if (customDesc.length >= MIN_DESC) {
    score += 40;
  } else if (customDesc.length > 0) {
    score += 20;
    issues.push({
      field: 'customDescription',
      severity: 'medium',
      message: `התיאור המותאם קצר (${customDesc.length} תווים). מומלץ לפחות ${MIN_DESC}.`,
    });
  } else {
    issues.push({
      field: 'customDescription',
      severity: 'high',
      message: sharedDesc
        ? 'אין תיאור ייחודי — החנות משתמשת בתיאור הבוטני המשותף (סיכון לתוכן כפול מול משתלות אחרות).'
        : 'אין תיאור למוצר. כתוב תיאור ייחודי שמשפר דירוג בחיפוש.',
    });
  }

  // כותרת מותאמת (15)
  if ((p.customTitle || '').trim()) {
    score += 15;
  } else {
    issues.push({
      field: 'customTitle',
      severity: 'low',
      message: 'כותרת מותאמת אישית עוזרת לבידול מול משתלות אחרות שמוכרות אותו צמח.',
    });
  }

  // meta title (10)
  if ((p.seoMetaTitle || p.customTitle || '').trim()) score += 10;
  else
    issues.push({
      field: 'seoMetaTitle',
      severity: 'low',
      message: 'הוסף כותרת SEO (meta title) ייעודית.',
    });

  // meta description (20)
  if ((p.seoMetaDescription || '').trim().length >= 50 || customDesc.length >= MIN_DESC) {
    score += 20;
  } else {
    issues.push({
      field: 'seoMetaDescription',
      severity: 'medium',
      message: 'הוסף תיאור SEO (meta description) של 50–160 תווים.',
    });
  }

  // תמונה (15)
  if (hasImage) score += 15;
  else
    issues.push({
      field: 'image',
      severity: 'medium',
      message: 'למוצר אין תמונה — פוגע גם בהמרה וגם בקידום.',
    });

  const level: SeoLevel = score >= 75 ? 'good' : score >= 40 ? 'fair' : 'poor';
  return { score, level, issues };
}

export const SEO_LEVEL_META: Record<SeoLevel, { label: string; dot: string; text: string }> = {
  good: { label: 'תקין', dot: 'bg-green-500', text: 'text-green-700' },
  fair: { label: 'לשיפור', dot: 'bg-amber-500', text: 'text-amber-700' },
  poor: { label: 'חלש', dot: 'bg-rose-500', text: 'text-rose-700' },
};
