'use client';

import { useActionState, useState } from 'react';
import { useKeepFormValues } from '@/components/admin/use-keep-form-values';
import { useFormStatus } from 'react-dom';
import type { ChannelProvider, NurseryChannel } from '@prisma/client';
import { saveChannels, type SaveChannelsState } from './channels-actions';
import { CHANNEL_PROVIDERS, CHANNEL_LABELS, CHANNEL_VALUE_PLACEHOLDERS } from '@/lib/channels';

const initial: SaveChannelsState = {};
const field =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-500';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'שמירת ערוצים'}
    </button>
  );
}

/** שורת ערוץ: הקלדת קישור בשורה ריקה מסמנת אותה אוטומטית, וקישור כבוי מסומן שאינו מוצג באתר. */
function ChannelRow({ provider, row }: { provider: ChannelProvider; row?: NurseryChannel }) {
  const [enabled, setEnabled] = useState(row?.isEnabled ?? false);
  const [value, setValue] = useState(row?.value ?? '');

  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="flex items-center gap-3">
        <label className="flex w-40 shrink-0 items-center gap-2 text-sm font-medium text-gray-900">
          <input
            type="checkbox"
            name={`${provider}_enabled`}
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          {CHANNEL_LABELS[provider]}
        </label>
        <input
          name={`${provider}_value`}
          value={value}
          onChange={(e) => {
            if (!value.trim() && e.target.value.trim()) setEnabled(true);
            setValue(e.target.value);
          }}
          placeholder={CHANNEL_VALUE_PLACEHOLDERS[provider]}
          aria-label={`קישור ${CHANNEL_LABELS[provider]}`}
          dir="ltr"
          className={field}
        />
      </div>
      {value.trim() && !enabled && (
        <p className="mt-1.5 text-xs text-amber-700">הקישור שמור אבל לא מוצג באתר. סמנו את התיבה כדי להציג אותו.</p>
      )}
    </div>
  );
}

export function ChannelsForm({ channels }: { channels: NurseryChannel[] }) {
  const [state, action] = useActionState(saveChannels, initial);
  const keep = useKeepFormValues(state);
  const byProvider = new Map(channels.map((c) => [c.provider, c]));

  return (
    <form ref={keep} action={action} className="space-y-3">
      {CHANNEL_PROVIDERS.map((provider) => (
        <ChannelRow key={provider} provider={provider} row={byProvider.get(provider)} />
      ))}
      <div className="flex items-center gap-3 pt-1">
        <Submit />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
