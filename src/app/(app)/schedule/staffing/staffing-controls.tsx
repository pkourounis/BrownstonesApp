'use client';

import { useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Location } from '@/lib/database.types';

/** Store selector + target sales-per-labor-hour control for the staffing view. */
export function StaffingControls({
  locations,
  target,
}: {
  locations: Pick<Location, 'id' | 'name'>[];
  target: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const store = params.get('store') ?? 'all';

  const go = (next: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    Object.entries(next).forEach(([k, v]) => {
      if (!v || (k === 'store' && v === 'all')) p.delete(k);
      else p.set(k, v);
    });
    startTransition(() => router.push(`/schedule/staffing?${p.toString()}`));
  };

  return (
    <div className={`space-y-3 ${pending ? 'opacity-60' : ''}`}>
      <select
        value={store}
        onChange={(e) => go({ store: e.target.value })}
        className="input h-10 w-full text-sm"
        aria-label="Store"
      >
        <option value="all">All stores (combined)</option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>

      <div>
        <div className="flex items-center justify-between">
          <label className="label" htmlFor="target">
            Target sales / labor hour
          </label>
          <span className="text-sm font-bold tabular-nums text-brand-800">${target}</span>
        </div>
        <input
          id="target"
          type="range"
          min={40}
          max={150}
          step={5}
          defaultValue={target}
          onChange={(e) => go({ target: e.target.value })}
          className="mt-1 w-full accent-brand-700"
        />
        <p className="mt-1 text-xs text-brand-500">
          Higher target = leaner staffing. We size head-count so each labor hour drives about this much in sales.
        </p>
      </div>
    </div>
  );
}
