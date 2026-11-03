'use client';

import { useActionState } from 'react';
import { subscribeAction, type NewsletterState } from '@/app/[tenant]/newsletter-actions';

const initial: NewsletterState = {};

/** הרשמה לתפוצת הדואר, בתחתית החנות. ההסכמה לדיוור מפורשת ולא מסומנת מראש. */
export function NewsletterForm({ tenant, nurseryName }: { tenant: string; nurseryName: string }) {
  const [state, action, pending] = useActionState(subscribeAction, initial);

  return (
    <section aria-labelledby="newsletter-title" className="border-b border-gray-100" data-testid="newsletter">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <h2 id="newsletter-title" className="text-base font-bold text-gray-900">
          הרשמה לתפוצת הדואר
        </h2>
        {state.ok ? (
          <p role="status" className="mt-2 text-sm font-medium text-gray-900">
            תודה, נרשמתם לתפוצה.
          </p>
        ) : (
          <form action={action} className="mt-3 space-y-2">
            <input type="hidden" name="tenant" value={tenant} />
            <div className="sr-only" aria-hidden="true">
              <label>
                אתר
                <input type="text" name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <div className="flex max-w-lg flex-wrap gap-2">
              <input
                type="email"
                name="email"
                required
                dir="ltr"
                autoComplete="email"
                aria-label="כתובת אימייל לתפוצת הדואר"
                placeholder="your@email.com"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-600"
              />
              <button type="submit" disabled={pending} className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-60">
                {pending ? 'נרשם...' : 'הרשמה'}
              </button>
            </div>
            <label className="flex items-start gap-2 text-xs text-gray-600">
              <input type="checkbox" name="consent" required className="mt-0.5" />
              <span>אני מסכים/ה לקבל מ{nurseryName} דיוור ומבצעים במייל. להסרה אפשר לפנות למשתלה בכל עת.</span>
            </label>
            {state.error && (
              <p role="alert" className="text-sm text-red-700">
                {state.error}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
