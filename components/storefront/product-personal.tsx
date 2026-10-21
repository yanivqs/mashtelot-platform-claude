'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { favoriteStatus, toggleFavoriteAction } from '@/app/[tenant]/account/portal-actions';

const RECENT_MAX = 12;
export const recentKey = () => `mashtelot:recent:${window.location.host}`;

/** "נצפו לאחרונה" — בדפדפן בלבד (לא נשמר בשרת). */
export function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey()) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function rememberViewed(productId: string) {
  try {
    const next = [productId, ...readRecent().filter((id) => id !== productId)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(), JSON.stringify(next));
  } catch {
    // אחסון חסום (גלישה פרטית) — מוותרים בשקט
  }
}

/**
 * מועדפים ו"נצפו לאחרונה" בדף מוצר (R06-04). המצב נטען בדפדפן — דף המוצר נשאר במטמון (ISR)
 * ואינו תלוי בלקוח המחובר.
 */
export function ProductPersonal({ tenant, productId }: { tenant: string; productId: string }) {
  const [state, setState] = useState<{ loggedIn: boolean; favorite: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    rememberViewed(productId);
    favoriteStatus(tenant, productId).then((s) => s.enabled && setState({ loggedIn: s.loggedIn, favorite: s.favorite }));
  }, [tenant, productId]);

  if (!state) return null;
  if (!state.loggedIn) {
    return (
      <Link href="/account" className="mt-4 inline-flex items-center gap-1.5 text-sm text-gray-600 hover:underline">
        <Heart className="h-4 w-4" /> התחברו כדי לשמור במועדפים
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={busy}
      aria-pressed={state.favorite}
      onClick={async () => {
        setBusy(true);
        const r = await toggleFavoriteAction(tenant, productId);
        if (r.ok) setState({ loggedIn: true, favorite: Boolean(r.favorite) });
        setBusy(false);
      }}
      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
    >
      <Heart className={`h-4 w-4 ${state.favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
      {state.favorite ? 'במועדפים' : 'הוספה למועדפים'}
    </button>
  );
}
