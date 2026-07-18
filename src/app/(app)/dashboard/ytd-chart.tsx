'use client';

import { useState } from 'react';
import { monthAbbr, money, money2 } from '@/lib/format';
import { BarChart, type Bar } from '../insights/chart';

type Monthly = { ym: string; net: number; checks: number };
type Weekly = { wk: string; pct: number };
type Mode = 'sales' | 'avg' | 'labor';

const pct1 = (n: number) => `${n.toFixed(1)}%`;
const pct0 = (n: number) => `${Math.round(n)}%`;

export function YtdChart({ monthly, weekly }: { monthly: Monthly[]; weekly: Weekly[] }) {
  const [mode, setMode] = useState<Mode>('sales');

  let bars: Bar[] = [];
  let max = 1;
  let format: (n: number) => string = money;
  let formatAxis: (n: number) => string = money;
  let caption = '';

  if (mode === 'sales') {
    bars = monthly.map((m, i) => ({ label: monthAbbr(m.ym), full: `${monthAbbr(m.ym)} ${m.ym.slice(0, 4)}`, value: Number(m.net), peak: i === monthly.length - 1 }));
    caption = 'Monthly sales';
  } else if (mode === 'avg') {
    bars = monthly.map((m, i) => ({
      label: monthAbbr(m.ym),
      full: `${monthAbbr(m.ym)} ${m.ym.slice(0, 4)}`,
      value: m.checks > 0 ? Number(m.net) / Number(m.checks) : 0,
      peak: i === monthly.length - 1,
    }));
    format = money2;
    formatAxis = money2;
    caption = 'Average ticket by month';
  } else {
    const peakPct = Math.max(0, ...weekly.map((w) => w.pct));
    bars = weekly.map((w) => ({ label: w.wk, full: `Week of ${w.wk}`, value: Number(w.pct), peak: w.pct === peakPct }));
    format = pct1;
    formatAxis = pct0;
    caption = 'Labor % by week';
  }
  max = Math.max(1, ...bars.map((b) => b.value));

  const TABS: [Mode, string][] = [
    ['sales', 'Sales'],
    ['avg', 'Avg ticket'],
    ['labor', 'Labor %'],
  ];

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-lg bg-brand-100 p-1">
        {TABS.map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition ${
              mode === m ? 'bg-white text-brand-900 shadow-sm' : 'text-brand-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mb-1 text-xs text-brand-400">{caption}</p>
      {bars.length > 1 ? (
        <BarChart bars={bars} max={max} showEvery={mode === 'labor' && bars.length > 8 ? 2 : 1} format={format} formatAxis={formatAxis} />
      ) : (
        <p className="py-6 text-center text-sm text-brand-400">Not enough data yet.</p>
      )}
    </div>
  );
}
