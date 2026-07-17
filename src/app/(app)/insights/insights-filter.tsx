'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2 } from 'lucide-react';

const RANGES: [string, string][] = [
  ['today', 'Today'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
];

export function InsightsFilter({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const range = sp.get('range') ?? 'year';
  const store = sp.get('store') ?? 'all';

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set(key, value);
    startTransition(() => router.push(`/insights?${params.toString()}`, { scroll: false }));
  };

  return (
    <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-brand-100 bg-cream/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        {locations.length > 1 && (
          <select
            value={store}
            onChange={(e) => set('store', e.target.value)}
            className="input flex-1"
            aria-label="Store"
          >
            <option value="all">All stores</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        )}
        {pending && <Loader2 size={16} className="animate-spin text-brand-400" />}
      </div>
      <div className="flex gap-1.5">
        {RANGES.map(([v, label]) => (
          <button
            key={v}
            onClick={() => set('range', v)}
            aria-pressed={range === v}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              range === v ? 'bg-brand-700 text-white' : 'border border-brand-200 bg-white text-brand-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
