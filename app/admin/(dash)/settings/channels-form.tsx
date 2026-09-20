'use client';

import { useFormState, useFormStatus } from 'react-dom';
import type { NurseryChannel } from '@prisma/client';
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

export function ChannelsForm({ channels }: { channels: NurseryChannel[] }) {
  const [state, action] = useFormState(saveChannels, initial);
  const byProvider = new Map(channels.map((c) => [c.provider, c]));

  return (
    <form action={action} className="space-y-3">
      {CHANNEL_PROVIDERS.map((provider) => {
        const row = byProvider.get(provider);
        return (
          <div key={provider} className="flex items-center gap-3 rounded-lg border border-gray-100 p-3">
            <label className="flex w-40 shrink-0 items-center gap-2 text-sm font-medium text-gray-900">
              <input
                type="checkbox"
                name={`${provider}_enabled`}
                defaultChecked={row?.isEnabled ?? false}
              />
              {CHANNEL_LABELS[provider]}
            </label>
            <input
              name={`${provider}_value`}
              defaultValue={row?.value ?? ''}
              placeholder={CHANNEL_VALUE_PLACEHOLDERS[provider]}
              dir="ltr"
              className={field}
            />
          </div>
        );
      })}
      <div className="flex items-center gap-3 pt-1">
        <Submit />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
