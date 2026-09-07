'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { MODULES } from '@/lib/modules';
import { setNurseryModules, type NurseryFormState } from './actions';

export interface ModuleStateVM {
  enabled: boolean;
  config: Record<string, unknown>;
}

const initial: NurseryFormState = {};
const DESIGN_FLAGS: { key: string; label: string }[] = [
  { key: 'colors', label: 'צבעים' },
  { key: 'hero', label: 'Hero' },
  { key: 'carousel', label: 'קרוסלת תמונות' },
  { key: 'popup', label: 'פופ-אפ' },
  { key: 'sticky', label: 'כותרת נדבקת' },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      disabled={pending}
    >
      {pending ? 'שומר...' : 'שמירת מודולים'}
    </button>
  );
}

export function NurseryModulesForm({
  nurseryId,
  states,
}: {
  nurseryId: string;
  states: Record<string, ModuleStateVM>;
}) {
  const [state, formAction] = useFormState(setNurseryModules, initial);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="nurseryId" value={nurseryId} />

      {MODULES.map((mod) => {
        const s = states[mod.key] ?? { enabled: false, config: {} };
        return (
          <div key={mod.key} className="rounded-xl border border-gray-100 p-4">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name={`mod_${mod.key}`}
                defaultChecked={s.enabled}
                className="mt-1 h-4 w-4 rounded border-gray-300"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900">{mod.label}</span>
                <span className="block text-xs text-gray-500">{mod.description}</span>
              </span>
            </label>

            {mod.key === 'sales' && (
              <div className="mt-3 pr-7">
                <label className="text-xs text-gray-600">
                  מצב מכירה:{' '}
                  <select
                    name="sales_mode"
                    defaultValue={(s.config.mode as string) || 'ONLINE'}
                    className="rounded-md border border-gray-200 px-2 py-1 text-xs"
                  >
                    <option value="ONLINE">הזמנה אונליין</option>
                    <option value="QUOTE">הצעת מחיר בלבד</option>
                  </select>
                </label>
              </div>
            )}

            {mod.key === 'design' && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 pr-7">
                {DESIGN_FLAGS.map((f) => (
                  <label key={f.key} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      name={`design_${f.key}`}
                      defaultChecked={s.config[f.key] !== false}
                      className="h-3.5 w-3.5 rounded border-gray-300"
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-3">
        <SaveButton />
        {state.ok && <span className="text-sm text-green-700">נשמר ✓</span>}
        {state.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
