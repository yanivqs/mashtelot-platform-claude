import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { normalizeProductSlug } from '@/lib/utils';

/** מודל ההצעה — זול ומהיר (אושר ע"י בעל הפלטפורמה); ניתן להחלפה במשתנה סביבה. */
const MODEL = process.env.AI_SLUG_MODEL || 'claude-haiku-5-5';

export function aiSlugAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You write short English URL slugs for products in an Israeli plant nursery web shop.
Given a product name (usually Hebrew) and optional hints, reply with ONE slug only:
- 2 to 5 lowercase English words joined by hyphens, max 50 characters
- translate the meaning (e.g. "משפך השקיה 10 ליטר" -> "watering-can-10l"); for plants prefer the common English name, or the botanical genus/species when there is no common name
- keep sizes/volumes that distinguish the product (10l, 50l, 17cm)
- output the slug only: no quotes, no explanation`;

/**
 * הצעת slug באנגלית לשם המוצר. כל קריאה נרשמת ב-ai_usage (לספירה ולחיוב עתידי).
 * מחזיר null כשאין מפתח API או שהתשובה לא שמישה.
 */
export async function suggestSlugWithAi(input: {
  nurseryId: string;
  actorEmail: string | null;
  title: string;
  latinName?: string | null;
  kind?: string | null;
}): Promise<{ slug: string } | { error: string }> {
  if (!aiSlugAvailable()) return { error: 'הצעת AI לא מוגדרת עדיין (חסר מפתח API).' };

  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  const hints = [input.latinName ? `Botanical name: ${input.latinName}` : null, input.kind ? `Type: ${input.kind}` : null]
    .filter(Boolean)
    .join('\n');

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      // משימה קצרה וחד-משמעית — בלי חשיבה (מותר ב-Haiku 5.5 במאמץ ברירת המחדל)
      thinking: { type: 'disabled' },
      system: SYSTEM,
      messages: [{ role: 'user', content: `Product name: ${input.title}${hints ? `\n${hints}` : ''}` }],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { error: 'שירות ה-AI עמוס כרגע — נסו שוב בעוד רגע.' };
    if (e instanceof Anthropic.AuthenticationError) return { error: 'מפתח ה-AI לא תקין.' };
    if (e instanceof Anthropic.APIError) return { error: `שגיאת שירות AI (${e.status ?? 'רשת'}).` };
    throw e;
  }

  // נספר גם כשההצעה לא שמישה — הקריאה חויבה
  await prisma.aiUsage.create({
    data: {
      nurseryId: input.nurseryId,
      actorEmail: input.actorEmail,
      feature: 'product_slug',
      model: response.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  });

  if (response.stop_reason === 'refusal') return { error: 'לא התקבלה הצעה — נסו לכתוב בעצמכם.' };
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join(' ')
    .trim()
    .split(/\s*\n/)[0] ?? '';
  const slug = normalizeProductSlug(text);
  return slug ? { slug } : { error: 'לא התקבלה הצעה שמישה — נסו שוב.' };
}
