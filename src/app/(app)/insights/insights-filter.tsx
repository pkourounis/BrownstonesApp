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

/** Today's date in Eastern time as YYYY-MM-DD. */
function etToday(): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // en-CA already yields YYYY-MM-DD
}
function addDaysStr(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

export function InsightsFilter({ locations }: { locations: { id: string; name: string }[] }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  const range = sp.get('range') ?? 'year';
  const store = sp.get('store') ?? 'all';
  const date = sp.get('date') ?? '';
  const today = etToday();
  const yesterday = addDaysStr(today, -1);

  const push = (params: URLSearchParams) => startTransition(() => router.push(`/insights?${params.toString()}`, { scroll: false }));

  const setStore = (value: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set('store', value);
    push(params);
  };
  const setRange = (value: string) => {
    const params = new URLSearchParams(sp.toString());
    params.set('range', value);
    params.delete('date');
    push(params);
  };
  const pickDate = (value: string) => {
    if (!value) return;
    const params = new URLSearchParams(sp.toString());
    params.set('range', 'day');
    params.set('date', value);
    push(params);
  };

  const isDay = range === 'day';

  return (
    <div className="sticky top-0 z-10 -mx-4 space-y-2 border-b border-brand-100 bg-cream/95 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2">
        {locations.length > 1 && (
          <select value={store} onChange={(e) => setStore(e.target.value)} className="input flex-1" aria-label="Store">
            <option value="all">All stores</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        )}
        {pending && <Loader2 size={16} className="animate-spin text-brand-400" />}
      </div>

      <div className="flex gap-1.5">
        {RANGES.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setRange(v)}
            aria-pressed={range === v}
            className={`flex-1 rounded-lg py-2 text-xs font-semibold transition ${
              range === v ? 'bg-brand-700 text-white' : 'border border-brand-200 bg-white text-brand-600'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Pick any specific day (super admins & managers). */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => pickDate(yesterday)}
          aria-pressed={isDay && date === yesterday}
          className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
            isDay && date === yesterday ? 'bg-brand-700 text-white' : 'border border-brand-200 bg-white text-brand-600'
          }`}
        >
          Yesterday
        </button>
        <input
          type="date"
          value={isDay ? date : ''}
          max={today}
          onChange={(e) => pickDate(e.target.value)}
          className={`input h-9 flex-1 text-sm ${isDay && date && date !== yesterday ? 'ring-2 ring-brand-500' : ''}`}
          aria-label="Pick a day"
        />
      </div>
    </div>
  );
}
