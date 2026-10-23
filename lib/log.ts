/**
 * לוג מובנה (§20.03): שורת JSON עם סביבה, שירות, קוד שגיאה, משתלה ומזהה בקשה (x-vercel-id) —
 * לחיפוש בלוגים של Vercel. בלי Dashboard ובלי מסד נוסף (§20.04). לא כותבים סודות או פרטים אישיים.
 */
export interface LogFields {
  service: string;
  code: string;
  nurseryId?: string | null;
  requestId?: string | null;
  [key: string]: unknown;
}

function errorText(e: unknown): string | undefined {
  if (e === undefined) return undefined;
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

export function logError(fields: LogFields, err?: unknown): void {
  console.error(
    JSON.stringify({
      level: 'error',
      env: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      at: new Date().toISOString(),
      ...fields,
      error: errorText(err),
    }),
  );
}

/** מזהה הבקשה של Vercel (אם יש) — לקישור בין שורות לוג של אותה בקשה. */
export async function requestId(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers');
    return (await headers()).get('x-vercel-id');
  } catch {
    return null;
  }
}
